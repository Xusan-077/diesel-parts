import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import type { Request } from 'express';

/**
 * Payme authenticates its calls to the merchant endpoint with HTTP Basic
 * Auth: `Authorization: Basic base64("Paycom:" + merchant key)`. Confirmed
 * against the PaycomUZ organization's own paycom-integration-php-template
 * README this session (its example header decodes to exactly that shape).
 */
@Injectable()
export class PaymeAuthGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers.authorization;

    if (typeof header !== 'string' || !header.startsWith('Basic ')) {
      throw new UnauthorizedException('Missing Payme Authorization header');
    }

    const key = this.config.getOrThrow<string>('PAYME_MERCHANT_KEY');
    const expected = Buffer.from(`Paycom:${key}`, 'utf-8');
    const actual = Buffer.from(header.slice('Basic '.length), 'base64');

    if (
      expected.length !== actual.length ||
      !timingSafeEqual(expected, actual)
    ) {
      throw new UnauthorizedException('Invalid Payme credentials');
    }

    return true;
  }
}
