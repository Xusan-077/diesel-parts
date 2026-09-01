import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { Role } from '../../../generated/prisma/client';

function makeContext(user: { role: Role } | undefined) {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => ({}) as never,
    getClass: () => ({}) as never,
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  it('allows access when no @Roles() metadata is present', () => {
    const reflector = {
      getAllAndOverride: () => undefined,
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(makeContext({ role: Role.SELLER }))).toBe(true);
  });

  it('denies a role not in the required list', () => {
    const reflector = {
      getAllAndOverride: () => [Role.DIRECTOR],
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(() => guard.canActivate(makeContext({ role: Role.SELLER }))).toThrow(
      ForbiddenException,
    );
  });

  it('allows a role that is in the required list', () => {
    const reflector = {
      getAllAndOverride: () => [Role.SELLER, Role.DIRECTOR],
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(makeContext({ role: Role.SELLER }))).toBe(true);
  });

  it('denies when there is no authenticated user', () => {
    const reflector = {
      getAllAndOverride: () => [Role.SELLER],
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(() => guard.canActivate(makeContext(undefined))).toThrow(
      ForbiddenException,
    );
  });
});
