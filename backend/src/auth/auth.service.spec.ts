import * as bcrypt from 'bcrypt';
import { UnauthorizedException, HttpException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { resetLoginThrottle } from './login-throttle';

function makePrisma(overrides: { user?: Record<string, unknown> } = {}) {
  return {
    user: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      ...overrides.user,
    },
    refreshToken: {
      create: jest.fn().mockResolvedValue(undefined),
    },
  } as unknown as PrismaService;
}

function makeJwt(): JwtService {
  return {
    signAsync: jest.fn().mockResolvedValue('signed.jwt.token'),
    verifyAsync: jest.fn(),
  } as unknown as JwtService;
}

function makeConfig(overrides: Record<string, string> = {}): ConfigService {
  const values: Record<string, string> = {
    JWT_ACCESS_SECRET: 'access-secret',
    JWT_REFRESH_SECRET: 'refresh-secret',
    JWT_ACCESS_EXPIRES_IN: '15m',
    JWT_REFRESH_EXPIRES_IN: '7d',
    ...overrides,
  };
  return {
    getOrThrow: jest.fn((key: string) => values[key]),
    get: jest.fn((key: string, fallback?: string) => values[key] ?? fallback),
  } as unknown as ConfigService;
}

describe('AuthService.login', () => {
  beforeEach(() => {
    resetLoginThrottle();
  });

  it('logs in by email when the account has no phone', async () => {
    const email = 'director@example.uz';
    const passwordHash = await bcrypt.hash('secret123', 10);
    const findFirst = jest.fn().mockResolvedValue({
      id: 'u1',
      phone: null,
      email,
      passwordHash,
      role: 'DIRECTOR',
      isActive: true,
      name: 'Director',
      discountLimit: 5,
    } as any);
    const prisma = makePrisma({ user: { findFirst } });
    const service = new AuthService(prisma, makeJwt(), makeConfig());

    const result = await service.login(email, 'secret123');

    expect(findFirst).toHaveBeenCalledWith({
      where: { OR: [{ phone: email }, { email: email.toLowerCase() }] },
      include: { seller: true },
    });
    expect(result.user.role).toBe('DIRECTOR');
  });

  it('logs in by phone as before', async () => {
    const phone = '998901234567';
    const passwordHash = await bcrypt.hash('secret123', 10);
    const findFirst = jest.fn().mockResolvedValue({
      id: 'u2',
      phone,
      email: null,
      passwordHash,
      role: 'SELLER',
      isActive: true,
      name: 'Seller',
      discountLimit: 5,
      seller: { id: 'seller-1', warehouseId: 'w1' },
    } as any);
    const prisma = makePrisma({ user: { findFirst } });
    const service = new AuthService(prisma, makeJwt(), makeConfig());

    const result = await service.login(phone, 'secret123');

    expect(findFirst).toHaveBeenCalledWith({
      where: { OR: [{ phone }, { email: phone.toLowerCase() }] },
      include: { seller: true },
    });
    expect(result.user.sellerId).toBe('seller-1');
  });

  it('normalizes an uppercase email identifier before matching', async () => {
    const passwordHash = await bcrypt.hash('secret123', 10);
    const findFirst = jest.fn().mockResolvedValue({
      id: 'u1',
      phone: null,
      email: 'director@example.uz',
      passwordHash,
      role: 'DIRECTOR',
      isActive: true,
    } as any);
    const prisma = makePrisma({ user: { findFirst } });
    const service = new AuthService(prisma, makeJwt(), makeConfig());

    await service.login('Director@Example.UZ', 'secret123');

    expect(findFirst).toHaveBeenCalledWith({
      where: {
        OR: [
          { phone: 'Director@Example.UZ' },
          { email: 'director@example.uz' },
        ],
      },
      include: { seller: true },
    });
  });

  it('rejects an unknown identifier', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const prisma = makePrisma({ user: { findFirst } });
    const service = new AuthService(prisma, makeJwt(), makeConfig());

    await expect(
      service.login('nobody@example.uz', 'secret123'),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a wrong password', async () => {
    const passwordHash = await bcrypt.hash('correct-password', 10);
    const findFirst = jest.fn().mockResolvedValue({
      id: 'u1',
      phone: null,
      email: 'director@example.uz',
      passwordHash,
      role: 'DIRECTOR',
      isActive: true,
    } as any);
    const prisma = makePrisma({ user: { findFirst } });
    const service = new AuthService(prisma, makeJwt(), makeConfig());

    await expect(
      service.login('director@example.uz', 'wrong-password'),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a deactivated account', async () => {
    const passwordHash = await bcrypt.hash('secret123', 10);
    const findFirst = jest.fn().mockResolvedValue({
      id: 'u1',
      phone: null,
      email: 'director@example.uz',
      passwordHash,
      role: 'DIRECTOR',
      isActive: false,
    } as any);
    const prisma = makePrisma({ user: { findFirst } });
    const service = new AuthService(prisma, makeJwt(), makeConfig());

    await expect(
      service.login('director@example.uz', 'secret123'),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('throttles after repeated failed attempts for the same identifier', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const prisma = makePrisma({ user: { findFirst } });
    const service = new AuthService(prisma, makeJwt(), makeConfig());
    const identifier = 'attacker@example.uz';

    for (let i = 0; i < 5; i += 1) {
      await expect(service.login(identifier, 'wrong')).rejects.toThrow(
        UnauthorizedException,
      );
    }

    await expect(service.login(identifier, 'wrong')).rejects.toThrow(
      HttpException,
    );
    // The 6th attempt should be blocked by the throttle before even
    // looking the user up again.
    expect(findFirst).toHaveBeenCalledTimes(5);
  });

  it('clears the throttle count after a successful login', async () => {
    const passwordHash = await bcrypt.hash('secret123', 10);
    const findFirst = jest.fn().mockResolvedValue({
      id: 'u1',
      phone: null,
      email: 'director@example.uz',
      passwordHash,
      role: 'DIRECTOR',
      isActive: true,
    } as any);
    const prisma = makePrisma({ user: { findFirst } });
    const service = new AuthService(prisma, makeJwt(), makeConfig());
    const identifier = 'director@example.uz';

    for (let i = 0; i < 4; i += 1) {
      findFirst.mockResolvedValueOnce(null);
      await expect(service.login(identifier, 'wrong')).rejects.toThrow(
        UnauthorizedException,
      );
    }

    // 5th attempt succeeds and should clear the failure count.
    await service.login(identifier, 'secret123');

    // A subsequent failed attempt should not be throttled yet (count reset).
    findFirst.mockResolvedValueOnce(null);
    await expect(service.login(identifier, 'wrong')).rejects.toThrow(
      UnauthorizedException,
    );
  });
});

describe('AuthService.me', () => {
  it('selects name, email, and discountLimit alongside the existing fields', async () => {
    const findUniqueOrThrow = jest.fn().mockResolvedValue({
      id: 'u1',
      phone: null,
      email: 'director@example.uz',
      name: 'Director',
      role: 'DIRECTOR',
      isActive: true,
      discountLimit: 100,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      seller: null,
    });
    const prisma = makePrisma({ user: { findUniqueOrThrow } });
    const service = new AuthService(prisma, makeJwt(), makeConfig());

    const result = await service.me('u1');

    expect(findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: 'u1' },
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
    expect(result.email).toBe('director@example.uz');
    expect(result.name).toBe('Director');
    expect(result.discountLimit).toBe(100);
  });
});
