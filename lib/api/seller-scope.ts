import type { StaffRole } from "@/lib/auth/roles";
import type { Prisma } from "@/prisma/generated/prisma/client";

/**
 * The single place that answers "which rows may this person touch".
 *
 * Every seller-panel query composes its `where` from one of these fragments
 * rather than restating `sellerId === user.id` in each handler: the rule is
 * needed in roughly ten places, and forgetting it in one of them fails open.
 * Pure and dependency-free so the whole table below can be unit-tested without
 * a database.
 */

/** Just enough of the signed-in user to decide visibility. */
export interface ScopeActor {
  id: string;
  role: StaffRole;
}

export function isDirector(actor: ScopeActor): boolean {
  return actor.role === "DIRECTOR";
}

/**
 * Reads are wider than writes.
 *
 * A seller sees the unclaimed pool as well as their own rows — that is what
 * makes claiming possible at all — but may only write to what they own. The
 * one exception is the claim itself, which `unclaimedScope` guards.
 */
export function inquiryReadScope(actor: ScopeActor): Prisma.InquiryWhereInput {
  return isDirector(actor) ? {} : { OR: [{ assignedSellerId: actor.id }, { assignedSellerId: null }] };
}

export function inquiryWriteScope(actor: ScopeActor): Prisma.InquiryWhereInput {
  return isDirector(actor) ? {} : { assignedSellerId: actor.id };
}

/**
 * A seller's customer book is their own by default. The unassigned pool is a
 * separate tab rather than part of the default list, so the book stays the
 * seller's own working set instead of everybody's leftovers.
 */
export function customerReadScope(
  actor: ScopeActor,
  options: { includePool?: boolean } = {},
): Prisma.CustomerWhereInput {
  if (isDirector(actor)) {
    return {};
  }
  return options.includePool
    ? { OR: [{ assignedSellerId: actor.id }, { assignedSellerId: null }] }
    : { assignedSellerId: actor.id };
}

export function customerWriteScope(actor: ScopeActor): Prisma.CustomerWhereInput {
  return isDirector(actor) ? {} : { assignedSellerId: actor.id };
}

/** Orders are never pooled: one always belongs to the seller who raised it. */
export function orderReadScope(actor: ScopeActor): Prisma.OrderWhereInput {
  return isDirector(actor) ? {} : { sellerId: actor.id };
}

export function orderWriteScope(actor: ScopeActor): Prisma.OrderWhereInput {
  return orderReadScope(actor);
}

/**
 * The guard a claim writes through, for every role.
 *
 * Claiming is the only write allowed against a row nobody owns, and it is
 * allowed exactly while the row is still unowned. Directors get no exemption:
 * a director claiming an already-claimed lead would silently take it from the
 * seller working it.
 */
export function unclaimedScope(): { assignedSellerId: null } {
  return { assignedSellerId: null };
}
