import axios from "axios";
import { STAFF_LOGIN_PATH } from "@/lib/auth/roles";

/**
 * Ending the session, in one place.
 *
 * There are two controls that do it — the row at the foot of the profile menu,
 * and `SignOutButton`, which is what a future seller profile screen will use —
 * and the failure handling is the part that must not be written twice: the
 * request is *not* awaited into a success path. Whether the endpoint answered
 * or the network dropped, the staff member asked to leave, so the redirect
 * happens either way. A version that only redirected on a 200 would strand
 * someone on a dead connection inside a panel they believe they have left.
 *
 * The caller supplies the router's two methods rather than this importing
 * `useRouter`, so the function stays a plain async function that a test can
 * call without a React tree.
 */
export async function signOutOfPanel(router: {
  replace: (href: string) => void;
  refresh: () => void;
}): Promise<void> {
  try {
    await axios.post("/api/v1/auth/logout");
  } catch {
    // Swallowed on purpose: the cookie either cleared or it did not, and
    // either way the staff member is leaving the panel.
  } finally {
    router.replace(STAFF_LOGIN_PATH);
    router.refresh();
  }
}
