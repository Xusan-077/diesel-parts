import "server-only";
import { prisma } from "@/lib/db";
import { buildPage, type Page } from "./product-query";
import type { PublicReview } from "@/lib/reviews";

/**
 * Everything the browser may see about a review.
 *
 * `authorPhone` is not here, and that is the point: this object is spread into
 * the JSON response, so the column can only leak if someone adds it to this
 * literal — a visible, reviewable edit, rather than a `select: undefined` that
 * silently returns the whole row.
 */
const PUBLIC_FIELDS = {
  id: true,
  rating: true,
  body: true,
  authorName: true,
  createdAt: true,
} as const;

/** The one shape mapping happens in, so every read path agrees. */
function toPublicReview(
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
    // The column is nullable for a rating that stands alone; the endpoint that
    // writes it requires text, so this only ever fills in for older rows.
    body: row.body ?? "",
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
 * `ownPhone` is the session's phone when there is one. It is used only to
 * compare — never returned — so the reader's own entry can be marked without
 * the response carrying anyone's number.
 */
export async function listProductReviews(
  productId: string,
  page: number,
  pageSize: number,
  ownPhone?: string | null,
): Promise<Page<PublicReview>> {
  const where = { productId, isApproved: true };

  const total = await prisma.review.count({ where });
  const clampedPage = buildPage([], total, page, pageSize).page;

  const rows = await prisma.review.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (clampedPage - 1) * pageSize,
    take: pageSize,
    // `authorPhone` is read here and nowhere near the response: it is compared
    // against the session inside `toPublicReview` and then dropped.
    select: { ...PUBLIC_FIELDS, authorPhone: true },
  });

  return buildPage(
    rows.map((row) => toPublicReview(row, ownPhone, row.authorPhone)),
    total,
    clampedPage,
    pageSize,
  );
}

/**
 * Writes this person's review of this part.
 *
 * An upsert rather than a create: the unique index means a second submission
 * is the same person changing their mind, and answering that with "you have
 * already reviewed this" is a dead end in a form they are looking at. The
 * original `createdAt` is left alone — the log records when they first spoke,
 * and rewriting it would shuffle the list under everyone else.
 */
export async function upsertReview(input: {
  productId: string;
  authorPhone: string;
  rating: number;
  body: string;
  authorName: string;
}): Promise<PublicReview> {
  const { productId, authorPhone, rating, body, authorName } = input;

  const row = await prisma.review.upsert({
    where: { productId_authorPhone: { productId, authorPhone } },
    create: { productId, authorPhone, rating, body, authorName },
    // `isApproved` is deliberately not touched on update: a director who took
    // a review down must not have that undone by the author editing it.
    update: { rating, body, authorName },
    select: PUBLIC_FIELDS,
  });

  return { ...toPublicReview(row), isMine: true };
}

/** This person's review of this part, for seeding the form. */
export async function getOwnReview(
  productId: string,
  authorPhone: string,
): Promise<PublicReview | null> {
  const row = await prisma.review.findUnique({
    where: { productId_authorPhone: { productId, authorPhone } },
    select: PUBLIC_FIELDS,
  });

  return row === null ? null : { ...toPublicReview(row), isMine: true };
}

/* ── Moderation ───────────────────────────────────────────────────────────── */

/** A review as the director's queue shows it, product and all. */
export interface ModeratedReview extends PublicReview {
  isApproved: boolean;
  product: { id: string; slug: string; name: string };
}

/**
 * Every review, visible or hidden, newest first.
 *
 * Hidden rows are included on purpose: a director who takes something down has
 * to be able to see what they took down, and to put it back.
 */
export async function listAllReviews(
  page: number,
  pageSize: number,
): Promise<Page<ModeratedReview>> {
  const total = await prisma.review.count();
  const clampedPage = buildPage([], total, page, pageSize).page;

  const rows = await prisma.review.findMany({
    orderBy: { createdAt: "desc" },
    skip: (clampedPage - 1) * pageSize,
    take: pageSize,
    select: {
      ...PUBLIC_FIELDS,
      isApproved: true,
      // The panel is staff-only and its whole job here is judging a person's
      // words, so it names the product. The phone still stays out: a director
      // moderating spam has no need of the number behind it.
      product: { select: { id: true, slug: true, nameUz: true } },
    },
  });

  return buildPage(
    rows.map((row) => ({
      ...toPublicReview(row),
      isApproved: row.isApproved,
      product: { id: row.product.id, slug: row.product.slug, name: row.product.nameUz },
    })),
    total,
    clampedPage,
    pageSize,
  );
}

/** Takes a review off the site, or puts it back. */
export async function setReviewApproval(id: string, isApproved: boolean): Promise<void> {
  await prisma.review.update({ where: { id }, data: { isApproved } });
}

export async function deleteReview(id: string): Promise<void> {
  await prisma.review.delete({ where: { id } });
}
