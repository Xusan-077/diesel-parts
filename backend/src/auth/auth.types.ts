import { Role } from '../../generated/prisma/client';

export interface AuthenticatedUser {
  id: string;
  phone: string | null;
  role: Role;
  sellerId: string | null;
}

export interface JwtAccessPayload {
  sub: string;
  phone: string | null;
  role: Role;
  sellerId: string | null;
}
