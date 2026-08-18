import { redirect } from "next/navigation";
import { adminHomePath } from "@/lib/auth/roles";
import { requireStaff } from "@/lib/auth/dal";

/**
 * A signpost. The proxy already forwards `/admin`, but a bookmark that arrives
 * with a stale cookie would otherwise render an empty page.
 */
export default async function AdminIndexPage() {
  const user = await requireStaff();
  redirect(adminHomePath(user.role));
}
