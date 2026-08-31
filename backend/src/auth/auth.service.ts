import {
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import ms from '../common/ms';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser, JwtAccessPayload } from './auth.types';
import {
  checkLoginAllowed,
  clearLoginFailures,
  recordLoginFailure,
} from './login-throttle';

interface RefreshJwtPayload {
  sub: string;
  jti: string;
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  refreshExpiresIn: string;
  user: AuthenticatedUser;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /**
   * `identifier` is the DTO's `phone` field, kept under that name so the
   * seller panel's existing `{ phone, password }` login request body
   * (`lib/api/seller-panel/auth.ts`) doesn't need to change — but it now
   * accepts either a phone number or an email address, since accounts such
   * as `director@dieselparts.uz` have no phone on file.
   */
  async login(identifier: string, password: string): Promise<AuthResult> {
    const throttleKey = identifier.toLowerCase();
    const allowed = checkLoginAllowed(throttleKey);
    if (!allowed.ok) {
      throw new HttpException(
        {
          message: 'Too many attempts. Try again later.',
          retryAfterSeconds: allowed.retryAfterSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ phone: identifier }, { email: identifier.toLowerCase() }],
      },
      include: { seller: true },
    });

    if (!user || !user.isActive) {
      recordLoginFailure(throttleKey);
      throw new UnauthorizedException('Invalid phone or password');
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      recordLoginFailure(throttleKey);
      throw new UnauthorizedException('Invalid phone or password');
    }

    clearLoginFailures(throttleKey);

    return this.issueTokens(
      user.id,
      user.phone,
      user.role,
      user.seller?.id ?? null,
    );
  }

  async refresh(rawRefreshToken: string): Promise<AuthResult> {
    let payload: RefreshJwtPayload;
    try {
      payload = await this.jwt.verifyAsync<RefreshJwtPayload>(rawRefreshToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const stored = await this.prisma.refreshToken.findUnique({
      where: { id: payload.jti },
    });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException(
        'Refresh token has been revoked or expired',
      );
    }

    const matches = await bcrypt.compare(rawRefreshToken, stored.tokenHash);
    if (!matches) {
      throw new UnauthorizedException('Refresh token does not match');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: stored.userId },
      include: { seller: true },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User is no longer active');
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens(
      user.id,
      user.phone,
      user.role,
      user.seller?.id ?? null,
    );
  }

  async logout(userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { success: true };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        phone: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        discountLimit: true,
        createdAt: true,
        updatedAt: true,
        seller: { select: { id: true, warehouseId: true } },
      },
    });
    return user;
  }

  private async issueTokens(
    userId: string,
    phone: string | null,
    role: JwtAccessPayload['role'],
    sellerId: string | null,
  ): Promise<AuthResult> {
    const accessPayload: JwtAccessPayload = {
      sub: userId,
      phone,
      role,
      sellerId,
    };
    const accessToken = await this.jwt.signAsync(accessPayload, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.config.get<string>('JWT_ACCESS_EXPIRES_IN', '15m'),
    } as JwtSignOptions);

    const refreshExpiresIn = this.config.get<string>(
      'JWT_REFRESH_EXPIRES_IN',
      '7d',
    );
    const jti = randomUUID();
    const refreshToken = await this.jwt.signAsync({ sub: userId, jti }, {
      secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: refreshExpiresIn,
    } as JwtSignOptions);

    const tokenHash = await bcrypt.hash(refreshToken, 10);
    await this.prisma.refreshToken.create({
      data: {
        id: jti,
        userId,
        tokenHash,
        expiresAt: new Date(Date.now() + ms(refreshExpiresIn)),
      },
    });

    return {
      accessToken,
      refreshToken,
      refreshExpiresIn,
      user: { id: userId, phone, role, sellerId },
    };
  }
}
