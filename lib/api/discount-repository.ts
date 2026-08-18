import "server-only";
import { prisma } from "@/lib/db";
import { recordAudit } from "./audit";

export interface DiscountRequestView {
  id: string;
  orderId: string;
  orderNumber: string;
  sellerName: string;
  sellerLimit: number;
  customerName: string;
  requestedPercent: number;
  reason: string | null;
  subtotal: number;
  /** What the order would total if this request were approved. */
  totalIfApproved: number;
  createdAt: Date;
}

function applyDiscount(subtotal: number, percent: number): number {
  return subtotal * (1 - percent / 100);
}

export async function listPendingDiscounts(): Promise<DiscountRequestView[]> {
  const rows = await prisma.discountRequest.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    include: {
      seller: { select: { name: true, discountLimit: true } },
      order: { select: { orderNumber: true, subtotal: true, customer: { select: { name: true } } } },
    },
  });

  return rows.map((row) => {
    const subtotal = Number(row.order.subtotal);
    const percent = Number(row.requestedPercent);

    return {
      id: row.id,
      orderId: row.orderId,
      orderNumber: row.order.orderNumber,
      sellerName: row.seller.name,
      sellerLimit: row.seller.discountLimit,
      customerName: row.order.customer.name,
      requestedPercent: percent,
      reason: row.reason,
      subtotal,
      totalIfApproved: applyDiscount(subtotal, percent),
      createdAt: row.createdAt,
    };
  });
}

export type DecisionResult =
  | { ok: true }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "already_decided" };

/**
 * Approves or rejects one request.
 *
 * Approval writes the percent onto the order and recomputes its total in the
 * same transaction as the decision. Two statements could otherwise leave a
 * request marked approved beside an order still priced at the old total, and a
 * seller would quote from whichever they happened to read.
 */
export async function decideDiscount(
  id: string,
  approve: boolean,
  reviewerId: string,
  note: string | null,
): Promise<DecisionResult> {
  const request = await prisma.discountRequest.findUnique({
    where: { id },
    include: { order: { select: { subtotal: true, discountApprovedPercent: true } } },
  });

  if (request === null) {
    return { ok: false, reason: "not_found" };
  }

  if (request.status !== "PENDING") {
    return { ok: false, reason: "already_decided" };
  }

  const percent = Number(request.requestedPercent);
  const subtotal = Number(request.order.subtotal);

  await prisma.$transaction(async (tx) => {
    await tx.discountRequest.update({
      where: { id },
      data: {
        status: approve ? "APPROVED" : "REJECTED",
        reviewedByUserId: reviewerId,
        reviewedAt: new Date(),
        decisionNote: note,
      },
    });

    if (approve) {
      await tx.order.update({
        where: { id: request.orderId },
        data: {
          discountApprovedPercent: percent,
          totalAmount: applyDiscount(subtotal, percent),
        },
      });
    }

    // The seller is waiting on this answer and is not watching the panel.
    await tx.notification.create({
      data: {
        userId: request.sellerId,
        type: "DISCOUNT_DECIDED",
        entityId: request.orderId,
        message: approve
          ? percent + "% chegirma tasdiqlandi."
          : percent + "% chegirma rad etildi." + (note ? " " + note : ""),
      },
    });
  });

  await recordAudit({
    userId: reviewerId,
    action: approve ? "APPROVE" : "REJECT",
    entityType: "DiscountRequest",
    entityId: id,
    before: { status: "PENDING", requestedPercent: percent },
    after: { status: approve ? "APPROVED" : "REJECTED", note },
  });

  return { ok: true };
}

export interface AuditEntryView {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actorName: string | null;
  before: unknown;
  after: unknown;
  createdAt: Date;
}

export interface AuditPage {
  items: AuditEntryView[];
  page: number;
  totalPages: number;
  total: number;
}

export const AUDIT_PAGE_SIZE = 30;

export async function listAudit(page: number, entityType?: string): Promise<AuditPage> {
  const where = entityType ? { entityType } : {};

  const total = await prisma.auditLog.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE));
  const current = Math.min(Math.max(1, page), totalPages);

  const rows = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (current - 1) * AUDIT_PAGE_SIZE,
    take: AUDIT_PAGE_SIZE,
    include: { user: { select: { name: true } } },
  });

  return {
    items: rows.map((row) => ({
      id: row.id,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      // Null once the acting account is deleted; the trail outlives it.
      actorName: row.user?.name ?? null,
      before: row.before,
      after: row.after,
      createdAt: row.createdAt,
    })),
    page: current,
    totalPages,
    total,
  };
}

/** Distinct entity types present, so the filter offers only what exists. */
export async function listAuditEntityTypes(): Promise<string[]> {
  const rows = await prisma.auditLog.findMany({
    distinct: ["entityType"],
    select: { entityType: true },
    orderBy: { entityType: "asc" },
  });
  return rows.map((row) => row.entityType);
}
