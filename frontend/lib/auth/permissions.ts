/**
 * Mirrors backend/src/common/permissions.ts (structurally, not by import —
 * the two apps are separate deployables with no shared package today, so
 * this table must be kept in sync by hand whenever the backend one changes).
 */
export type PermissionModule =
  | "products"
  | "categories"
  | "customers"
  | "orders"
  | "inquiries"
  | "discounts"
  | "reviews"
  | "warehouse"
  | "finance"
  | "analytics"
  | "users"
  | "audit";

export type PermissionAction = "create" | "read" | "update" | "delete" | "approve";

export type Permission = `${PermissionModule}:${PermissionAction}`;

const SELLER_PERMISSIONS: ReadonlySet<Permission> = new Set<Permission>([
  "products:create",
  "products:read",
  "products:update",
  // No products:delete — backend's hard-delete/import/export stay
  // director-only. See backend/src/common/permissions.ts's own comment.
  "categories:create",
  "categories:read",
  "categories:update",
  "categories:delete",
  "customers:create",
  "customers:read",
  "customers:update",
  // No customers:delete — the global customers.controller.ts's DELETE stays
  // director-only. See backend/src/common/permissions.ts's own comment.
  "orders:create",
  "orders:read",
  "orders:update",
  "orders:delete",
  "inquiries:create",
  "inquiries:read",
  "inquiries:update",
  "inquiries:delete",
  "discounts:create",
  "discounts:read",
  "reviews:read",
  "warehouse:read",
]);

export function can(role: "DIRECTOR" | "SELLER", permission: Permission): boolean {
  if (role === "DIRECTOR") return true;
  return SELLER_PERMISSIONS.has(permission);
}
