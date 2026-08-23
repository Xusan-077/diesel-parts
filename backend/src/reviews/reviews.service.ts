import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { paginationMeta } from '../common/dto/pagination.dto';
import {
  extractNationalDigits,
  isValidPhone,
  phoneTail,
} from '../common/phone';
import { UpsertReviewDto } from './dto/upsert-review.dto';

/**
 * Everything the browser may see about a review.
 *
 * `authorPhone` is not here, and that is the point: every row this service
 * returns is built through `toPublicReview`, so the column can only leak if
 * someone adds it to that literal — a visible, reviewable edit, rather than
 * a `select` that silently widens and returns the whole row.
 */
const PUBLIC_FIELDS = {
  id: true,
  rating: true,
  body: true,
  authorName: true,
  createdAt: true,
} as const;

export interface PublicReview {
  id: string;
  rating: number;
  body: string;
  authorName: string;
  /** ISO 8601. */
  createdAt: string;
  /** This review was written by the caller identified by `authorPhone`/`phone`. */
  isMine?: boolean;
}

/** A review as the moderation queue shows it, product and all. */
export interface ModeratedReview extends PublicReview {
  isApproved: boolean;
  product: { id: string; slug: string; name: string };
}

/**
 * How many order lines a purchase check may scan.
 *
 * Same reasoning as the customer book's phone matching: `Customer.phone` is
 * free text typed by a seller, so the match cannot be made in SQL and has to
 * finish in JS on canonical digits. The `contains` prefilter below narrows
 * the scan to the lines whose customer's number ends the same way, which for
 * one product is a handful of rows.
 */
const PURCHASE_SCAN_LIMIT = 500;

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  /** The one shape mapping happens in, so every read path agrees. */
  private toPublicReview(
    row: {
      id: string;
      rating: number;
      body: string | null;
      authorName: string;
      createdAt: Date;
    },
    ownPhone?: string | null,
    rowPhone?: string,
  ): PublicReview {
    return {
      id: row.id,
      rating: row.rating,
      // The column is nullable for a rating that stands alone; the endpoint
      // that writes it requires text, so this only ever fills in for older
      // rows.
      body: row.body ?? '',
      authorName: row.authorName,
      createdAt: row.createdAt.toISOString(),
      ...(ownPhone !== undefined && ownPhone !== null && rowPhone === ownPhone
        ? { isMine: true }
        : {}),
    };
  }

  /**
   * One page of a product's visible reviews, newest first.
   *
   * `ownPhone` is the caller's phone when the Next.js layer has a session for
   * it. It is used only to compare — never returned — so the reader's own
   * entry can be marked without the response carrying anyone's number.
   */
  async listForProduct(
    productId: string,
    page: number,
    limit: number,
    ownPhone?: string | null,
  ) {
    const where = { productId, isApproved: true };

    const total = await this.prisma.review.count({ where });
    const clampedPage = Math.min(
      Math.max(1, page),
      Math.max(1, Math.ceil(total / limit)),
    );

    const rows = await this.prisma.review.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (clampedPage - 1) * limit,
      take: limit,
      // `authorPhone` is read here and nowhere near the response: it is
      // compared against the caller's phone inside `toPublicReview` and then
      // dropped.
      select: { ...PUBLIC_FIELDS, authorPhone: true },
    });

    return {
      data: rows.map((row) =>
        this.toPublicReview(row, ownPhone, row.authorPhone),
      ),
      meta: paginationMeta(clampedPage, limit, total),
    };
  }

  /**
   * Writes this person's review of this part.
   *
   * An upsert rather than a create: the unique index means a second
   * submission is the same person changing their mind, and answering that
   * with "you have already reviewed this" is a dead end in a form they are
   * looking at. The original `createdAt` is left alone — the log records when
   * they first spoke, and rewriting it would shuffle the list under everyone
   * else.
   *
   * `isApproved` is deliberately not touched on update: a director who took a
   * review down must not have that undone by the author editing it.
   */
  async upsert(dto: UpsertReviewDto): Promise<PublicReview> {
    const { productId, authorPhone, rating, body, authorName } = dto;

    try {
      const row = await this.prisma.review.upsert({
        where: { productId_authorPhone: { productId, authorPhone } },
        create: { productId, authorPhone, rating, body, authorName },
        update: { rating, body, authorName },
        select: PUBLIC_FIELDS,
      });

      return { ...this.toPublicReview(row), isMine: true };
    } catch (error) {
      // `productId` arrives from the browser, so a part that was retired
      // between the page rendering and the button being pressed lands here
      // as a foreign-key violation — not something the caller did wrong, and
      // not something a generic 500 explains.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new BadRequestException('Product not found');
      }
      throw error;
    }
  }

  /** This person's review of this part, for seeding the form. */
  async getOwn(
    productId: string,
    authorPhone: string,
  ): Promise<PublicReview | null> {
    const row = await this.prisma.review.findUnique({
      where: { productId_authorPhone: { productId, authorPhone } },
      select: PUBLIC_FIELDS,
    });

    return row === null ? null : { ...this.toPublicReview(row), isMine: true };
  }

  /**
   * Every review, visible or hidden, newest first, optionally narrowed to one
   * product.
   *
   * Hidden rows are included on purpose: a director who takes something down
   * has to be able to see what they took down, and to put it back.
   */
  async listAll(page: number, limit: number, productId?: string) {
    const where = productId ? { productId } : {};

    const total = await this.prisma.review.count({ where });
    const clampedPage = Math.min(
      Math.max(1, page),
      Math.max(1, Math.ceil(total / limit)),
    );

    const rows = await this.prisma.review.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (clampedPage - 1) * limit,
      take: limit,
      select: {
        ...PUBLIC_FIELDS,
        isApproved: true,
        // The panel is staff-only and its whole job here is judging a
        // person's words, so it names the product. The phone still stays
        // out: a director moderating spam has no need of the number behind
        // it.
        product: { select: { id: true, slug: true, nameUz: true } },
      },
    });

    const data: ModeratedReview[] = rows.map((row) => ({
      ...this.toPublicReview(row),
      isApproved: row.isApproved,
      product: {
        id: row.product.id,
        slug: row.product.slug,
        name: row.product.nameUz,
      },
    }));

    return { data, meta: paginationMeta(clampedPage, limit, total) };
  }

  /** Takes a review off the site, or puts it back. */
  async setApproval(
    id: string,
    isApproved: boolean,
  ): Promise<{ success: true; id: string }> {
    await this.getOrThrow(id);
    await this.prisma.review.update({ where: { id }, data: { isApproved } });
    return { success: true, id };
  }

  /**
   * Deletes the row outright.
   *
   * Unlike a product — which is retired rather than deleted, because orders
   * reference it — nothing points at a review, and spam is not a record
   * anyone needs kept. Hiding is the reversible option (`setApproval`); this
   * one is for what should never have been written.
   */
  async remove(id: string): Promise<{ success: true; id: string }> {
    await this.getOrThrow(id);
    await this.prisma.review.delete({ where: { id } });
    return { success: true, id };
  }

  private async getOrThrow(id: string) {
    const review = await this.prisma.review.findUnique({ where: { id } });
    if (!review) throw new NotFoundException('Review not found');
    return review;
  }

  /**
   * Whether this person has actually bought this part.
   *
   * A review of a fuel injector is worth reading because someone fitted it
   * and watched it work. Anyone able to sign in with a phone number could
   * otherwise score a competitor's part one star without ever touching it,
   * and the whole log would be worth nothing.
   *
   * "Bought" means a *completed* order. Orders here move through several
   * statuses and only COMPLETED means the part reached the customer — a
   * confirmed order is a promise, and someone who has not yet held the part
   * has nothing to report about it.
   *
   * The join is by phone rather than by a key, because there is no key: a
   * visitor signs in with a number and the session carries that number,
   * while orders belong to a `Customer` a seller created by hand. The number
   * is the only thing the two identities share, which is also why the
   * comparison is on canonical digits — the seller may have typed
   * "+998 90 123-45-67" for a session that says "998901234567".
   */
  async hasPurchased(productId: string, phone: string): Promise<boolean> {
    if (!isValidPhone(phone)) {
      return false;
    }

    const national = extractNationalDigits(phone);

    const rows = await this.prisma.orderItem.findMany({
      where: {
        productId,
        order: {
          status: OrderStatus.COMPLETED,
          customer: { phone: { contains: phoneTail(phone) } },
        },
      },
      take: PURCHASE_SCAN_LIMIT,
      // Only the number, and only to compare it: nothing here reaches a
      // response.
      select: { order: { select: { customer: { select: { phone: true } } } } },
    });

    return rows.some(
      (row) => extractNationalDigits(row.order.customer.phone) === national,
    );
  }
}
