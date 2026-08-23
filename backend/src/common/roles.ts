import { Role } from '../../generated/prisma/client';

/** Higher number = more privilege. SUPER_ADMIN > DIRECTOR > MANAGER > SELLER > VIEWER. */
export const ROLE_RANK: Record<Role, number> = {
  VIEWER: 0,
  SELLER: 1,
  MANAGER: 2,
  DIRECTOR: 3,
  SUPER_ADMIN: 4,
};

export function roleAtLeast(role: Role, minimum: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

export const ALL_ROLES: Role[] = [
  'SUPER_ADMIN',
  'DIRECTOR',
  'MANAGER',
  'SELLER',
  'VIEWER',
];
export const MANAGER_UP: Role[] = ['SUPER_ADMIN', 'DIRECTOR', 'MANAGER'];
export const DIRECTOR_UP: Role[] = ['SUPER_ADMIN', 'DIRECTOR'];
export const SELLER_UP: Role[] = [
  'SUPER_ADMIN',
  'DIRECTOR',
  'MANAGER',
  'SELLER',
];
