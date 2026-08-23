/**
 * Accepts only a path inside the seller panel. `//evil.example` parses as a
 * valid relative URL to a browser and would leave the site, so a leading
 * double slash is rejected too. Mirrors lib/auth/roles.ts's safeNext for the
 * admin panel, scoped to /seller instead of /admin.
 */
export function safeSellerNext(value: string | string[] | undefined | null): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const isInsidePanel = value.startsWith("/seller") && !value.startsWith("//");
  return isInsidePanel ? value : null;
}
