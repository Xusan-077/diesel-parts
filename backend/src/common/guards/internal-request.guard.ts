import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import type { Request } from 'express';

/** The signature is only trusted within this window of the timestamp it signs. */
const REPLAY_WINDOW_MS = 5 * 60 * 1000;

const HEADER_TIMESTAMP = 'x-service-timestamp';
const HEADER_SIGNATURE = 'x-service-signature';

/** What the signature covers — fixed, unlike `InternalServiceGuard`'s phone claim. */
const SIGNED_PAYLOAD = 'internal-request';

/**
 * Authenticates a server-to-server call from the Next.js app (director/admin
 * panel) that carries no claim of its own — just proof of holding
 * `INTERNAL_SERVICE_SECRET`.
 *
 * Distinct from `InternalServiceGuard`: that one binds a signature to a
 * customer's OTP-verified phone number, because the thing being asserted is
 * "this phone was verified". Here there is nothing to assert beyond "this
 * request really came from our Next.js server" — the director's own
 * authorization already happened there (`authenticateDirector()`), so this
 * guard's only job is proving the caller holds the shared secret. Both guards
 * read the same `INTERNAL_SERVICE_SECRET`, matching its `.env.example`
 * documentation ("shared secret Next.js and the backend both hold").
 */
@Injectable()
export class InternalRequestGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    const timestamp = request.headers[HEADER_TIMESTAMP];
    const signature = request.headers[HEADER_SIGNATURE];

    if (
      typeof timestamp !== 'string' ||
      typeof signature !== 'string' ||
      timestamp.length === 0 ||
      signature.length === 0
    ) {
      throw new UnauthorizedException('Missing internal-request headers');
    }

    const timestampMs = Number(timestamp);
    if (
      !Number.isFinite(timestampMs) ||
      Math.abs(Date.now() - timestampMs) > REPLAY_WINDOW_MS
    ) {
      throw new UnauthorizedException(
        'Internal-request timestamp out of window',
      );
    }

    const secret = this.config.getOrThrow<string>('INTERNAL_SERVICE_SECRET');
    const expected = createHmac('sha256', secret)
      .update(`${SIGNED_PAYLOAD}:${timestamp}`)
      .digest('hex');

    if (!this.signatureMatches(expected, signature)) {
      throw new UnauthorizedException('Invalid internal-request signature');
    }

    return true;
  }

  /** Timing-safe hex comparison — mirrors `InternalServiceGuard`'s. */
  private signatureMatches(expectedHex: string, actualHex: string): boolean {
    let expected: Buffer;
    let actual: Buffer;
    try {
      expected = Buffer.from(expectedHex, 'hex');
      actual = Buffer.from(actualHex, 'hex');
    } catch {
      return false;
    }

    return (
      expected.length === actual.length && timingSafeEqual(expected, actual)
    );
  }
}
