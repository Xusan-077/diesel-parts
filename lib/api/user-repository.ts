import "server-only";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/db";
import { recordAudit } from "./audit";
import type { UserCreateInput, UserUpdateInput } from "@/lib/schemas";
import type { StaffRole } from "@/lib/auth/roles";

const BCRYPT_COST = 12;

export interface StaffRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: StaffRole;
  isActive: boolean;
  discountLimit: number;
  createdAt: Date;
  /** Completed orders this account has closed, so a director sees who is active. */
  completedOrders: number;
}

export async function listStaff(): Promise<StaffRow[]> {
  const [users, orderCounts] = await Promise.all([
    prisma.user.findMany({ orderBy: [{ isActive: "desc" }, { name: "asc" }] }),
    prisma.order.groupBy({
      by: ["sellerId"],
      where: { status: "COMPLETED" },
      _count: { _all: true },
    }),
  ]);

  const ordersBySeller = new Map(orderCounts.map((row) => [row.sellerId, row._count._all]));

  return users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    isActive: user.isActive,
    discountLimit: user.discountLimit,
    createdAt: user.createdAt,
    completedOrders: ordersBySeller.get(user.id) ?? 0,
  }));
}

export type UserWriteResult =
  | { ok: true; id: string }
  | { ok: false; reason: "duplicate_email" }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "last_director" };

export async function createStaff(
  input: UserCreateInput,
  actorId: string,
): Promise<UserWriteResult> {
  const email = input.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing !== null) {
    return { ok: false, reason: "duplicate_email" };
  }

  const created = await prisma.user.create({
    data: {
      name: input.name,
      email,
      phone: input.phone?.trim() || null,
      passwordHash: await hash(input.password, BCRYPT_COST),
      role: input.role,
      discountLimit: input.discountLimit,
    },
  });

  await recordAudit({
    userId: actorId,
    action: "CREATE",
    entityType: "User",
    entityId: created.id,
    // The hash never reaches the audit trail.
    after: { name: created.name, email: created.email, role: created.role },
  });

  return { ok: true, id: created.id };
}

/**
 * Counts directors other than `excludeId` who could still sign in.
 *
 * Guards the one change that locks everybody out: the last director demoting or
 * deactivating themselves. There is no recovery path from that short of a
 * database console.
 */
async function otherActiveDirectors(excludeId: string): Promise<number> {
  return prisma.user.count({
    where: { role: "DIRECTOR", isActive: true, id: { not: excludeId } },
  });
}

export async function updateStaff(
  id: string,
  input: UserUpdateInput,
  actorId: string,
): Promise<UserWriteResult> {
  const before = await prisma.user.findUnique({ where: { id } });

  if (before === null) {
    return { ok: false, reason: "not_found" };
  }

  const losingDirector =
    before.role === "DIRECTOR" && (input.role !== "DIRECTOR" || !input.isActive);

  if (losingDirector && (await otherActiveDirectors(id)) === 0) {
    return { ok: false, reason: "last_director" };
  }

  const after = await prisma.user.update({
    where: { id },
    data: {
      name: input.name,
      phone: input.phone?.trim() || null,
      role: input.role,
      discountLimit: input.discountLimit,
      isActive: input.isActive,
    },
  });

  await recordAudit({
    userId: actorId,
    action: "UPDATE",
    entityType: "User",
    entityId: id,
    before: {
      name: before.name,
      role: before.role,
      isActive: before.isActive,
      discountLimit: before.discountLimit,
    },
    after: {
      name: after.name,
      role: after.role,
      isActive: after.isActive,
      discountLimit: after.discountLimit,
    },
  });

  return { ok: true, id };
}
