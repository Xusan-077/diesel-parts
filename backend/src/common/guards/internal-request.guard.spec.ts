import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import type { Request } from 'express';
import { InternalRequestGuard } from './internal-request.guard';

const SECRET = 'test-secret';

function sign(timestamp: string): string {
  return createHmac('sha256', SECRET)
    .update(`internal-request:${timestamp}`)
    .digest('hex');
}

function makeContext(headers: Record<string, string | undefined>) {
  const request = { headers } as unknown as Request;

  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}) as never,
    getClass: () => ({}) as never,
  } as unknown as ExecutionContext;
}

function makeConfig() {
  return { getOrThrow: () => SECRET } as unknown as ConfigService;
}

describe('InternalRequestGuard', () => {
  it('passes for a valid signature within the time window', () => {
    const timestamp = String(Date.now());
    const context = makeContext({
      'x-service-timestamp': timestamp,
      'x-service-signature': sign(timestamp),
    });
    const guard = new InternalRequestGuard(makeConfig());

    expect(guard.canActivate(context)).toBe(true);
  });

  it('rejects when x-service-timestamp is missing', () => {
    const context = makeContext({
      'x-service-signature': sign(String(Date.now())),
    });
    const guard = new InternalRequestGuard(makeConfig());

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('rejects when x-service-signature is missing', () => {
    const context = makeContext({
      'x-service-timestamp': String(Date.now()),
    });
    const guard = new InternalRequestGuard(makeConfig());

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('rejects a wrong signature', () => {
    const timestamp = String(Date.now());
    const context = makeContext({
      'x-service-timestamp': timestamp,
      'x-service-signature': 'a'.repeat(64),
    });
    const guard = new InternalRequestGuard(makeConfig());

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('rejects a timestamp 6 minutes in the past', () => {
    const timestamp = String(Date.now() - 6 * 60 * 1000);
    const context = makeContext({
      'x-service-timestamp': timestamp,
      'x-service-signature': sign(timestamp),
    });
    const guard = new InternalRequestGuard(makeConfig());

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('rejects a timestamp 6 minutes in the future', () => {
    const timestamp = String(Date.now() + 6 * 60 * 1000);
    const context = makeContext({
      'x-service-timestamp': timestamp,
      'x-service-signature': sign(timestamp),
    });
    const guard = new InternalRequestGuard(makeConfig());

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });
});
