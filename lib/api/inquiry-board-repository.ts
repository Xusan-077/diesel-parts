import "server-only";
import { prisma } from "@/lib/db";
import { recordAudit } from "./audit";
import { diffFields, type AuditValue } from "./audit-diff";
import {
  INQUIRY_COLUMNS,
  inquiryColumn,
  inquiryColumnFilter,
  type InquiryColumn,
} from "./inquiry-board";
import {
  inquiryReadScope,
  inquiryWriteScope,
  isDirector,
  unclaimedScope,
  type ScopeActor,
} from "./seller-scope";
import type { InquiryListQuery, InquiryUpdateInput } from "@/lib/schemas";
import type { Prisma } from "@/prisma/generated/prisma/client";
import type { InquiryStatus, InquirySource } from "@/prisma/generated/prisma/enums";

/**
 * The seller board's reads and writes. Public-site inquiry creation stays in
 * `inquiry-repository.ts`: that path takes no actor and needs no scoping, and
 * this one drags in the audit trail.
 */

export const SELLER_PAGE_SIZE = 20;

export interface InquiryRow {
  id: string;
  customerName: string;
  phone: string;
  email: string | null;
  message: string;
  productId: string | null;
  productSku: string | null;
  quantity: number | null;
  status: InquiryStatus;
  source: InquirySource;
  column: InquiryColumn;
  assignedSellerId: string | null;
  assignedSellerName: string | null;
  notes: string | null;
  followUpAt: Date | null;
  createdAt: Date;
}

export interface InquiryPage {
  items: InquiryRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

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

function toRow(row: InquiryRecord): InquiryRow {
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

export async function listInquiries(
  actor: ScopeActor,
  query: InquiryListQuery,
): Promise<InquiryPage> {
  const filters: Prisma.InquiryWhereInput[] = [inquiryReadScope(actor)];

  if (query.column) {
    filters.push(inquiryColumnFilter(query.column));
  }

  // Only a director can narrow to somebody else: a seller's own scope already
  // pins the list to their rows and the pool, and honouring the parameter for
  // them would suggest it does something.
  if (query.sellerId && isDirector(actor)) {
    filters.push({ assignedSellerId: query.sellerId });
  }

  const where: Prisma.InquiryWhereInput = { AND: filters };

  const total = await prisma.inquiry.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / SELLER_PAGE_SIZE));
  const page = Math.min(Math.max(1, query.page), totalPages);

  const rows = await prisma.inquiry.findMany({
    where,
    // Oldest first: a lead nobody has answered is the one that needs answering.
    orderBy: { createdAt: "asc" },
    skip: (page - 1) * SELLER_PAGE_SIZE,
    take: SELLER_PAGE_SIZE,
    select: ROW_SELECT,
  });

  return {
    items: rows.map(toRow),
    total,
    page,
    pageSize: SELLER_PAGE_SIZE,
    totalPages,
  };
}

export type ClaimResult =
  | { ok: true; id: string }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "taken" };

/**
 * Claims one lead.
 *
 * Race-safe without a transaction: the `assignedSellerId: null` in the `where`
 * makes the update its own compare-and-set, and the loser of the race updates
 * nothing. Two sellers tapping the same card a second apart is the expected
 * case, not an edge case, and the loser has to be told the lead is gone rather
 * than shown a silent no-op.
 */
export async function claimInquiry(id: string, actor: ScopeActor): Promise<ClaimResult> {
  const claimed = await prisma.inquiry.updateMany({
    where: { id, ...unclaimedScope() },
    data: { assignedSellerId: actor.id },
  });

  if (claimed.count === 0) {
    const existing = await prisma.inquiry.findUnique({ where: { id }, select: { id: true } });
    return existing === null ? { ok: false, reason: "not_found" } : { ok: false, reason: "taken" };
  }

  await recordAudit({
    userId: actor.id,
    action: "UPDATE",
    entityType: "Inquiry",
    entityId: id,
    before: { assignedSellerId: null },
    after: { assignedSellerId: actor.id },
  });

  return { ok: true, id };
}

export type InquiryWriteResult = { ok: true; id: string } | { ok: false; reason: "not_found" };

const UPDATE_SELECT = {
  status: true,
  notes: true,
  followUpAt: true,
  assignedSellerId: true,
} satisfies Prisma.InquirySelect;

type InquiryUpdateRecord = Prisma.InquiryGetPayload<{ select: typeof UPDATE_SELECT }>;

/** What the audit trail carries — dates as ISO strings, because it is JSON. */
function auditSnapshot(row: InquiryUpdateRecord): Record<string, AuditValue> {
  return {
    status: row.status,
    notes: row.notes,
    followUpAt: row.followUpAt === null ? null : row.followUpAt.toISOString(),
  };
}

/**
 * Moves a card, leaves a note, or sets a callback date.
 *
 * An unowned row answers `not_found` rather than a refusal, and the route turns
 * that into a 404. A 403 would confirm the row exists, which tells one seller
 * that another seller's lead is real.
 */
export async function updateInquiry(
  id: string,
  input: InquiryUpdateInput,
  actor: ScopeActor,
): Promise<InquiryWriteResult> {
  const before = await prisma.inquiry.findFirst({
    where: { id, ...inquiryWriteScope(actor) },
    select: UPDATE_SELECT,
  });

  if (before === null) {
    return { ok: false, reason: "not_found" };
  }

  const data: Prisma.InquiryUpdateInput = {};

  if (input.status !== undefined) {
    data.status = input.status;
  }
  if (input.notes !== undefined) {
    data.notes = input.notes;
  }
  if (input.followUpAt !== undefined) {
    data.followUpAt = input.followUpAt === null ? null : new Date(input.followUpAt);
  }

  const after = await prisma.inquiry.update({ where: { id }, data, select: UPDATE_SELECT });
  const diff = diffFields(auditSnapshot(before), auditSnapshot(after));

  // Nothing moved — a seller pressing save on an unchanged form is not an event.
  if (diff !== null) {
    await recordAudit({
      userId: actor.id,
      action: "UPDATE",
      entityType: "Inquiry",
      entityId: id,
      before: diff.before,
      after: diff.after,
    });
  }

  return { ok: true, id };
}

export interface InquiryBoardColumn {
  items: InquiryRow[];
  /** Rows in the column, which may exceed the page the board loaded. */
  total: number;
}

export type InquiryBoard = Record<InquiryColumn, InquiryBoardColumn>;

/**
 * Every column at once, for the board screen.
 *
 * Not five calls to `listInquiries`: that function sorts oldest-first because an
 * unanswered lead is the one that needs answering, which is right for the three
 * live columns and wrong for the two closed ones — a seller opening "Yutildi"
 * wants this month's wins, not the oldest deal on record. The scope and the
 * column filter are the same helpers, so the rule that matters is still stated
 * once.
 *
 * Each column is capped at one page. A board that loaded an unbounded "Yutildi"
 * would grow without limit as the business does; the count beside the heading
 * tells the seller when there is more than they are looking at.
 */
export async function listInquiryBoard(actor: ScopeActor): Promise<InquiryBoard> {
  const scope = inquiryReadScope(actor);

  const columns = await Promise.all(
    INQUIRY_COLUMNS.map(async (column) => {
      const where: Prisma.InquiryWhereInput = { AND: [scope, inquiryColumnFilter(column)] };
      const closed = column === "won" || column === "lost";

      const [total, rows] = await Promise.all([
        prisma.inquiry.count({ where }),
        prisma.inquiry.findMany({
          where,
          orderBy: { createdAt: closed ? "desc" : "asc" },
          take: SELLER_PAGE_SIZE,
          select: ROW_SELECT,
        }),
      ]);

      return [column, { items: rows.map(toRow), total }] as const;
    }),
  );

  return Object.fromEntries(columns) as InquiryBoard;
}
