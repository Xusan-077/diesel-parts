import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../src/auth/auth.types';

/**
 * Exercises the real PermissionsGuard against the real controllers, without
 * a real login: JwtAuthGuard is overridden to attach a fixed actor to the
 * request, so this is testing the permission boundary itself (the thing
 * Task 4's migration changed), not backend/'s auth/token machinery (already
 * covered elsewhere).
 */
function actorGuard(actor: AuthenticatedUser) {
  return {
    canActivate: (context: ExecutionContext) => {
      const request = context
        .switchToHttp()
        .getRequest<{ user?: AuthenticatedUser }>();
      request.user = actor;
      return true;
    },
  };
}

const seller: AuthenticatedUser = {
  id: 'e2e-seller',
  phone: '998900000001',
  role: 'SELLER',
  sellerId: 'e2e-seller',
};

const director: AuthenticatedUser = {
  id: 'e2e-director',
  phone: null,
  role: 'DIRECTOR',
  sellerId: null,
};

describe('permission boundaries (e2e)', () => {
  let sellerApp: INestApplication<App>;
  let directorApp: INestApplication<App>;

  beforeAll(async () => {
    const sellerModule: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(actorGuard(seller))
      .compile();
    sellerApp = sellerModule.createNestApplication();
    await sellerApp.init();

    const directorModule: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(actorGuard(director))
      .compile();
    directorApp = directorModule.createNestApplication();
    await directorApp.init();
  });

  afterAll(async () => {
    await sellerApp.close();
    await directorApp.close();
  });

  it.each([
    '/finance/summary',
    '/analytics/dashboard-counts',
    '/users',
    '/audit',
  ])('403s a SELLER on %s', async (path) => {
    await request(sellerApp.getHttpServer()).get(path).expect(403);
  });

  it.each([
    '/finance/summary',
    '/analytics/dashboard-counts',
    '/users',
    '/audit',
  ])('lets a DIRECTOR through %s', async (path) => {
    const res = await request(directorApp.getHttpServer()).get(path);
    expect(res.status).not.toBe(403);
  });

  it('grants SELLER products:read on the global /products surface, widened by this migration', async () => {
    const res = await request(sellerApp.getHttpServer()).get('/products');
    expect(res.status).not.toBe(403);
  });

  it('still 403s a SELLER on the products hard-delete route', async () => {
    await request(sellerApp.getHttpServer())
      .delete('/products/nonexistent-id')
      .expect(403);
  });
});
