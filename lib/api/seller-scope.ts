import type { StaffRole } from "@/lib/auth/roles";

/**
 * Just enough of the signed-in user to decide visibility.
 *
 * The scoping rules that used to live in this file (`isDirector`,
 * `orderReadScope`, `customerReadScope`, `inquiryReadScope`, `unclaimedScope`,
 * ...) moved to `backend/src/common/scope.ts` once every seller-panel/director
 * repository here was rewired to call backend/ over HTTP instead of querying
 * Prisma directly — backend now enforces them server-side, so this file's
 * job shrank to the one type several repositories still share.
 */
export interface ScopeActor {
  id: string;
  role: StaffRole;
}
