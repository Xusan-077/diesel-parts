import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/prisma/generated/prisma/client";
import type { AuditAction } from "@/prisma/generated/prisma/enums";

export interface AuditEntry {
  /** Null for an action taken before anyone was identified, such as a failed login. */
  userId: string | null;
  action: AuditAction;
  entityType: string;
  entityId: string;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
}

/**
 * Writes one line of the audit trail.
 *
 * Never throws: an audit write failing must not turn a completed action into an
 * error the user sees, and must not roll back the thing that was audited. The
 * failure is logged so it can still be noticed.
 */
export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: entry.userId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        before: entry.before,
        after: entry.after,
      },
    });
  } catch (error) {
    console.error("[audit] failed to record", entry.action, entry.entityType, error);
  }
}
