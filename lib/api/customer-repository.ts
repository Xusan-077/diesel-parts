import "server-only";
import { prisma } from "@/lib/db";
import { recordAudit } from "./audit";
import { diffFields, type AuditValue } from "./audit-diff";
import { SELLER_PAGE_SIZE } from "./inquiry-board-repository";
import {
  customerReadScope,
  customerWriteScope,
  inquiryReadScope,
  isDirector,
  unclaimedScope,
  type ScopeActor,
} from "./seller-scope";
import { extractNationalDigits, isValidPhone } from "@/lib/auth/phone";
import type { CustomerCreateInput, CustomerListQuery, CustomerUpdateInput } from "@/lib/schemas";
import type { Prisma } from "@/prisma/generated/prisma/client";
import type { InquiryStatus } from "@/prisma/generated/prisma/enums";

/** The seller's own customer book. */

export interface CustomerRow {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  company: string | null;
  notes: string | null;
  assignedSellerId: string | null;
  assignedSellerName: string | null;
  orderCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomerPage {
  items: CustomerRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const ROW_SELECT = {
  id: true,
  name: true,
  phone: true,
  email: true,
  company: true,
  notes: true,
  assignedSellerId: true,
  createdAt: true,
  updatedAt: true,
  assignedSeller: { select: { name: true } },
  _count: { select: { orders: true } },
} satisfies Prisma.CustomerSelect;

type CustomerRecord = Prisma.CustomerGetPayload<{ select: typeof ROW_SELECT }>;

function toRow(row: CustomerRecord): CustomerRow {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    company: row.company,
    notes: row.notes,
    assignedSellerId: row.assignedSellerId,
    assignedSellerName: row.assignedSeller?.name ?? null,
    orderCount: row._count.orders,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function listCustomers(
  actor: ScopeActor,
  query: CustomerListQuery,
): Promise<CustomerPage> {
  const term = query.search?.trim() ?? "";
  const filters: Prisma.CustomerWhereInput[] = [
    customerReadScope(actor, { includePool: query.pool }),
  ];

  // Phone is in the search on purpose: the caller is usually on the line and
  // has the number, not the spelling of the name.
  if (term) {
    filters.push({
      OR: [
        { name: { contains: term, mode: "insensitive" } },
        { phone: { contains: term } },
        { company: { contains: term, mode: "insensitive" } },
      ],
    });
  }

  const where: Prisma.CustomerWhereInput = { AND: filters };

  const total = await prisma.customer.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / SELLER_PAGE_SIZE));
  const page = Math.min(Math.max(1, query.page), totalPages);

  const rows = await prisma.customer.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    skip: (page - 1) * SELLER_PAGE_SIZE,
    take: SELLER_PAGE_SIZE,
    select: ROW_SELECT,
  });

  return { items: rows.map(toRow), total, page, pageSize: SELLER_PAGE_SIZE, totalPages };
}

/** Reads include the unclaimed pool: a seller cannot claim what they cannot see. */
export async function getCustomer(id: string, actor: ScopeActor): Promise<CustomerRow | null> {
  const row = await prisma.customer.findFirst({
    where: { id, ...customerReadScope(actor, { includePool: true }) },
    select: ROW_SELECT,
  });

  return row === null ? null : toRow(row);
}

export type CustomerWriteResult = { ok: true; id: string } | { ok: false; reason: "not_found" };

export async function createCustomer(
  input: CustomerCreateInput,
  actor: ScopeActor,
): Promise<{ ok: true; id: string }> {
  const created = await prisma.customer.create({
    data: {
      name: input.name.trim(),
      phone: input.phone.trim(),
      email: input.email?.trim() || null,
      company: input.company?.trim() || null,
      notes: input.notes?.trim() || null,
      // A seller keeps what they enter. A director is not a seller, so what
      // they add lands in the pool for whoever picks the account up.
      assignedSellerId: isDirector(actor) ? null : actor.id,
    },
    select: { id: true, name: true, phone: true, assignedSellerId: true },
  });

  await recordAudit({
    userId: actor.id,
    action: "CREATE",
    entityType: "Customer",
    entityId: created.id,
    after: {
      name: created.name,
      phone: created.phone,
      assignedSellerId: created.assignedSellerId,
    },
  });

  return { ok: true, id: created.id };
}

const UPDATE_SELECT = {
  name: true,
  phone: true,
  email: true,
  company: true,
  notes: true,
} satisfies Prisma.CustomerSelect;

type CustomerUpdateRecord = Prisma.CustomerGetPayload<{ select: typeof UPDATE_SELECT }>;

function auditSnapshot(row: CustomerUpdateRecord): Record<string, AuditValue> {
  return {
    name: row.name,
    phone: row.phone,
    email: row.email,
    company: row.company,
    notes: row.notes,
  };
}

export async function updateCustomer(
  id: string,
  input: CustomerUpdateInput,
  actor: ScopeActor,
): Promise<CustomerWriteResult> {
  // The write scope, not the read one: a seller may read a pooled customer but
  // the only write they may make against an unowned row is the claim.
  const before = await prisma.customer.findFirst({
    where: { id, ...customerWriteScope(actor) },
    select: UPDATE_SELECT,
  });

  if (before === null) {
    return { ok: false, reason: "not_found" };
  }

  const data: Prisma.CustomerUpdateInput = {};

  if (input.name !== undefined) {
    data.name = input.name.trim();
  }
  if (input.phone !== undefined) {
    data.phone = input.phone.trim();
  }
  if (input.email !== undefined) {
    data.email = input.email?.trim() || null;
  }
  if (input.company !== undefined) {
    data.company = input.company?.trim() || null;
  }
  if (input.notes !== undefined) {
    data.notes = input.notes?.trim() || null;
  }

  const after = await prisma.customer.update({ where: { id }, data, select: UPDATE_SELECT });
  const diff = diffFields(auditSnapshot(before), auditSnapshot(after));

  if (diff !== null) {
    await recordAudit({
      userId: actor.id,
      action: "UPDATE",
      entityType: "Customer",
      entityId: id,
      before: diff.before,
      after: diff.after,
    });
  }

  return { ok: true, id };
}

export type CustomerClaimResult =
  | { ok: true; id: string }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "taken" };

/** Same compare-and-set as an inquiry claim, for the unassigned pool tab. */
export async function claimCustomer(id: string, actor: ScopeActor): Promise<CustomerClaimResult> {
  const claimed = await prisma.customer.updateMany({
    where: { id, ...unclaimedScope() },
    data: { assignedSellerId: actor.id },
  });

  if (claimed.count === 0) {
    const existing = await prisma.customer.findUnique({ where: { id }, select: { id: true } });
    return existing === null ? { ok: false, reason: "not_found" } : { ok: false, reason: "taken" };
  }

  await recordAudit({
    userId: actor.id,
    action: "UPDATE",
    entityType: "Customer",
    entityId: id,
    before: { assignedSellerId: null },
    after: { assignedSellerId: actor.id },
  });

  return { ok: true, id };
}

/* ── Matching free-text phone numbers ─────────────────────────────────────── */

/**
 * How many rows a phone match may scan.
 *
 * `Inquiry.phone` is whatever the customer typed into the public form and
 * `Customer.phone` is whatever the seller typed here, so neither can be matched
 * in SQL: "+998 90 123-45-67" and "998901234567" are the same number and no
 * `equals` sees it. The comparison therefore happens in JS on canonical digits,
 * and this caps what that costs. The `contains` prefilter below narrows the
 * scan to roughly one row in a hundred first, so the cap is far past any real
 * shop's history rather than a limit anyone will meet.
 */
const PHONE_SCAN_LIMIT = 1000;

/**
 * A SQL prefilter that no plausible formatting can defeat.
 *
 * The last two digits of a number are written together in every form this app
 * produces ("+998 90 123-45-67", "90 123 45 67", "998901234567") and in every
 * form a person types by hand. Anything looser would scan the table; anything
 * tighter would start missing real matches.
 */
function phoneTail(national: string): string {
  return national.slice(7);
}

/** One inquiry from the same number, for the customer's history. */
export interface CustomerInquiryRow {
  id: string;
  message: string;
  status: InquiryStatus;
  assignedSellerId: string | null;
  assignedSellerName: string | null;
  productSku: string | null;
  quantity: number | null;
  notes: string | null;
  createdAt: Date;
}

/**
 * The inquiries that came from this customer's number.
 *
 * Matched on the phone because there is no foreign key to match on: an
 * `Inquiry` is raised by an anonymous visitor before anybody knows which
 * account they belong to, and the board's "save as customer" copies the number
 * across rather than writing a link. The screen says so in as many words, so
 * the seller reads this as "calls from this number" and not as a guarantee.
 */
export async function listCustomerInquiries(
  phone: string,
  actor: ScopeActor,
): Promise<CustomerInquiryRow[]> {
  // A half-written number would match on two digits alone and pull in strangers.
  if (!isValidPhone(phone)) {
    return [];
  }

  const national = extractNationalDigits(phone);

  const rows = await prisma.inquiry.findMany({
    where: { AND: [inquiryReadScope(actor), { phone: { contains: phoneTail(national) } }] },
    orderBy: { createdAt: "desc" },
    take: PHONE_SCAN_LIMIT,
    select: {
      id: true,
      phone: true,
      message: true,
      status: true,
      assignedSellerId: true,
      productSku: true,
      quantity: true,
      notes: true,
      createdAt: true,
      assignedSeller: { select: { name: true } },
    },
  });

  return rows
    .filter((row) => extractNationalDigits(row.phone) === national)
    .map((row) => ({
      id: row.id,
      message: row.message,
      status: row.status,
      assignedSellerId: row.assignedSellerId,
      assignedSellerName: row.assignedSeller?.name ?? null,
      productSku: row.productSku,
      quantity: row.quantity,
      notes: row.notes,
      createdAt: row.createdAt,
    }));
}

/**
 * Which of these numbers the caller already keeps a customer card for.
 *
 * Feeds the board, where a card offers "save as customer" only when the number
 * is new to the book. Deliberately not a uniqueness check: `Customer.phone` is
 * non-unique because a company switchboard is shared by several contacts, so
 * this hides an action that would usually be a mistake without forbidding a
 * second card on the same line.
 *
 * Keyed by canonical digits, which is the form the caller must look rows up by.
 */
export async function findCustomersByPhone(
  phones: readonly string[],
  actor: ScopeActor,
): Promise<Map<string, { id: string; name: string }>> {
  const wanted = new Set(phones.filter(isValidPhone).map(extractNationalDigits));

  const found = new Map<string, { id: string; name: string }>();
  if (wanted.size === 0) {
    return found;
  }

  const rows = await prisma.customer.findMany({
    where: {
      AND: [
        // The book only, never the pool: a card the seller does not own is not
        // one they have already saved.
        customerReadScope(actor),
        // Deduped: a board holds up to a hundred numbers but only a hundred
        // two-digit tails exist, so the raw mapping would repeat the same
        // `contains` clause many times over.
        {
          OR: [...new Set([...wanted].map(phoneTail))].map((tail) => ({
            phone: { contains: tail },
          })),
        },
      ],
    },
    orderBy: { createdAt: "asc" },
    take: PHONE_SCAN_LIMIT,
    select: { id: true, name: true, phone: true },
  });

  for (const row of rows) {
    const national = extractNationalDigits(row.phone);
    // First card wins, which is why the query orders by age: a seller who has
    // two cards on one switchboard should land on the one they made first.
    if (wanted.has(national) && !found.has(national)) {
      found.set(national, { id: row.id, name: row.name });
    }
  }

  return found;
}
