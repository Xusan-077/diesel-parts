import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { paginationMeta } from '../common/dto/pagination.dto';
import {
  inquiryReadScope,
  inquiryWriteScope,
  isDirector,
  unclaimedScope,
  type ScopeActor,
} from '../common/scope';
import { diffFields, type AuditValue } from '../common/audit-diff';
import {
  extractNationalDigits,
  isValidPhone,
  phoneTail,
} from '../common/phone';
import {
  INQUIRY_COLUMNS,
  inquiryColumn,
  inquiryColumnFilter,
  type InquiryColumn,
} from './inquiry-board';
import { CreateInquiryDto } from './dto/create-inquiry.dto';
import { QueryInquiryDto } from './dto/query-inquiry.dto';
import { UpdateInquiryDto } from './dto/update-inquiry.dto';

/**
 * The seller board's reads and writes, plus the public-site create.
 *
 * Ported from the root Next.js app's `lib/api/inquiry-repository.ts` and
 * `lib/api/inquiry-board-repository.ts`. Public-site inquiry creation stays
 * a separate, unscoped path: it takes no actor and, matching the source,
 * writes no audit entry — an anonymous visitor submitting a contact form is
 * not a staff action to be traced back to a user.
 */

export const SELLER_PAGE_SIZE = 20;

/**
 * How many rows a phone match may scan — see `CustomersService`'s identical
 * constant for the full reasoning (free-text phone, no SQL `equals`, JS
 * comparison on canonical digits after a `contains` prefilter).
 */
const PHONE_SCAN_LIMIT = 1000;

const ROW_SELECT = {
  id: true,
  customerName: true,
  phone: true,
  email: true,
  message: true,
  productId: true,
  productSku: true,
  quantity: true,
  status: true,
  source: true,
  assignedSellerId: true,
  notes: true,
  followUpAt: true,
  createdAt: true,
  assignedSeller: { select: { name: true } },
} satisfies Prisma.InquirySelect;

type InquiryRecord = Prisma.InquiryGetPayload<{ select: typeof ROW_SELECT }>;

function toRow(row: InquiryRecord) {
  return {
    id: row.id,
    customerName: row.customerName,
    phone: row.phone,
    email: row.email,
    message: row.message,
    productId: row.productId,
    productSku: row.productSku,
    quantity: row.quantity,
    status: row.status,
    source: row.source,
    column: inquiryColumn(row.status, row.assignedSellerId),
    assignedSellerId: row.assignedSellerId,
    assignedSellerName: row.assignedSeller?.name ?? null,
    notes: row.notes,
    followUpAt: row.followUpAt,
    createdAt: row.createdAt,
  };
}

export type InquiryRow = ReturnType<typeof toRow>;

export interface InquiryBoardColumn {
  items: InquiryRow[];
  /** Rows in the column, which may exceed the page the board loaded. */
  total: number;
}

export type InquiryBoard = Record<InquiryColumn, InquiryBoardColumn>;

const UPDATE_SELECT = {
  status: true,
  notes: true,
  followUpAt: true,
  assignedSellerId: true,
} satisfies Prisma.InquirySelect;

type InquiryUpdateRecord = Prisma.InquiryGetPayload<{
  select: typeof UPDATE_SELECT;
}>;

/** What the audit trail carries — dates as ISO strings, because it is JSON. */
function auditSnapshot(row: InquiryUpdateRecord): Record<string, AuditValue> {
  return {
    status: row.status,
    notes: row.notes,
    followUpAt: row.followUpAt === null ? null : row.followUpAt.toISOString(),
  };
}

@Injectable()
export class InquiriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * The public-site inquiry form (product dialog, quote request, contact
   * form). No actor, no scoping, no audit trail — see the module doc
   * comment above.
   */
  async create(dto: CreateInquiryDto): Promise<void> {
    await this.prisma.inquiry.create({
      data: {
        customerName: dto.customerName,
        phone: dto.phone,
        email: dto.email ?? null,
        message: dto.message,
        source: dto.source,
        productId: dto.productId ?? null,
        productSku: dto.productSku ?? null,
        quantity: dto.quantity ?? null,
      },
    });
  }

  async list(actor: ScopeActor, query: QueryInquiryDto) {
    const filters: Prisma.InquiryWhereInput[] = [inquiryReadScope(actor)];

    if (query.column) {
      filters.push(inquiryColumnFilter(query.column));
    }

    // Only a director can narrow to somebody else: a seller's own scope
    // already pins the list to their rows and the pool, and honouring the
    // parameter for them would suggest it does something.
    if (query.sellerId && isDirector(actor)) {
      filters.push({ assignedSellerId: query.sellerId });
    }

    const where: Prisma.InquiryWhereInput = { AND: filters };

    const total = await this.prisma.inquiry.count({ where });
    const totalPages = Math.max(1, Math.ceil(total / SELLER_PAGE_SIZE));
    const page = Math.min(Math.max(1, query.page ?? 1), totalPages);

    const rows = await this.prisma.inquiry.findMany({
      where,
      // Oldest first: a lead nobody has answered is the one that needs
      // answering.
      orderBy: { createdAt: 'asc' },
      skip: (page - 1) * SELLER_PAGE_SIZE,
      take: SELLER_PAGE_SIZE,
      select: ROW_SELECT,
    });

    return {
      data: rows.map(toRow),
      meta: paginationMeta(page, SELLER_PAGE_SIZE, total),
    };
  }

  /**
   * Every column at once, for the board screen.
   *
   * Not five calls to `list`: that method sorts oldest-first because an
   * unanswered lead is the one that needs answering, which is right for the
   * three live columns and wrong for the two closed ones — a seller opening
   * "Yutildi" wants this month's wins, not the oldest deal on record. The
   * scope and the column filter are the same helpers, so the rule that
   * matters is still stated once.
   *
   * Each column is capped at one page. A board that loaded an unbounded
   * "Yutildi" would grow without limit as the business does; the count
   * beside the heading tells the seller when there is more than they are
   * looking at.
   */
  async board(actor: ScopeActor): Promise<InquiryBoard> {
    const scope = inquiryReadScope(actor);

    const columns = await Promise.all(
      INQUIRY_COLUMNS.map(async (column) => {
        const where: Prisma.InquiryWhereInput = {
          AND: [scope, inquiryColumnFilter(column)],
        };
        const closed = column === 'won' || column === 'lost';

        const [total, rows] = await Promise.all([
          this.prisma.inquiry.count({ where }),
          this.prisma.inquiry.findMany({
            where,
            orderBy: { createdAt: closed ? 'desc' : 'asc' },
            take: SELLER_PAGE_SIZE,
            select: ROW_SELECT,
          }),
        ]);

        return [column, { items: rows.map(toRow), total }] as const;
      }),
    );

    return Object.fromEntries(columns) as InquiryBoard;
  }

  /**
   * The inquiries that came from this phone number, for a customer's
   * history in the CRM. Matched on the phone because there is no foreign key
   * to match on: an `Inquiry` is raised by an anonymous visitor before
   * anybody knows which account they belong to.
   */
  async byPhone(phone: string, actor: ScopeActor): Promise<InquiryRow[]> {
    // A half-written number would match on two digits alone and pull in
    // strangers.
    if (!isValidPhone(phone)) {
      return [];
    }

    const national = extractNationalDigits(phone);

    const rows = await this.prisma.inquiry.findMany({
      where: {
        AND: [
          inquiryReadScope(actor),
          { phone: { contains: phoneTail(national) } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: PHONE_SCAN_LIMIT,
      select: ROW_SELECT,
    });

    return rows
      .filter((row) => extractNationalDigits(row.phone) === national)
      .map(toRow);
  }

  /**
   * Claims one lead.
   *
   * Race-safe without a transaction: the `assignedSellerId: null` in the
   * `where` makes the update its own compare-and-set, and the loser of the
   * race updates nothing. Two sellers tapping the same card a second apart
   * is the expected case, not an edge case, and the loser has to be told
   * the lead is gone rather than shown a silent no-op — the controller
   * turns `taken` into 409 and `not_found` into 404, matching the root
   * app's `app/api/v1/inquiries/[id]/claim/route.ts`.
   */
  async claim(id: string, actor: ScopeActor): Promise<{ id: string }> {
    const claimed = await this.prisma.inquiry.updateMany({
      where: { id, ...unclaimedScope() },
      data: { assignedSellerId: actor.id },
    });

    if (claimed.count === 0) {
      const existing = await this.prisma.inquiry.findUnique({
        where: { id },
        select: { id: true },
      });
      if (existing === null) {
        throw new NotFoundException("So'rov topilmadi.");
      }
      throw new ConflictException(
        "Bu so'rovni boshqa sotuvchi allaqachon band qilgan.",
      );
    }

    await this.audit.record({
      userId: actor.id,
      action: AuditAction.UPDATE,
      entityType: 'Inquiry',
      entityId: id,
      before: { assignedSellerId: null },
      after: { assignedSellerId: actor.id },
    });

    return { id };
  }

  /**
   * Moves a card, leaves a note, or sets a callback date.
   *
   * An unowned row answers 404 rather than a 403, and so does one that
   * genuinely does not exist — a 403 would confirm the row exists, which
   * tells one seller that another seller's lead is real.
   */
  async update(
    id: string,
    dto: UpdateInquiryDto,
    actor: ScopeActor,
  ): Promise<{ id: string }> {
    if (
      dto.status === undefined &&
      dto.notes === undefined &&
      dto.followUpAt === undefined
    ) {
      throw new BadRequestException('At least one field must be provided');
    }

    const before = await this.prisma.inquiry.findFirst({
      where: { id, ...inquiryWriteScope(actor) },
      select: UPDATE_SELECT,
    });

    if (before === null) {
      throw new NotFoundException("So'rov topilmadi.");
    }

    const data: Prisma.InquiryUpdateInput = {};

    if (dto.status !== undefined) {
      data.status = dto.status;
    }
    if (dto.notes !== undefined) {
      data.notes = dto.notes;
    }
    if (dto.followUpAt !== undefined) {
      data.followUpAt =
        dto.followUpAt === null ? null : new Date(dto.followUpAt);
    }

    const after = await this.prisma.inquiry.update({
      where: { id },
      data,
      select: UPDATE_SELECT,
    });
    const diff = diffFields(auditSnapshot(before), auditSnapshot(after));

    // Nothing moved — a seller pressing save on an unchanged form is not an
    // event.
    if (diff !== null) {
      await this.audit.record({
        userId: actor.id,
        action: AuditAction.UPDATE,
        entityType: 'Inquiry',
        entityId: id,
        before: diff.before,
        after: diff.after,
      });
    }

    return { id };
  }
}
