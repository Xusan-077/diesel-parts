import { Role } from '../../generated/prisma/client';

export type PermissionModule =
  | 'products'
  | 'categories'
  | 'customers'
  | 'orders'
  | 'inquiries'
  | 'discounts'
  | 'reviews'
  | 'warehouse'
  | 'finance'
  | 'analytics'
  | 'users'
  | 'audit';

export type PermissionAction =
  'create' | 'read' | 'update' | 'delete' | 'approve';

export type Permission = `${PermissionModule}:${PermissionAction}`;

/**
 * SELLER's explicit allow-list. DIRECTOR is a wildcard (see `can` below)
 * rather than a mirrored list here — spelling out "director: everything" as
 * repeated entries would drift the moment a permission is added and nobody
 * touches this file.
 *
 * Mirrored (structurally, not by import) in frontend/lib/auth/permissions.ts —
 * the two apps are separate deployables with no shared package today, so this
 * table and that one must be kept in sync by hand. See that file's own header
 * comment.
 */
const SELLER_PERMISSIONS: ReadonlySet<Permission> = new Set<Permission>([
  'products:create',
  'products:read',
  'products:update',
  // No products:delete: hard-delete/delete-check/import/export in
  // products.controller.ts are deliberately director-only (cost-data and
  // audit-history implications) — see that controller's own doc comments.
  // Seller-facing seller-products.controller.ts has no delete route today.
  'categories:create',
  'categories:read',
  'categories:update',
  'categories:delete',
  'customers:create',
  'customers:read',
  'customers:update',
  // No customers:delete: the unscoped customers.controller.ts's DELETE stays
  // director-only by design — a seller's own writes go through the already-
  // scoped seller-customers.controller.ts, which has no delete route.
  'orders:create',
  'orders:read',
  'orders:update',
  'orders:delete',
  'inquiries:create',
  'inquiries:read',
  'inquiries:update',
  'inquiries:delete',
  'discounts:create',
  'discounts:read',
  'reviews:read',
  'warehouse:read',
]);

export function can(role: Role, permission: Permission): boolean {
  if (role === 'DIRECTOR') return true;
  if (role === 'SELLER') return SELLER_PERMISSIONS.has(permission);
  return false; // unknown/legacy role value on a stale token — fail closed, not throw
}
