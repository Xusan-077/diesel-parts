# Role simplification (DIRECTOR/SELLER only) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Execution note for this run:** executed Native (single session), not subagent-driven, per CLAUDE.md autonomous-mode instruction (no intermediate approval gates) and because the task graph is one long dependency chain (schema → guard → controllers → frontend merge → redirects) where a fresh reviewer per task would mostly re-derive context already gathered during planning. Tasks are grouped by domain rather than one-file-each to keep the task count sane for ~30 backend controllers; each task still ends in a runnable, testable state.

**Goal:** Collapse `Role` from `{SUPER_ADMIN, DIRECTOR, MANAGER, SELLER, VIEWER}` to `{DIRECTOR, SELLER}`, replace the `DIRECTOR_UP`/`MANAGER_UP` tier-guard system with an explicit `can(role, permission)` table (mirrored backend + frontend), merge `/director/(panel)` and `/admin/seller` into one `/panel` route group gated by that table, and add redirects from the old paths.

**Architecture:** Backend keeps its own `permissions.ts` (source of truth, colocated with the Nest guard that enforces it); frontend keeps a structurally identical `permissions.ts` it can import with zero backend coupling (separate deployables, no shared workspace package today — mirrored literals, not a shared import, is the pragmatic choice here over introducing a new shared npm package for a ~40-line table). `DIRECTOR` is a wildcard (`can(DIRECTOR, *) === true`); `SELLER` is an explicit allow-list. Frontend gates at three layers: `/panel/layout.tsx` (any staff), each page via `requirePermission()` (specific permission, using Next's `forbidden()` — needs `experimental.authInterrupts` on), and the sidebar nav (`admin-nav.ts`, cosmetic only — never the security boundary).

**Tech Stack:** NestJS + Prisma 7 (driver adapter, Postgres) backend; Next.js 16 App Router frontend. Jest (backend), Vitest (frontend).

**Spec:** User-supplied spec (pasted in conversation, 2026-09-26, three numbered sections: role migration, panel merge, verification). No separate spec file — the spec is reproduced in full in the Global Constraints section below since it is short.

## Global Constraints

- Role enum: remove `SUPER_ADMIN`, `MANAGER`, `VIEWER`; keep `DIRECTOR`, `SELLER`.
- Migration must `UPDATE` existing rows before the enum `ALTER TYPE`: `SUPER_ADMIN→DIRECTOR`, `MANAGER→DIRECTOR`, `VIEWER→SELLER`. (Staging DB checked 2026-09-26: 1 DIRECTOR, 5 SELLER, 0 of the other three — the `UPDATE` is a no-op there but must still run for prod/any other environment.)
- Permission source of truth: `can(role, permission)`, one definition per side (backend `src/common/permissions.ts`, frontend `lib/auth/permissions.ts`), structurally identical.
- SELLER permission grant (exact, from spec): `orders`, `leads` (= inquiries), `products`, `customers`, `inquiries`, `discounts`, `categories` → full CRUD; `reviews` → read only; `warehouse` → read only; `finance`, `analytics`, `users`, `audit` → none.
- DIRECTOR: every permission.
- Every backend controller route gated by `@RequirePermission('module:action')`; `/analytics/*`, `/finance/*`, `/users/*`, `/audit/*` (reads) must 403 for SELLER.
- Discounts: every SELLER-created/updated discount request audit-logged; SELLER's requestable percent hard-capped at 20%, overridable via config/env (not per-user `discountLimit`, which remains the separate auto-approval ceiling).
- Frontend: `/director` and `/admin/seller` merge into one `/panel` route group, one layout; per-page server-side permission check; sidebar filtered by `can()`; SELLER never sees finance/analytics/users/audit nav items; reviews/warehouse pages hide create/edit/delete controls for SELLER.
- Redirects (`next.config.ts`, permanent): `/admin → /panel`, `/director/:path* → /panel/:path*`, `/admin/seller/:path* → /panel/:path*`. `/seller` (POS/kassa) untouched. `/director/login` untouched (still the shared staff login).
- `adminHomePath` removed; login always sends staff to `/panel`.
- Verification: backend Jest + frontend Vitest cover both roles (seller blocked from finance/analytics at API + page level; director unrestricted); `tsc`/`nest build`, `eslint` (both), `jest`, `vitest`, `next build` all green before done.

## Review Focus

- A SELLER hitting a director-only page directly by URL (not just nav-hidden) must get blocked server-side, not just have the link hidden — covered by Task 6's `requirePermission()` + Task 8's per-route tests.
- A discount request above the 20% SELLER cap must be rejected even when the requester's own `discountLimit` is set higher than 20 (two different ceilings, don't let one absorb the other) — covered by Task 4's discount-policy test.
- Old bookmarked URLs (`/director/analytics`, `/admin/seller/orders`) must 301, not 404, including query strings — covered by Task 9's redirect test.
- A DIRECTOR whose JWT still encodes a since-removed role value (`MANAGER`/`SUPER_ADMIN`/`VIEWER`, e.g. a token minted just before deploy) must not crash `PermissionsGuard` — covered by Task 2's guard test (unknown role → 403, not 500).
- The seller-scoped `seller-customers.controller.ts` write actions (create/update/claim/debt-payment) must keep working unchanged post-migration — a `products/products.controller.ts`-style rewrite is easy to over-apply here since it's adjacent; Task 4 explicitly leaves this controller's action set alone and only swaps `@Roles` → `@RequirePermission`.

---

## Permission → Controller Mapping (reference table, used by Task 4)

Permission keys are `module:action`, `action ∈ {create, read, update, delete, approve}`. `both` = granted to DIRECTOR and SELLER; `director` = DIRECTOR only.

| Controller | Routes | Permission | Grant |
|---|---|---|---|
| `brands/brands.controller.ts` | GET | `products:read` | both |
| | POST/PATCH/DELETE | `products:create/update/delete` | both |
| `categories/categories.controller.ts` | GET | `categories:read` | both |
| | POST/PATCH/DELETE | `categories:create/update/delete` | both |
| `warehouses/warehouses.controller.ts` | GET | `warehouse:read` | both |
| | POST/PATCH/DELETE | `warehouse:create/update/delete` | director |
| `invoices/invoices.controller.ts` | all | `orders:*` | both |
| `payments/payments.controller.ts` | all | `orders:*` | both |
| `cashier/cashier.controller.ts` | all | `orders:*` | both |
| `inventory/seller-inventory.controller.ts` | all (GET only) | `warehouse:read` | both |
| `inventory/inventory.controller.ts` | GET | `warehouse:read` | both |
| | POST `/adjust` | `warehouse:update` | director |
| `customers/seller-customers.controller.ts` | all (unchanged action set) | `customers:read/create/update` | both |
| `orders/orders.controller.ts` | all | `orders:*` | both (discount-request route additionally enforces the 20% SELLER cap, see Task 4) |
| `products/products.controller.ts` | GET incl. lookup | `products:read` | both |
| | POST/PATCH | `products:create/update` | both |
| | hard-delete, delete-check | `products:delete` | director |
| `products/seller-products.controller.ts` | all | `products:*` | both |
| `stock-movements/stock-movements.controller.ts` | GET | `warehouse:read` | both |
| | POST | `warehouse:create` | director |
| `audit/audit.controller.ts` | GET, GET `entity-types` | `audit:read` | director |
| | POST (self-attributed write) | *(none — `JwtAuthGuard` only, unchanged)* | both |
| `finance/finance.controller.ts` | all | `finance:*` | director |
| `warehouse/receipts/goods-receipts.controller.ts` | GET, GET `:id` | `warehouse:read` | both |
| | POST/PATCH/approve/cancel | `warehouse:update` | director |
| `reports/seller-reports.controller.ts` | all | `orders:read` | both |
| `dashboard/dashboard.controller.ts` | all | `orders:read` | both |
| `inquiries/seller-inquiries.controller.ts` | all | `inquiries:*` | both |
| `order-items/order-items.controller.ts` | GET | `orders:read` | both |
| `reports/reports.controller.ts` | all | `analytics:read` | director |
| `sellers/sellers.controller.ts` | all | `users:*` | director |
| `returns/returns.controller.ts` | all | `orders:*` | both |
| `discount-requests/discount-requests.controller.ts` | listPending, decide | `discounts:approve` | director |
| `warehouse/products/warehouse-products.controller.ts` | GET | `warehouse:read` | both |
| | POST/PATCH/DELETE | `warehouse:create/update/delete` | director |
| `warehouse/reports/warehouse-reports.controller.ts` | all | `warehouse:read` | both |
| `reviews/reviews.controller.ts` | GET `admin` | `reviews:read` | both |
| | PATCH `:id/approval` | `reviews:update` | director |
| | DELETE `:id` | `reviews:delete` | director |
| | GET, PUT, GET `mine`, GET `purchase-check` | *(unchanged — customer-facing, not staff-gated)* | n/a |
| `customers/customers.controller.ts` | GET, GET `:id` | `customers:read` | both |
| | POST/PATCH/DELETE | `customers:create/update/delete` | **director** (deliberate: this is the *global*, unscoped CRUD surface; SELLER's create/update path is the already-scoped `seller-customers.controller.ts` above — opening this one too would let a seller write any customer record, not just their own, which is a bigger grant than "customers CRUD" was asking for) |
| `users/users.controller.ts` | all | `users:*` | director |
| `discount-requests/*` service-level `SELLER_MAX_DISCOUNT_PERCENT` cap | n/a | see Task 4 | n/a |

Untouched (no staff `@Roles`/`@RequirePermission` today, out of scope): `inquiries/inquiries.controller.ts` (public inquiry submission).

---

## Task 1: Prisma schema — shrink the `Role` enum

**Files:**
- Modify: `backend/prisma/schema.prisma` (the `enum Role` block, currently `SUPER_ADMIN | DIRECTOR | MANAGER | SELLER | VIEWER`)
- Create: `backend/prisma/migrations/20260926150000_shrink_role_enum_to_director_seller/migration.sql`

**Interfaces:**
- Produces: `Role` = `'DIRECTOR' | 'SELLER'` everywhere downstream (Prisma-generated client type at `backend/generated/prisma/client`).

- [ ] **Step 1: Write the migration SQL** (data UPDATE before the type change — Postgres won't let you narrow an enum with existing rows using the old values)

```sql
-- Fold the retired tiers into their replacements before the enum shrinks.
UPDATE "User" SET role = 'DIRECTOR' WHERE role IN ('SUPER_ADMIN', 'MANAGER');
UPDATE "User" SET role = 'SELLER' WHERE role = 'VIEWER';

-- Postgres enums can't drop values in place; rebuild the type.
ALTER TYPE "Role" RENAME TO "Role_old";
CREATE TYPE "Role" AS ENUM ('DIRECTOR', 'SELLER');
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role" USING (role::text::"Role");
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'SELLER';
DROP TYPE "Role_old";
```

- [ ] **Step 2: Update the schema enum**

In `backend/prisma/schema.prisma`, change:
```prisma
enum Role {
  SUPER_ADMIN
  DIRECTOR
  MANAGER
  SELLER
  VIEWER
}
```
to:
```prisma
enum Role {
  DIRECTOR
  SELLER
}
```

- [ ] **Step 3: Apply the migration to the local/staging DB and regenerate the client**

Run: `cd backend && npx prisma migrate dev --name shrink_role_enum_to_director_seller --create-only` (should detect the hand-written migration already exists if the folder name matches; if it instead wants to generate its own, diff it against the SQL above and keep the hand-written UPDATEs), then `npx prisma migrate deploy` (or `dev` in local) and `npx prisma generate`.
Expected: migration applies cleanly against `diesel_parts_staging`, `generated/prisma/client` regenerates with `Role = 'DIRECTOR' | 'SELLER'`.

- [ ] **Step 4: Confirm no stale role literals remain**

Run: `cd backend && grep -rn "SUPER_ADMIN\|MANAGER\|VIEWER" src generated/prisma/enums.ts` — expect zero hits in `src` after Task 4 completes (this step is a checkpoint, re-run it again at the end of Task 4).

- [ ] **Step 5: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations
git commit -m "feat(auth): shrink Role enum to DIRECTOR/SELLER"
```

## Task 2: Backend permission engine + guard

**Files:**
- Create: `backend/src/common/permissions.ts`
- Create: `backend/src/common/decorators/require-permission.decorator.ts`
- Create: `backend/src/common/guards/permissions.guard.ts`
- Create: `backend/src/common/guards/permissions.guard.spec.ts`
- Create: `backend/src/common/permissions.spec.ts`
- Modify: `backend/src/common/roles.ts` (delete — superseded; confirm nothing outside `common/` imports `ROLE_RANK`/`roleAtLeast`/`ALL_ROLES`/`MANAGER_UP`/`DIRECTOR_UP`/`SELLER_UP` before removing, per Task 4's per-file conversion)
- Delete: `backend/src/common/decorators/roles.decorator.ts`, `backend/src/common/guards/roles.guard.ts`, `backend/src/common/guards/roles.guard.spec.ts` (after Task 4 finishes converting every call site)

**Interfaces:**
- Produces: `type PermissionModule = 'products' | 'categories' | 'customers' | 'orders' | 'inquiries' | 'discounts' | 'reviews' | 'warehouse' | 'finance' | 'analytics' | 'users' | 'audit'`; `type PermissionAction = 'create' | 'read' | 'update' | 'delete' | 'approve'`; `type Permission = \`${PermissionModule}:${PermissionAction}\``; `function can(role: Role, permission: Permission): boolean`; `@RequirePermission(permission: Permission)` class/method decorator; `PermissionsGuard` (Nest `CanActivate`).

- [ ] **Step 1: Write `permissions.ts`**

```ts
import { Role } from '../../generated/prisma/client';

export type PermissionModule =
  | 'products'
  | 'categories'
  | 'customers'
  | 'orders'
  | 'inquiries'
  | 'discounts'
  | 'reviews'
  | 'warehouse'
  | 'finance'
  | 'analytics'
  | 'users'
  | 'audit';

export type PermissionAction = 'create' | 'read' | 'update' | 'delete' | 'approve';

export type Permission = `${PermissionModule}:${PermissionAction}`;

/**
 * SELLER's explicit allow-list. DIRECTOR is a wildcard (see `can`) rather than
 * a mirrored list here — spelling out "director: everything" as forty repeated
 * entries would drift the moment a permission is added and nobody touches
 * this file.
 */
const SELLER_PERMISSIONS: ReadonlySet<Permission> = new Set<Permission>([
  'products:create', 'products:read', 'products:update', 'products:delete',
  'categories:create', 'categories:read', 'categories:update', 'categories:delete',
  'customers:create', 'customers:read', 'customers:update', 'customers:delete',
  'orders:create', 'orders:read', 'orders:update', 'orders:delete',
  'inquiries:create', 'inquiries:read', 'inquiries:update', 'inquiries:delete',
  'discounts:create', 'discounts:read',
  'reviews:read',
  'warehouse:read',
]);

export function can(role: Role, permission: Permission): boolean {
  if (role === 'DIRECTOR') return true;
  if (role === 'SELLER') return SELLER_PERMISSIONS.has(permission);
  return false; // unknown/legacy role value — fail closed, not throw
}
```

- [ ] **Step 2: Write `permissions.spec.ts`**

```ts
import { can } from './permissions';

describe('can', () => {
  it('grants DIRECTOR every permission', () => {
    expect(can('DIRECTOR', 'finance:read')).toBe(true);
    expect(can('DIRECTOR', 'audit:read')).toBe(true);
    expect(can('DIRECTOR', 'users:delete')).toBe(true);
  });

  it('grants SELLER the spec allow-list', () => {
    expect(can('SELLER', 'orders:create')).toBe(true);
    expect(can('SELLER', 'reviews:read')).toBe(true);
    expect(can('SELLER', 'warehouse:read')).toBe(true);
  });

  it('denies SELLER the director-only modules', () => {
    expect(can('SELLER', 'finance:read')).toBe(false);
    expect(can('SELLER', 'analytics:read')).toBe(false);
    expect(can('SELLER', 'users:read')).toBe(false);
    expect(can('SELLER', 'audit:read')).toBe(false);
    expect(can('SELLER', 'discounts:approve')).toBe(false);
    expect(can('SELLER', 'reviews:update')).toBe(false);
    expect(can('SELLER', 'warehouse:create')).toBe(false);
  });

  it('fails closed for an unrecognized role value rather than throwing', () => {
    expect(can('MANAGER' as unknown as Parameters<typeof can>[0], 'orders:read')).toBe(false);
  });
});
```

- [ ] **Step 3: Run it, confirm it fails (module doesn't exist yet)**

Run: `cd backend && npx jest src/common/permissions.spec.ts`
Expected: FAIL — `Cannot find module './permissions'`.

- [ ] **Step 4: Re-run after Step 1's file exists**

Run: `cd backend && npx jest src/common/permissions.spec.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Write the decorator**

```ts
// backend/src/common/decorators/require-permission.decorator.ts
import { SetMetadata } from '@nestjs/common';
import type { Permission } from '../permissions';

export const PERMISSION_KEY = 'permission';
export const RequirePermission = (permission: Permission) =>
  SetMetadata(PERMISSION_KEY, permission);
```

- [ ] **Step 6: Write the guard**

```ts
// backend/src/common/guards/permissions.guard.ts
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSION_KEY } from '../decorators/require-permission.decorator';
import { can, type Permission } from '../permissions';
import type { AuthenticatedUser } from '../../auth/auth.types';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const permission = this.reflector.getAllAndOverride<Permission | undefined>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!permission) return true; // no @RequirePermission — open to any authenticated staff user

    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;
    if (!user || !can(user.role, permission)) {
      throw new ForbiddenException(`Missing permission: ${permission}`);
    }
    return true;
  }
}
```

- [ ] **Step 7: Write the guard spec**

```ts
// backend/src/common/guards/permissions.guard.spec.ts
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';

function contextWith(permission: string | undefined, role: string | undefined) {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user: role ? { id: 'u1', role } : undefined }),
    }),
  } as unknown as ExecutionContext;
}

describe('PermissionsGuard', () => {
  const reflector = { getAllAndOverride: jest.fn() } as unknown as Reflector;
  const guard = new PermissionsGuard(reflector);

  it('allows the request through when no @RequirePermission is set', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(undefined);
    expect(guard.canActivate(contextWith(undefined, 'SELLER'))).toBe(true);
  });

  it('allows a DIRECTOR through any permission', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue('finance:read');
    expect(guard.canActivate(contextWith('finance:read', 'DIRECTOR'))).toBe(true);
  });

  it('403s a SELLER missing the permission', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue('finance:read');
    expect(() => guard.canActivate(contextWith('finance:read', 'SELLER'))).toThrow(
      ForbiddenException,
    );
  });

  it('403s — not 500s — on an unrecognized role value on the token', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue('orders:read');
    expect(() => guard.canActivate(contextWith('orders:read', 'MANAGER'))).toThrow(
      ForbiddenException,
    );
  });
});
```

- [ ] **Step 8: Run both specs**

Run: `cd backend && npx jest src/common/guards/permissions.guard.spec.ts src/common/permissions.spec.ts`
Expected: PASS (8 tests total).

- [ ] **Step 9: Commit**

```bash
git add backend/src/common/permissions.ts backend/src/common/permissions.spec.ts \
  backend/src/common/decorators/require-permission.decorator.ts \
  backend/src/common/guards/permissions.guard.ts backend/src/common/guards/permissions.guard.spec.ts
git commit -m "feat(auth): add can()/@RequirePermission/PermissionsGuard"
```

(`roles.ts`/`roles.guard.ts`/`roles.decorator.ts` deletion happens at the end of Task 4, once every controller has moved off them — deleting now would break the build mid-task.)

## Task 3: Discount policy — SELLER hard cap + audit on request creation

**Files:**
- Modify: `backend/src/discount-requests/discount-policy.ts`
- Modify: `backend/src/discount-requests/discount-policy.spec.ts`
- Modify: `backend/src/orders/orders.service.ts` (`requestDiscount`, ~line 649)
- Test: `backend/src/orders/orders.service.spec.ts` (existing file — add cases)

**Interfaces:**
- Consumes: `AuditService.record()` (already imported in `orders.service.ts`), `AuditAction.CREATE` (already imported).
- Produces: `SELLER_MAX_DISCOUNT_PERCENT: number` (reads `process.env.SELLER_MAX_DISCOUNT_PERCENT`, defaults `20`).

- [ ] **Step 1: Add the cap constant, write its test first**

In `discount-policy.spec.ts`, add:
```ts
import { SELLER_MAX_DISCOUNT_PERCENT } from './discount-policy';

describe('SELLER_MAX_DISCOUNT_PERCENT', () => {
  const original = process.env.SELLER_MAX_DISCOUNT_PERCENT;
  afterEach(() => {
    if (original === undefined) delete process.env.SELLER_MAX_DISCOUNT_PERCENT;
    else process.env.SELLER_MAX_DISCOUNT_PERCENT = original;
  });

  it('defaults to 20', () => {
    delete process.env.SELLER_MAX_DISCOUNT_PERCENT;
    expect(SELLER_MAX_DISCOUNT_PERCENT()).toBe(20);
  });

  it('is overridable via env', () => {
    process.env.SELLER_MAX_DISCOUNT_PERCENT = '15';
    expect(SELLER_MAX_DISCOUNT_PERCENT()).toBe(15);
  });
});
```

- [ ] **Step 2: Run it, confirm it fails**

Run: `cd backend && npx jest src/discount-requests/discount-policy.spec.ts`
Expected: FAIL — `SELLER_MAX_DISCOUNT_PERCENT is not a function`.

- [ ] **Step 3: Implement it as a function (not a static constant), so env overrides apply without a restart-only read**

```ts
// discount-policy.ts — add below DIRECTOR_DISCOUNT_LIMIT
/**
 * The hard ceiling on what a SELLER may ever request, director-approval
 * or not — distinct from `User.discountLimit`, which only decides whether a
 * request auto-applies. Config-overridable per the spec ("20%, konfigda
 * o'zgartiriladigan"); read live rather than cached at module-load so tests
 * (and an ops env-var change) don't need a process restart to take effect.
 */
export function SELLER_MAX_DISCOUNT_PERCENT(): number {
  const raw = process.env.SELLER_MAX_DISCOUNT_PERCENT;
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) ? parsed : 20;
}
```

- [ ] **Step 4: Run it, confirm it passes**

Run: `cd backend && npx jest src/discount-requests/discount-policy.spec.ts`
Expected: PASS.

- [ ] **Step 5: Enforce the cap in `orders.service.ts::requestDiscount`, write the failing test first**

In `orders.service.spec.ts`, add (adjust the existing test's setup/mocks to match — this file already mocks `PrismaService`/`AuditService` for `requestDiscount`, follow its existing fixture pattern):
```ts
it('rejects a SELLER request above SELLER_MAX_DISCOUNT_PERCENT even if discountLimit is higher', async () => {
  // existing spec's `actor` fixture with role SELLER, order fixture, and
  // `prisma.user.findUniqueOrThrow` mocked to return `{ discountLimit: 50 }`
  await expect(
    service.requestDiscount(sellerActor, order.id, { percent: 25 }),
  ).rejects.toThrow(/20%/);
});
```

- [ ] **Step 6: Run it, confirm it fails**

Run: `cd backend && npx jest src/orders/orders.service.spec.ts -t "SELLER_MAX_DISCOUNT_PERCENT"`
Expected: FAIL (no rejection currently — request goes to `needs_approval`).

- [ ] **Step 7: Implement the cap + the missing audit log on the pending-request branch**

In `orders.service.ts`, inside `requestDiscount`, right after `const percent = dto.percent;` (around line 672):
```ts
    const percent = dto.percent;

    if (!isDirector(actor) && percent > SELLER_MAX_DISCOUNT_PERCENT()) {
      throw new BadRequestException(
        `Chegirma ${SELLER_MAX_DISCOUNT_PERCENT()}% dan oshmasligi kerak`,
      );
    }
```
(add `SELLER_MAX_DISCOUNT_PERCENT` to the existing `from '../discount-requests/discount-policy'` import, and `BadRequestException` to the existing `@nestjs/common` import if not already there.)

Then, in the pending-request branch (after `const created = await this.prisma.$transaction(...)`, i.e. right after the transaction that creates the `DiscountRequest` and updates the order — after the existing `if (directors.length > 0) { ... }` notification block, before the branch's `return`), add the audit call the immediate branch already has:
```ts
    await this.audit.record({
      userId: actor.id,
      action: AuditAction.CREATE,
      entityType: 'DiscountRequest',
      entityId: created.id,
      before: null,
      after: { requestedPercent: percent, orderId: id },
    });
```
(Confirm the exact shape of `created` from the transaction's return value — it returns `request` today per the existing code; if the transaction callback doesn't already return `request`, add `return request;` to its end so `created.id` resolves.)

- [ ] **Step 8: Run it, confirm it passes**

Run: `cd backend && npx jest src/orders/orders.service.spec.ts`
Expected: PASS, including all pre-existing cases in this file (no regressions).

- [ ] **Step 9: Commit**

```bash
git add backend/src/discount-requests/discount-policy.ts backend/src/discount-requests/discount-policy.spec.ts \
  backend/src/orders/orders.service.ts backend/src/orders/orders.service.spec.ts
git commit -m "feat(discounts): hard-cap SELLER requests at 20% (config), audit request creation"
```

## Task 4: Convert every controller from `@Roles`/tier arrays to `@RequirePermission`

**Files:** every controller in the Permission → Controller Mapping table above (28 files). Each conversion is mechanical: swap the import of `Roles`/`RolesGuard`/tier-array from `common/roles`/`common/decorators/roles.decorator`/`common/guards/roles.guard` for `RequirePermission` from `common/decorators/require-permission.decorator` and `PermissionsGuard` from `common/guards/permissions.guard`, per the table's grant column. Where a grant is `both` and the whole controller/route needs no restriction beyond "authenticated staff," omit `@RequirePermission` entirely (guard already passes through with no metadata, per Task 2 Step 6) — only add it where the table calls for a `director`-only cut, or where the module boundary itself needs recording (see below) even though both roles pass, so intent stays legible for the next reader.

Do this working through the table top to bottom, one controller (or tightly related pair, e.g. `products.controller.ts` + `seller-products.controller.ts`) per commit, running the full backend test suite after each — not the whole 28-file diff as one commit, so a mistake in file #19 doesn't require re-auditing files #1-18 to bisect.

- [ ] **Step 1: `brands.controller.ts` + `categories.controller.ts`**

Replace class-level `@Roles(...ALL_ROLES)` / `@Roles(...MANAGER_UP)` with per-route `@RequirePermission('products:read')` (GET) and `@RequirePermission('products:create' | 'products:update' | 'products:delete')` (categories.controller.ts: swap `products` for `categories`) on the mutation routes; both are `both`-granted per the table so this is really about recording intent, not narrowing access — confirm with a manual `curl`/Jest call that SELLER still gets 200 on all five routes of each controller.

Run: `cd backend && npx jest src/brands src/categories`
Expected: PASS, no behavior change (both roles still pass every route).

- [ ] **Step 2: `warehouses.controller.ts`**

GET routes → `@RequirePermission('warehouse:read')` (no access change — was already `ALL_ROLES`). POST/PATCH/DELETE → `@RequirePermission('warehouse:create' | 'warehouse:update' | 'warehouse:delete')` — this **narrows** access: previously `MANAGER_UP` (which post-enum-collapse would mean "only DIRECTOR" anyway, since MANAGER/SUPER_ADMIN both fold into DIRECTOR), so behavior is unchanged, just now expressed as a permission instead of a role list. Add a test in `warehouses.controller.spec.ts` (or the closest existing e2e/integration spec covering this controller) asserting a SELLER gets 403 on the create route.

Run: `cd backend && npx jest src/warehouses`
Expected: PASS.

- [ ] **Step 3: `invoices.controller.ts`, `payments.controller.ts`, `cashier.controller.ts`, `inventory/seller-inventory.controller.ts`, `orders/orders.controller.ts`, `order-items.controller.ts`, `returns.controller.ts`, `reports/seller-reports.controller.ts`, `dashboard.controller.ts`**

All were `SELLER_UP` (already both roles); swap to `@RequirePermission('orders:read' | 'orders:create' | ... )` per the table (most are class-level `orders:*` — since there's no wildcard action, apply the specific action per HTTP verb: GET→`read`, POST→`create`, PATCH/PUT→`update`, DELETE→`delete`). No access change.

Run: `cd backend && npx jest src/invoices src/payments src/cashier src/inventory/seller-inventory.spec.ts src/orders src/order-items src/returns src/reports/seller-reports.controller.spec.ts src/dashboard`
Expected: PASS.

- [ ] **Step 4: `products/products.controller.ts` + `products/seller-products.controller.ts`**

Class-level guard on `products.controller.ts` changes from `MANAGER_UP` to `@RequirePermission('products:read')` at class level (covers the general CRUD routes — **this is the actual access widening the spec asks for**: SELLER now gets product create/update where they previously didn't), with the hard-delete (`L80`) and delete-check (`L110`) routes keeping their own tighter `@RequirePermission('products:delete')` (director-only — narrower than `products:read`, so it overrides the class default via method-level metadata, same as today's `@Roles(...DIRECTOR_UP)` already does at those two routes). The lookup route (`L56`, was `ALL_ROLES`) becomes `@RequirePermission('products:read')` explicitly. `seller-products.controller.ts` (`SELLER_UP`) becomes `@RequirePermission('products:read'/'products:create'/'products:update')` per route, both roles, no access change.

Add a test asserting SELLER now gets a non-403 on the plain product-create route (previously 403 under `MANAGER_UP`) — this is the one real behavior change in this step, so it needs its own assertion, not just a "no regression" check.

Run: `cd backend && npx jest src/products`
Expected: PASS, including the new SELLER-can-create-product case.

- [ ] **Step 5: `inventory/inventory.controller.ts`, `stock-movements.controller.ts`, `warehouse/receipts/goods-receipts.controller.ts`, `warehouse/products/warehouse-products.controller.ts`, `warehouse/reports/warehouse-reports.controller.ts`**

Split GET (`warehouse:read`, both — widened for `inventory.controller.ts`/`stock-movements.controller.ts`/`goods-receipts.controller.ts`/`warehouse-products.controller.ts`'s read routes, since these were `MANAGER_UP` before and SELLER now gets warehouse read per spec) from mutations (`warehouse:create`/`update`/`delete`, director-only — unchanged from today's effective access). `warehouse-reports.controller.ts` was already `SELLER_UP`; convert straight to `warehouse:read` both, no change.

Add a test per controller asserting SELLER now gets 200 on the GET routes that were previously 403.

Run: `cd backend && npx jest src/inventory src/stock-movements src/warehouse`
Expected: PASS, including the new SELLER-can-read-warehouse cases.

- [ ] **Step 6: `customers/customers.controller.ts` + `customers/seller-customers.controller.ts`**

`customers.controller.ts`: GET/GET`:id` → `@RequirePermission('customers:read')` both (widened — was `MANAGER_UP`); POST/PATCH/DELETE stay `@RequirePermission('customers:create'/'update'/'delete')` **director-only**, per the deliberate exception recorded in the mapping table (seller writes go through the scoped controller instead). `seller-customers.controller.ts`: swap `SELLER_UP` for `@RequirePermission('customers:read'/'create'/'update')` per route, no access change.

Add a test confirming SELLER gets 200 on `customers.controller.ts` GET but still 403 on its POST (so the deliberate asymmetry is pinned, not just implied by omission).

Run: `cd backend && npx jest src/customers`
Expected: PASS.

- [ ] **Step 7: `inquiries/seller-inquiries.controller.ts`**

`SELLER_UP` → `@RequirePermission('inquiries:*')` per route, both, no access change.

Run: `cd backend && npx jest src/inquiries`
Expected: PASS.

- [ ] **Step 8: `discount-requests.controller.ts`**

Class-level `DIRECTOR_UP` → `@RequirePermission('discounts:approve')`, director-only, no access change (SELLER already couldn't reach `listPending`/`decide`).

Run: `cd backend && npx jest src/discount-requests`
Expected: PASS.

- [ ] **Step 9: `reviews/reviews.controller.ts`**

`@Get('admin')`: `MANAGER_UP` → `@RequirePermission('reviews:read')` both — **widened**, SELLER now sees the moderation queue read-only. `PATCH :id/approval` and `DELETE :id`: `MANAGER_UP` → `@RequirePermission('reviews:update')` / `@RequirePermission('reviews:delete')`, director-only (unchanged access). The four customer-facing routes above them (`GET`, `PUT`, `GET mine`, `GET purchase-check`) are untouched — no `@Roles` on them today, leave as-is.

Add a test confirming SELLER now gets 200 on `GET /reviews/admin` but still 403 on `PATCH /reviews/:id/approval`.

Run: `cd backend && npx jest src/reviews`
Expected: PASS, including the new SELLER-can-read-admin-reviews case.

- [ ] **Step 10: `finance/finance.controller.ts`, `analytics/analytics.controller.ts`, `reports/reports.controller.ts`, `users/users.controller.ts`, `sellers/sellers.controller.ts`, `audit/audit.controller.ts`**

All `DIRECTOR_UP`/`MANAGER_UP` → director-only permissions per the table (`finance:*`, `analytics:read`, `analytics:read`, `users:*`, `users:*`, `audit:read`). `audit.controller.ts`'s `POST` stays guarded by `JwtAuthGuard` only (no `@RequirePermission`) exactly as today. No access change anywhere in this step — this is the group that stays fully locked to SELLER, just re-expressed.

Add/confirm a 403-for-SELLER test on one route in each of these six controllers (most already have this test against the old tier system — update the fixture role literal, don't delete the assertion).

Run: `cd backend && npx jest src/finance src/analytics src/reports src/users src/sellers src/audit`
Expected: PASS.

- [ ] **Step 11: Delete the retired role-tier machinery**

Run: `cd backend && grep -rln "common/roles'\|roles.decorator\|roles.guard" src` — expect it to list only spec files for the guard/decorator/roles module itself (or nothing). Delete `backend/src/common/roles.ts`, `backend/src/common/decorators/roles.decorator.ts`, `backend/src/common/guards/roles.guard.ts`, `backend/src/common/guards/roles.guard.spec.ts`.

Run: `cd backend && npx tsc --noEmit -p tsconfig.json && npx jest`
Expected: `tsc` clean (nothing still imports the deleted files), full Jest suite green.

- [ ] **Step 12: Commit**

```bash
git add -A backend/src
git commit -m "feat(auth): convert every controller from role tiers to @RequirePermission"
```

## Task 5: Frontend permission mirror + role type shrink

**Files:**
- Create: `frontend/lib/auth/permissions.ts`
- Create: `frontend/lib/auth/permissions.test.ts`
- Modify: `frontend/lib/auth/roles.ts` (shrink `StaffRole`, remove `ADMIN_AREAS`/`canAccessAdminPath`/`adminHomePath`/`isDirectorTier`/`isAdminPath`/`isDirectorPath` — replaced by the `/panel` merge in Task 6/7)
- Modify: `frontend/lib/auth/roles.test.ts`
- Modify: `frontend/lib/auth/dal.ts` (replace `requireDirector()` with `requirePermission()`)

**Interfaces:**
- Consumes: nothing new.
- Produces: `type StaffRole = 'DIRECTOR' | 'SELLER'`; `can(role, permission)` — same `Permission` union as backend's, duplicated here (see plan-level Architecture note on why this is a mirror, not a shared import); `requirePermission(permission: Permission): Promise<StaffUser>` from `dal.ts`, throwing Next's `forbidden()` when denied.

- [ ] **Step 1: Write `permissions.ts`** (byte-for-byte the same table as backend's `src/common/permissions.ts`, typed against the frontend's own `StaffRole` instead of Prisma's `Role`)

```ts
export type PermissionModule =
  | "products" | "categories" | "customers" | "orders" | "inquiries"
  | "discounts" | "reviews" | "warehouse" | "finance" | "analytics"
  | "users" | "audit";

export type PermissionAction = "create" | "read" | "update" | "delete" | "approve";

export type Permission = `${PermissionModule}:${PermissionAction}`;

const SELLER_PERMISSIONS: ReadonlySet<Permission> = new Set<Permission>([
  "products:create", "products:read", "products:update", "products:delete",
  "categories:create", "categories:read", "categories:update", "categories:delete",
  "customers:create", "customers:read", "customers:update", "customers:delete",
  "orders:create", "orders:read", "orders:update", "orders:delete",
  "inquiries:create", "inquiries:read", "inquiries:update", "inquiries:delete",
  "discounts:create", "discounts:read",
  "reviews:read",
  "warehouse:read",
]);

export function can(role: "DIRECTOR" | "SELLER", permission: Permission): boolean {
  if (role === "DIRECTOR") return true;
  return SELLER_PERMISSIONS.has(permission);
}
```

- [ ] **Step 2: Write `permissions.test.ts`** (same four cases as backend's `permissions.spec.ts`, minus the "unknown role" case since `StaffRole` is now a closed two-value union and TS enforces it at compile time — there is no runtime "third value" path to test here)

```ts
import { describe, expect, it } from "vitest";
import { can } from "./permissions";

describe("can", () => {
  it("grants DIRECTOR every permission", () => {
    expect(can("DIRECTOR", "finance:read")).toBe(true);
    expect(can("DIRECTOR", "audit:read")).toBe(true);
  });

  it("grants SELLER the spec allow-list", () => {
    expect(can("SELLER", "orders:create")).toBe(true);
    expect(can("SELLER", "reviews:read")).toBe(true);
    expect(can("SELLER", "warehouse:read")).toBe(true);
  });

  it("denies SELLER the director-only modules", () => {
    expect(can("SELLER", "finance:read")).toBe(false);
    expect(can("SELLER", "analytics:read")).toBe(false);
    expect(can("SELLER", "users:read")).toBe(false);
    expect(can("SELLER", "audit:read")).toBe(false);
    expect(can("SELLER", "discounts:approve")).toBe(false);
  });
});
```

- [ ] **Step 3: Run it, confirm it fails, then passes**

Run: `cd frontend && npx vitest run lib/auth/permissions.test.ts`
Expected: FAIL then PASS across steps 1-3.

- [ ] **Step 4: Shrink `roles.ts`**

Replace the whole file with:
```ts
/**
 * Who may enter the staff panel. `StaffRole` mirrors backend/'s Prisma
 * `Role` enum (see backend/src/common/permissions.ts's header comment) —
 * kept as a hand-written union rather than generated because this file has
 * no Prisma dependency and both sides changing together is enforced by the
 * migration in docs/superpowers/plans/2026-09-26-role-simplification-director-seller.md,
 * not by a type import.
 */
export type StaffRole = "DIRECTOR" | "SELLER";

export const STAFF_LOGIN_PATH = "/director/login";

export const PANEL_ROOT = "/panel";
```
(`ADMIN_ROOT`, `DIRECTOR_ROOT`, `ADMIN_AREAS`, `normalize`, `isUnder`, `isAdminPath`, `isDirectorPath`, `canAccessAdminPath`, `adminHomePath`, `isDirectorTier` are all removed — their callers are updated in this same task's Step 6 and Task 6/7.)

- [ ] **Step 5: Update `roles.test.ts`** to test only what remains — drop every test for the removed exports, keep/add:
```ts
import { describe, expect, it } from "vitest";
import { PANEL_ROOT, STAFF_LOGIN_PATH } from "./roles";

describe("roles", () => {
  it("names the one staff login path", () => {
    expect(STAFF_LOGIN_PATH).toBe("/director/login");
  });

  it("names the merged panel root", () => {
    expect(PANEL_ROOT).toBe("/panel");
  });
});
```

- [ ] **Step 6: Update `dal.ts`** — replace `requireDirector()` with `requirePermission()`

```ts
import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { forbidden } from "next/navigation";
import { BackendApiError, backendRequest } from "@/lib/api/backend-client";
import { STAFF_LOGIN_PATH, type StaffRole } from "./roles";
import { can, type Permission } from "./permissions";
import { getStaffSession } from "./staff-session";

// ...StaffUser/BackendMeResponse/loadStaffUser/getStaffUser/requireStaff unchanged...

/**
 * For a page gated behind a specific permission. A SELLER hitting a
 * director-only page (finance, analytics, users, audit — or any page
 * `can()` denies them) gets Next's `forbidden()` boundary, not a redirect:
 * they're signed in and the URL is real, so a 403 reads truer than either a
 * login bounce or a silent redirect to their own home.
 */
export async function requirePermission(permission: Permission): Promise<StaffUser> {
  const user = await requireStaff();

  if (!can(user.role, permission)) {
    forbidden();
  }

  return user;
}
```

Remove the old `requireDirector()` and its `adminHomePath` import.

- [ ] **Step 7: Enable `experimental.authInterrupts`** (required for `forbidden()`/`forbidden.tsx`)

In `frontend/next.config.ts`:
```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    authInterrupts: true,
  },
};

export default nextConfig;
```

- [ ] **Step 8: Run the frontend unit tests touched so far**

Run: `cd frontend && npx vitest run lib/auth/permissions.test.ts lib/auth/roles.test.ts`
Expected: PASS. (`dal.ts` has no dedicated spec file today per the codebase map — its behavior is exercised through the page-level tests in Task 6/8; don't invent a `dal.test.ts` here, since mocking `server-only` + `next/navigation`'s `forbidden`/`redirect` in isolation duplicates what Task 8's route tests already cover end to end.)

- [ ] **Step 9: Commit**

```bash
git add frontend/lib/auth/permissions.ts frontend/lib/auth/permissions.test.ts \
  frontend/lib/auth/roles.ts frontend/lib/auth/roles.test.ts frontend/lib/auth/dal.ts frontend/next.config.ts
git commit -m "feat(auth): mirror permissions.ts on the frontend, shrink StaffRole, add requirePermission()"
```

(This will not build cleanly in isolation — every caller of the now-deleted `roles.ts` exports and `requireDirector()` still needs updating. That's Task 6/7. Don't run `next build` until Task 7 is done.)

## Task 6: Frontend — merge `/director/(panel)` and `/admin/seller` into `/panel`

**Files:**
- Create: `frontend/app/panel/layout.tsx` (new shared root — merges the responsibilities of today's `frontend/app/admin/layout.tsx` root-layout shell and the `(panel)` group's auth gate)
- Create: `frontend/app/panel/error.tsx`, `frontend/app/panel/not-found.tsx` (ports of `frontend/app/admin/error.tsx` / `not-found.tsx`, same content, `ADMIN_ROOT`/`STAFF_LOGIN_PATH` references updated to `PANEL_ROOT`)
- Create: `frontend/app/panel/forbidden.tsx` (new — Next's `forbidden.tsx` convention)
- Move (via `git mv`) every subtree under `frontend/app/director/(panel)/*` to `frontend/app/panel/*` (analytics, audit, categories, customers, discounts, finance + finance/debts + finance/expenses, products, reviews, users, warehouse + warehouse/incomes + warehouse/products + warehouse/reports + warehouse/warehouses)
- Move (via `git mv`) `frontend/app/admin/seller/{customers,customers/[id],inquiries,orders,page.tsx}` to `frontend/app/panel/seller/*` (kept as a `seller/` subpath under `/panel` rather than flattened — these four pages are seller-specific views, not general panel pages, and flattening `customers` here would collide with the director-side `frontend/app/panel/customers` moved above; the two `customers` pages are NOT the same page — see Step 4)
- Delete: `frontend/app/director/(panel)/*` (now empty after the moves), `frontend/app/director/layout.tsx`'s panel-specific bits if any (root `/director` layout stays — it's the login screen's parent), `frontend/app/admin/*` (layout, error, not-found, boundaries.test, seller/*, page.tsx — all superseded by `/panel`)
- Modify: every moved `page.tsx`/nested `layout.tsx` that called `requireDirector()` or `requireStaff()` directly — swap for `requirePermission('<module>:read')` (per the table in Task 4, using the same module names) or leave `requireStaff()` where the page is open to both roles (seller's own pages)
- Modify: `frontend/lib/auth/admin-nav.ts` (filter `ADMIN_NAV` by `can(role, permission)` instead of a hardcoded `roles: [...]` per entry)
- Modify: `frontend/components/admin/panel-shell.tsx` (path references, if any hardcode `/director` or `/admin/seller`)

**Interfaces:**
- Consumes: `requirePermission` (Task 5), `can` (Task 5), `Permission` (Task 5).
- Produces: every panel page reachable at `/panel/*`.

- [ ] **Step 1: Move the director-panel subtree**

```bash
git mv "frontend/app/director/(panel)/analytics" frontend/app/panel/analytics
git mv "frontend/app/director/(panel)/audit" frontend/app/panel/audit
git mv "frontend/app/director/(panel)/categories" frontend/app/panel/categories
git mv "frontend/app/director/(panel)/customers" frontend/app/panel/customers
git mv "frontend/app/director/(panel)/discounts" frontend/app/panel/discounts
git mv "frontend/app/director/(panel)/finance" frontend/app/panel/finance
git mv "frontend/app/director/(panel)/products" frontend/app/panel/products
git mv "frontend/app/director/(panel)/reviews" frontend/app/panel/reviews
git mv "frontend/app/director/(panel)/users" frontend/app/panel/users
git mv "frontend/app/director/(panel)/warehouse" frontend/app/panel/warehouse
git mv "frontend/app/director/(panel)/layout.tsx" frontend/app/panel/_old-panel-layout.tsx  # reference only, folded into Step 3 then deleted
```

- [ ] **Step 2: Move the seller subtree**

```bash
mkdir -p frontend/app/panel/seller
git mv frontend/app/admin/seller/inquiries frontend/app/panel/seller/inquiries
git mv frontend/app/admin/seller/orders frontend/app/panel/seller/orders
git mv frontend/app/admin/seller/page.tsx frontend/app/panel/seller/page.tsx
git mv frontend/app/admin/seller/customers frontend/app/panel/seller/customers
```

- [ ] **Step 3: Write the merged `layout.tsx`**

Read `frontend/app/admin/layout.tsx` (root shell: fonts, `ThemeProvider`, `MotionProvider`, `QueryProvider`, `Toaster`, `<html>`/`<body>` with `admin-root` class) and `frontend/app/director/(panel)/_old-panel-layout.tsx` (the auth gate, now moved) side by side, and combine into one file — the shell wraps the gate:

```tsx
// frontend/app/panel/layout.tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono, JetBrains_Mono } from "next/font/google";
import "../globals.css";
import { SITE_ICONS } from "@/lib/site-config";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeScript } from "@/components/theme-script";
import { ClarityInit } from "@/components/analytics/clarity-init";
import { PanelChromeScript } from "@/components/admin/panel-chrome-script";
import { Toaster } from "@/components/providers/toaster";
import { MotionProvider } from "@/components/providers/motion-provider";
import { QueryProvider } from "@/components/providers/query-provider";
import { requireStaff } from "@/lib/auth/dal";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Boshqaruv paneli · Diesel Parts",
  icons: SITE_ICONS,
  robots: { index: false, follow: false },
};

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  await requireStaff(); // any signed-in staff role; per-page requirePermission() narrows further

  return (
    <html lang="uz" suppressHydrationWarning>
      <body
        className={`admin-root ${geistSans.variable} ${geistMono.variable} ${jetbrainsMono.variable} antialiased`}
      >
        <ClarityInit />
        <ThemeScript />
        <PanelChromeScript />
        <ThemeProvider>
          <MotionProvider>
            <QueryProvider>
              {children}
              <Toaster />
            </QueryProvider>
          </MotionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
```

Delete `frontend/app/panel/_old-panel-layout.tsx` once its content is folded in above.

- [ ] **Step 4: Update every moved page's permission check**

For each moved page/nested-layout, replace its `requireDirector()`/`requireStaff()` call per this mapping (module names match Task 4's table):

| Moved path | Old call | New call |
|---|---|---|
| `panel/analytics/**` | `requireDirector()` | `requirePermission('analytics:read')` |
| `panel/audit/**` | `requireDirector()` | `requirePermission('audit:read')` |
| `panel/categories/**` | `requireDirector()` | `requirePermission('categories:read')` |
| `panel/customers/**` (director-side) | `requireDirector()` | `requirePermission('customers:read')` |
| `panel/discounts/**` | `requireDirector()` | `requirePermission('discounts:approve')` |
| `panel/finance/**` (+ debts, expenses) | `requireDirector()` | `requirePermission('finance:read')` |
| `panel/products/**` | `requireDirector()` | `requirePermission('products:read')` |
| `panel/reviews/**` | `requireDirector()` | `requirePermission('reviews:read')` |
| `panel/users/**` | `requireDirector()` | `requirePermission('users:read')` |
| `panel/warehouse/**` (+ incomes, products, reports, warehouses) | `requireDirector()` | `requirePermission('warehouse:read')` |
| `panel/seller/customers*`, `panel/seller/inquiries`, `panel/seller/orders`, `panel/seller/page.tsx` | `requireStaff()` | unchanged — both roles already pass; **note** the director-side `panel/customers` above and this `panel/seller/customers` are genuinely two different pages (global CRUD vs. the seller's own scoped view, per Task 4 Step 6's deliberate split) — do not merge them into one route |

Since several of these are gated once at a nested `layout.tsx` (e.g. `panel/finance/layout.tsx`, `panel/warehouse/layout.tsx` per the earlier codebase map — those layouts today just comment that they rely on the parent's `requireDirector()`), point the permission check at that nested layout rather than duplicating it into every leaf page.

- [ ] **Step 5: Write `panel/forbidden.tsx`**

```tsx
import Link from "next/link";
import { PanelMessage } from "@/components/admin/panel-message";
import { buttonVariants } from "@/components/ui/button";
import { PANEL_ROOT } from "@/lib/auth/roles";

export default function PanelForbidden() {
  return (
    <PanelMessage
      eyebrow="Boshqaruv paneli"
      title="Ruxsat yo'q"
      description="Ushbu bo'limga kirish huquqingiz yo'q. Kerak bo'lsa, direktordan so'rang."
      actions={
        <Link href={PANEL_ROOT} className={buttonVariants()}>
          Panelga qaytish
        </Link>
      }
    />
  );
}
```

- [ ] **Step 6: Port `error.tsx`/`not-found.tsx`**

Copy `frontend/app/admin/error.tsx` → `frontend/app/panel/error.tsx` and `frontend/app/admin/not-found.tsx` → `frontend/app/panel/not-found.tsx`, replacing `ADMIN_ROOT` references with `PANEL_ROOT` and the "Panelga qaytish" link target accordingly. Delete `frontend/app/admin/boundaries.test.tsx` and re-create it as `frontend/app/panel/boundaries.test.tsx` with the same two `describe` blocks, importing from `./error`/`./not-found` (relative paths unchanged in meaning, just a new directory) and asserting the link target is `/panel` instead of `/admin`.

- [ ] **Step 7: Update `admin-nav.ts` to filter by `can()`**

Read the current `ADMIN_NAV`/`navFor`/`SELLER_BOTTOM_NAV` shape first (each entry has a hardcoded `roles: [...]` array per the codebase map) and change each entry's `roles` field to a `permission: Permission` field, then rewrite `navFor`:
```ts
import { can, type Permission } from "./permissions";
// ...
export function navFor(role: StaffRole) {
  return ADMIN_NAV.filter((item) => can(role, item.permission));
}
```
Assign each existing nav entry its module's `:read` permission per Task 4's table (analytics→`analytics:read`, audit→`audit:read`, categories→`categories:read`, customers→`customers:read`, discounts→`discounts:approve`, finance→`finance:read`, products→`products:read`, reviews→`reviews:read`, users→`users:read`, warehouse→`warehouse:read`; the three seller routes keep whatever permission their page now requires, e.g. `orders:read`/`inquiries:read`/`customers:read`).

- [ ] **Step 8: Hide seller-inaccessible create/edit/delete controls**

Grep the moved `panel/reviews/**` and `panel/warehouse/**` component trees (`frontend/components/director/**` referenced by them) for approve/delete/moderate buttons and wrap them in `can(user.role, 'reviews:update')` / `can(user.role, 'warehouse:update')` (or `:delete`) checks, passing `user.role` down from the page (which already has it from `requirePermission()`'s returned `StaffUser`). Keep this to the specific action buttons the spec calls out ("create/edit/delete tugmalari yashirilsin") — don't add new gating to read-only tables/lists, those already work for SELLER since the permission check upstream now passes.

- [ ] **Step 9: Delete the superseded `/admin` and `/director/(panel)` trees**

```bash
rm -rf frontend/app/admin
git rm -r --cached frontend/app/admin 2>/dev/null || true
rmdir "frontend/app/director/(panel)" 2>/dev/null || true
```
Keep `frontend/app/director/login`, `frontend/app/director/layout.tsx`, `frontend/app/director/not-found.tsx`, `frontend/app/director/error.tsx`, `frontend/app/director/[...unmatched]` — these still serve the login screen.

- [ ] **Step 10: Run the frontend build to catch every dangling import**

Run: `cd frontend && npx tsc --noEmit`
Expected: surfaces every remaining reference to deleted exports (`adminHomePath`, `ADMIN_ROOT`, `canAccessAdminPath`, old `/admin`/`/director/(panel)` paths in tests or components) — fix each until clean.

- [ ] **Step 11: Commit**

```bash
git add -A frontend/app frontend/lib/auth/admin-nav.ts frontend/components/admin
git commit -m "feat(panel): merge /director and /admin/seller into one /panel route group"
```

## Task 7: Redirects

**Files:**
- Modify: `frontend/next.config.ts` (already touched in Task 5 Step 7 for `authInterrupts` — add `redirects()` alongside it)
- Create: `frontend/next.config.test.ts` (new — this repo's `next.config.ts` has no existing test per the codebase map; a plain function-export test is enough, no Next runtime needed)
- Modify: `frontend/app/api/v1/auth/login/route.ts` (replace any `adminHomePath(role)` post-login destination with the flat `/panel`)

- [ ] **Step 1: Write the redirects, with a test first**

```ts
// frontend/next.config.test.ts
import { describe, expect, it } from "vitest";
import nextConfig from "./next.config";

describe("next.config redirects", () => {
  it("sends /admin, /director/*, and /admin/seller/* to /panel, permanently", async () => {
    const redirects = await nextConfig.redirects!();
    expect(redirects).toEqual(
      expect.arrayContaining([
        { source: "/admin", destination: "/panel", permanent: true },
        { source: "/director/:path*", destination: "/panel/:path*", permanent: true },
        { source: "/admin/seller/:path*", destination: "/panel/:path*", permanent: true },
      ]),
    );
  });
});
```

- [ ] **Step 2: Run it, confirm it fails**

Run: `cd frontend && npx vitest run next.config.test.ts`
Expected: FAIL — `nextConfig.redirects` is undefined.

- [ ] **Step 3: Implement**

```ts
// frontend/next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    authInterrupts: true,
  },
  async redirects() {
    return [
      { source: "/admin", destination: "/panel", permanent: true },
      // `/director/login` must NOT be swept up by this — Next matches the
      // most specific route first, but `/director/:path*` would still match
      // `/director/login` itself. Exclude it explicitly.
      { source: "/director/login", destination: "/director/login", permanent: false },
      { source: "/director/:path*", destination: "/panel/:path*", permanent: true },
      { source: "/admin/seller/:path*", destination: "/panel/:path*", permanent: true },
    ];
  },
};

export default nextConfig;
```

Wait — a redirect from a path to itself is a no-op footgun, not a real exclusion (Next still evaluates rules in array order and the self-redirect entry does nothing to stop the next matching rule from also firing). Use Next's documented `missing`/ordering behavior instead: list the specific `/director/login` exemption by placing no rule for it and instead scoping the general rule to exclude it via a `has`/negative-lookahead-style path segment. Next's redirect `source` supports path-to-regexp syntax, so exclude with a negative lookahead segment:

```ts
{ source: "/director/:path((?!login).*)", destination: "/panel/:path*", permanent: true },
```

Verify this regex actually compiles under Next 16's path-to-regexp version by running the test — if `:path((?!login).*)` isn't supported, fall back to two explicit rules ordered before the catch-all is not possible with `redirects()` (no ordering guarantee against page routes), so instead keep `/director/login` working by relying on Next's routing precedence: **an actual existing page always wins over a `redirects()` rule for the exact same path in Next's App Router** — confirm this by testing `/director/login` still renders (not redirects) in Step 4 below; if it does, the plain `/director/:path*` rule is fine as originally written and this whole regex detour is unnecessary. Prefer that simpler outcome; only keep the negative-lookahead version if the plain test in Step 4 shows `/director/login` incorrectly redirecting.

- [ ] **Step 4: Run the redirect test, and manually verify the login-page precedence question above**

Run: `cd frontend && npx vitest run next.config.test.ts`
Expected: PASS.

Run: `cd frontend && npm run dev` (background), then check both:
- `curl -sI http://localhost:3000/director/login` → expect `200`, not a redirect.
- `curl -sI http://localhost:3000/director/analytics` → expect `308` to `/panel/analytics`.
Stop the dev server after.

- [ ] **Step 5: Update the login route's post-login destination**

In `frontend/app/api/v1/auth/login/route.ts`, replace whatever currently computes `adminHomePath(role)` (or an inline equivalent) with the flat literal `"/panel"` — both roles land in the same place now, and per-page `requirePermission()` handles the rest.

- [ ] **Step 6: Run the full frontend test file for the login route**

Run: `cd frontend && npx vitest run app/api/v1/auth/login`
Expected: PASS (update any test asserting the old per-role destination).

- [ ] **Step 7: Commit**

```bash
git add frontend/next.config.ts frontend/next.config.test.ts frontend/app/api/v1/auth/login/route.ts
git commit -m "feat(panel): redirect the old /admin and /director paths to /panel"
```

## Task 8: Cross-role integration tests (backend + frontend)

**Files:**
- Create: `backend/test/permissions.e2e-spec.ts` (or extend the existing e2e harness pattern in `backend/test/` — check `backend/test/jest-e2e.json`'s `rootDir`/test match glob first and follow its existing setup, e.g. how it spins up `INestApplication` and seeds a test user, before writing this fresh)
- Create: `frontend/app/panel/access.test.tsx` (or wherever the codebase map's page-level tests already live for the moved pages — follow that convention)

- [ ] **Step 1: Backend e2e — SELLER blocked, DIRECTOR unrestricted**

Follow whatever fixture pattern the existing `backend/test/*.e2e-spec.ts` files use for seeding a `DIRECTOR` and `SELLER` user and minting a JWT (read one existing e2e spec first — do not invent a new auth bootstrapping approach if one already exists). Then:
```ts
describe('permission boundaries', () => {
  it('403s a SELLER on GET /finance', () => request(app.getHttpServer())
    .get('/finance')
    .set('Authorization', `Bearer ${sellerToken}`)
    .expect(403));

  it('403s a SELLER on GET /analytics', () => request(app.getHttpServer())
    .get('/analytics')
    .set('Authorization', `Bearer ${sellerToken}`)
    .expect(403));

  it('403s a SELLER on GET /users', () => request(app.getHttpServer())
    .get('/users')
    .set('Authorization', `Bearer ${sellerToken}`)
    .expect(403));

  it('403s a SELLER on GET /audit', () => request(app.getHttpServer())
    .get('/audit')
    .set('Authorization', `Bearer ${sellerToken}`)
    .expect(403));

  it('lets a DIRECTOR through all four', async () => {
    for (const path of ['/finance', '/analytics', '/users', '/audit']) {
      await request(app.getHttpServer())
        .get(path)
        .set('Authorization', `Bearer ${directorToken}`)
        .expect((res) => expect(res.status).not.toBe(403));
    }
  });
});
```

- [ ] **Step 2: Run it**

Run: `cd backend && npm run test:e2e -- permissions`
Expected: PASS.

- [ ] **Step 3: Frontend — SELLER hits `forbidden()` on a director-only panel page**

Mock `requireStaff`'s underlying session (`getStaffSession`/`backendRequest('/auth/me')`) to return a SELLER user, render `frontend/app/panel/finance/page.tsx` (or the closest server-component test pattern already used for these pages — check an existing test for a moved page first) and assert it calls Next's `forbidden()` (mock `next/navigation`'s `forbidden` and assert it was called, the standard way this codebase already tests `redirect()` calls — check `frontend/lib/auth/roles.test.ts`'s previous incarnation or a page test for the existing pattern before writing a new one).

- [ ] **Step 4: Run it**

Run: `cd frontend && npx vitest run app/panel/access.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/test/permissions.e2e-spec.ts frontend/app/panel/access.test.tsx
git commit -m "test(auth): cross-role e2e/integration coverage for the permission boundary"
```

## Task 9: Full verification + cleanup report

- [ ] **Step 1: Backend**

Run: `cd backend && npx tsc --noEmit -p tsconfig.json && npx eslint "{src,apps,libs,test}/**/*.ts" && npx jest && npm run test:e2e && npx nest build`
Expected: all clean/green.

- [ ] **Step 2: Frontend**

Run: `cd frontend && npx tsc --noEmit && npx eslint . && npx vitest run && npx next build`
Expected: all clean/green.

- [ ] **Step 3: Grep sweep for leftovers**

Run: `grep -rn "SUPER_ADMIN\|MANAGER_UP\|DIRECTOR_UP\|SELLER_UP\|isDirectorTier\|adminHomePath\|requireDirector" backend/src frontend/app frontend/lib frontend/components`
Expected: zero hits (aside from this plan file and migration SQL's historical `SUPER_ADMIN`/`MANAGER` literals, which are supposed to stay — they're the source values the migration reads *from*).

- [ ] **Step 4: Write the final report** (as the last message of this run, not a new file) covering: files deleted (`roles.ts`, `roles.guard.ts`, `roles.decorator.ts`, the `/admin` tree, `/director/(panel)`), the full redirect list, the permission table (already in this plan), and the one open item: production DB has not been migrated yet (Task 1 only touched `diesel_parts_staging`) — `prisma migrate deploy` against prod is a separate, explicitly-confirmed step per this repo's own production-data guard rail, not part of this autonomous run.
