import { Role } from '../../generated/prisma/client';

/**
 * Higher number = more privilege. DIRECTOR > SELLER.
 * NOTE: production's `Role` enum currently has only DIRECTOR and SELLER.
 * MANAGER / VIEWER / SUPER_ADMIN are re-introduced in schema-alignment step 2
 * (`ALTER TYPE ... ADD VALUE`); the gap in the rank numbers is left for them.
 */
export const ROLE_RANK: Record<Role, number> = {
  SELLER: 1,
  DIRECTOR: 3,
};

export function roleAtLeast(role: Role, minimum: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

export const ALL_ROLES: Role[] = ['DIRECTOR', 'SELLER'];
export const MANAGER_UP: Role[] = ['DIRECTOR'];
export const DIRECTOR_UP: Role[] = ['DIRECTOR'];
export const SELLER_UP: Role[] = ['DIRECTOR', 'SELLER'];
