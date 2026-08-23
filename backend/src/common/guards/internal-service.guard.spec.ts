import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import {
  InternalServiceGuard,
  RequestWithVerifiedPhone,
} from './internal-service.guard';

const SECRET = 'test-secret';

function sign(phone: string, timestamp: string): string {
  return createHmac('sha256', SECRET)
    .update(`${phone}:${timestamp}`)
    .digest('hex');
}

function makeContext(headers: Record<string, string | undefined>) {
  const request: RequestWithVerifiedPhone = {
    headers,
  } as unknown as RequestWithVerifiedPhone;

  return {
    context: {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => ({}) as never,
      getClass: () => ({}) as never,
    } as unknown as ExecutionContext,
    request,
  };
}

function makeConfig() {
  return {
    getOrThrow: () => SECRET,
  } as unknown as ConfigService;
}

describe('InternalServiceGuard', () => {
  it('passes and sets request.verifiedPhone for a valid signature within the time window', () => {
    const phone = '998901234567';
    const timestamp = String(Date.now());
    const { context, request } = makeContext({
      'x-verified-phone': phone,
      'x-service-timestamp': timestamp,
      'x-service-signature': sign(phone, timestamp),
    });
    const guard = new InternalServiceGuard(makeConfig());

    expect(guard.canActivate(context)).toBe(true);
    expect(request.verifiedPhone).toBe(phone);
  });

  it('rejects when x-verified-phone is missing', () => {
    const timestamp = String(Date.now());
    const { context } = makeContext({
      'x-service-timestamp': timestamp,
      'x-service-signature': sign('998901234567', timestamp),
    });
    const guard = new InternalServiceGuard(makeConfig());

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('rejects when x-service-timestamp is missing', () => {
    const phone = '998901234567';
    const { context } = makeContext({
      'x-verified-phone': phone,
      'x-service-signature': sign(phone, String(Date.now())),
    });
    const guard = new InternalServiceGuard(makeConfig());

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('rejects when x-service-signature is missing', () => {
    const phone = '998901234567';
    const timestamp = String(Date.now());
    const { context } = makeContext({
      'x-verified-phone': phone,
      'x-service-timestamp': timestamp,
    });
    const guard = new InternalServiceGuard(makeConfig());

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('rejects a wrong signature', () => {
    const phone = '998901234567';
    const timestamp = String(Date.now());
    const { context } = makeContext({
      'x-verified-phone': phone,
      'x-service-timestamp': timestamp,
      'x-service-signature': sign('998900000000', timestamp),
    });
    const guard = new InternalServiceGuard(makeConfig());

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('rejects a timestamp 6 minutes in the past', () => {
    const phone = '998901234567';
    const timestamp = String(Date.now() - 6 * 60 * 1000);
    const { context } = makeContext({
      'x-verified-phone': phone,
      'x-service-timestamp': timestamp,
      'x-service-signature': sign(phone, timestamp),
    });
    const guard = new InternalServiceGuard(makeConfig());

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('rejects a timestamp 6 minutes in the future', () => {
    const phone = '998901234567';
    const timestamp = String(Date.now() + 6 * 60 * 1000);
    const { context } = makeContext({
      'x-verified-phone': phone,
      'x-service-timestamp': timestamp,
      'x-service-signature': sign(phone, timestamp),
    });
    const guard = new InternalServiceGuard(makeConfig());

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });
});
