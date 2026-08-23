import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import type { Request } from 'express';

export interface RequestWithVerifiedPhone extends Request {
  verifiedPhone?: string;
}

/** The signature is only trusted within this window of the timestamp it signs. */
const REPLAY_WINDOW_MS = 5 * 60 * 1000;

const HEADER_PHONE = 'x-verified-phone';
const HEADER_TIMESTAMP = 'x-service-timestamp';
const HEADER_SIGNATURE = 'x-service-signature';

/**
 * Authenticates a server-to-server call from Next.js that carries a
 * customer's OTP-verified phone number.
 *
 * The backend has no OTP-session concept of its own — Next.js's server-side
 * code verifies the phone via OTP and then must prove to the backend that
 * the phone it is asserting really came from that verification, not from an
 * arbitrary caller hitting the backend directly. A shared secret both sides
 * hold, combined into an HMAC over `phone:timestamp`, is that proof: only a
 * holder of the secret can produce a signature that matches, and the
 * timestamp bounds how long a captured request stays replayable.
 *
 * On success this sets `request.verifiedPhone` to the phone the signature
 * covers, mirroring how `JwtAuthGuard` sets `request.user` for staff auth.
 */
@Injectable()
export class InternalServiceGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<RequestWithVerifiedPhone>();

    const phone = request.headers[HEADER_PHONE];
    const timestamp = request.headers[HEADER_TIMESTAMP];
    const signature = request.headers[HEADER_SIGNATURE];

    if (
      typeof phone !== 'string' ||
      typeof timestamp !== 'string' ||
      typeof signature !== 'string' ||
      phone.length === 0 ||
      timestamp.length === 0 ||
      signature.length === 0
    ) {
      throw new UnauthorizedException('Missing internal-service headers');
    }

    const timestampMs = Number(timestamp);
    if (
      !Number.isFinite(timestampMs) ||
      Math.abs(Date.now() - timestampMs) > REPLAY_WINDOW_MS
    ) {
      throw new UnauthorizedException(
        'Internal-service timestamp out of window',
      );
    }

    const secret = this.config.getOrThrow<string>('INTERNAL_SERVICE_SECRET');
    const expected = createHmac('sha256', secret)
      .update(`${phone}:${timestamp}`)
      .digest('hex');

    if (!this.signatureMatches(expected, signature)) {
      throw new UnauthorizedException('Invalid internal-service signature');
    }

    request.verifiedPhone = phone;
    return true;
  }

  /**
   * Timing-safe hex comparison — mirrors `hashesEqual` in the root app's
   * `lib/auth/otp-store.ts`. A length mismatch is checked first because
   * `timingSafeEqual` throws (rather than returning false) on unequal
   * buffer lengths, and a mismatched length is not itself secret-derived.
   */
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
