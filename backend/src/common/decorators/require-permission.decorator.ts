import { SetMetadata } from '@nestjs/common';
import type { Permission } from '../permissions';

export const PERMISSION_KEY = 'permission';

/** Restricts an endpoint to callers `can()` grants this permission to. Combine with JwtAuthGuard + PermissionsGuard. */
export const RequirePermission = (permission: Permission) =>
  SetMetadata(PERMISSION_KEY, permission);
