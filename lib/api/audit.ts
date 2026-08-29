import "server-only";
import { backendRequest } from "./backend-client";
import { getStaffSession } from "@/lib/auth/staff-session";

export type AuditAction = "CREATE" | "UPDATE" | "DELETE" | "APPROVE" | "REJECT" | "IMPORT" | "LOGIN";

export interface AuditEntry {
  /** Null for an action taken before anyone was identified, such as a failed login. */
  userId: string | null;
  action: AuditAction;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  /**
   * Overrides the access token backend/'s write is authenticated with.
   * Only needed at login: the staff cookie that `getStaffSession` would
   * otherwise read isn't set on the request until after this call returns,
   * so the freshly-minted token has to be passed in by hand.
   */
  accessToken?: string;
}

/**
 * Writes one line of the audit trail through backend/'s own `AuditService`
 * (`POST /audit`, Part 1 Task 4 + this task's addition).
 *
 * `entry.userId` is not sent: backend/ always attributes the write to
 * whoever the access token belongs to, never a client-supplied id, so this
 * only writes when a token is available — the field stays on `AuditEntry`
 * because every call site already passes the acting user's own id (the same
 * one the token belongs to), and dropping it would be a needless signature
 * change to every caller for no behavior difference.
 *
 * Never throws: an audit write failing must not turn a completed action into
 * an error the user sees, and must not roll back the thing that was audited.
 * The failure is logged so it can still be noticed.
 */
export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    const accessToken = entry.accessToken ?? (await getStaffSession())?.accessToken;
    if (!accessToken) {
      console.error("[audit] failed to record", entry.action, entry.entityType, "no staff session");
      return;
    }

    await backendRequest("/audit", {
      method: "POST",
      accessToken,
      body: {
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
