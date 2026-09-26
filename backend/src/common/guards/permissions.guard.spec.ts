import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';
import { Role } from '../../../generated/prisma/client';

function makeContext(user: { role: Role } | undefined) {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => ({}) as never,
    getClass: () => ({}) as never,
  } as unknown as ExecutionContext;
}

describe('PermissionsGuard', () => {
  it('allows the request through when no @RequirePermission is set', () => {
    const reflector = { getAllAndOverride: () => undefined } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);
    expect(guard.canActivate(makeContext({ role: Role.SELLER }))).toBe(true);
  });

  it('allows a DIRECTOR through any permission', () => {
    const reflector = { getAllAndOverride: () => 'finance:read' } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);
    expect(guard.canActivate(makeContext({ role: Role.DIRECTOR }))).toBe(true);
  });

  it('403s a SELLER missing the permission', () => {
    const reflector = { getAllAndOverride: () => 'finance:read' } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);
    expect(() => guard.canActivate(makeContext({ role: Role.SELLER }))).toThrow(
      ForbiddenException,
    );
  });

  it('denies when there is no authenticated user', () => {
    const reflector = { getAllAndOverride: () => 'orders:read' } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);
    expect(() => guard.canActivate(makeContext(undefined))).toThrow(ForbiddenException);
  });

  it('403s — not throws unexpectedly — on an unrecognized role value on the token', () => {
    const reflector = { getAllAndOverride: () => 'orders:read' } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);
    expect(() =>
      guard.canActivate(makeContext({ role: 'MANAGER' as unknown as Role })),
    ).toThrow(ForbiddenException);
  });
});
