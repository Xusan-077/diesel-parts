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

/**
 * A staff-raised order still belongs to the seller who raised it. A
 * self-checkout order (channel ONLINE) has no such relationship to start
 * with — it is assigned to a house account purely so sellerId stays required
 * — so it is read-pooled for every seller instead, the same way an unclaimed
 * Customer or Inquiry is.
 *
 * Writes stay narrower than reads, same as Customer and Inquiry above: a
 * seller may see the whole ONLINE queue to work out what needs picking up,
 * but may not mutate (status, discount, items) an order until it is theirs.
 * There is no claim step for orders yet — that lands with the plan that
 * builds the queue UI — so today an ONLINE order is only writable by
 * whichever seller its sellerId actually names, exactly as a staff order
 * always was.
 */
export function orderReadScope(actor: ScopeActor): Prisma.OrderWhereInput {
  return isDirector(actor) ? {} : { OR: [{ sellerId: actor.id }, { channel: "ONLINE" }] };
}

export function orderWriteScope(actor: ScopeActor): Prisma.OrderWhereInput {
  return isDirector(actor) ? {} : { sellerId: actor.id };
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
