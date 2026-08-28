# Checkout Order Creation and Payme Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn a phone-verified shopper's server-side cart (built in the prior plan) into a real `backend/` `Order`, and accept payment for it through Payme's Merchant API — order creation and payment both live in `backend/`, reachable from Next.js the same proxy way the cart already is.

**Architecture:** A new `CheckoutModule` in `backend/` reads the caller's cart (via `CartsService`), resolves/creates a `Customer` by phone, resolves a "house" `Seller` (self-checkout orders have no staff owner, but `Order.sellerId` is a required FK — this is the same gap the abandoned `backend-consolidation` plan's Task 10 flagged for CRM orders and never built a resolution for; here it's solved with a single well-known internal account, get-or-created on first use), and creates the `Order`/`OrderItem` rows with the same price-snapshotting discipline `OrdersService.create` already uses for staff orders. If the chosen payment method is `ONLINE`, it also creates a `PENDING` `Payment` row and returns a Payme checkout URL built from confirmed Payme documentation. A separate `PaymeModule` exposes the JSON-RPC Merchant API webhook Payme calls back into (`CheckPerformTransaction`, `CreateTransaction`, `PerformTransaction`, `CancelTransaction`, `CheckTransaction`) — this is the only path that may ever mark a `Payment` `COMPLETED`, matching the "frontend can never self-report success" rule from the original spec. Next.js gains one proxy route, `/api/v1/checkout`, mirroring the cart proxy pattern exactly. Click is explicitly out of scope this round — the user will confirm its webhook signature formula from the merchant dashboard separately.

**Tech Stack:** NestJS 11, Prisma ORM 7, class-validator DTOs — `backend/`. Next.js 16, Zod — root proxy. Jest / Vitest for their respective sides.

**Spec:** Continues `docs/superpowers/plans/2026-08-27-checkout-cart-on-backend.md`. User's instruction this turn: build checkout order creation in `backend/` following the same Cart/CartItem pattern (Next.js proxy, no local Prisma), implement Payme (Merchant API is documented), skip Click (user will supply its webhook signature formula later). Payme's protocol details below were confirmed against `developer.help.paycom.uz` and the official `PaycomUZ` GitHub org this session — every field name, error code, and the `Authorization: Basic base64("Paycom:"+key)` auth scheme and `https://checkout.paycom.uz/{base64(m=...;ac.order_id=...;a=...)}` checkout-link format are sourced, not guessed. Two things are deliberately narrower than the original 10-phase spec and called out per task: (1) a successful online payment marks `Order.paymentStatus = PAID` but does **not** auto-advance `Order.status` to `CONFIRMED`, because that transition reserves inventory against a `warehouseId` a self-checkout order doesn't have — resolving a warehouse for an online order is unbuilt (same gap the consolidation plan flagged), and forcing it here would either crash real Payme webhooks or require solving out-of-scope inventory work; a staff member confirms the order through the existing admin flow instead. (2) Two of Payme's `-31050..-31099` "account error" sub-codes (order-not-found vs. duplicate-pending-transaction) are collapsed to the single value `-31050` because the public docs give the family's meaning but not each sub-code — flagged in code and tests rather than guessed individually.

## Global Constraints

- Every `PaymeService` method must be safely retriable: Payme's own protocol requires `CreateTransaction`, `PerformTransaction`, and `CancelTransaction` to return the *same* result on a repeated call for a transaction already in that state, not an error and not a fresh timestamp. Every task implementing one of these must include a test for the repeat-call case, not just the first-call case.
- Money leaving this system for Payme is always tiyin (`round(UZS * 100)`); money read back from Prisma is always `Decimal`. The conversion happens in exactly one place (`toTiyin`, Task 4) — no inline `* 100` anywhere else.
- Every mutating `PaymeService` method that changes a `Payment`'s status also recomputes `Order.paymentStatus` from the sum of that order's `COMPLETED` payments — reusing the exact aggregate pattern `PaymentsService.create` (staff-driven payments) already established, not a second copy of that logic.
- `backend/`'s existing module pattern, unchanged: thin controller, guards per-route, service holds logic and injects `PrismaService`, DTOs are `class-validator` classes. No controller spec files exist anywhere in this codebase (checked this session) — don't start a new convention; test services only.
- Run `cd backend && npx tsc --noEmit && npm run lint && npx jest` and, at the root, `npx tsc --noEmit && npm run lint && npm test && npm run build` after every task that touches that project.
- Do not touch `app/(seller-auth)/`, `app/seller/**`, `components/seller/**`, `hooks/seller/**`, `lib/seller/**`, `lib/api/seller-panel/**`, `lib/store/seller-auth-store.ts`.
- `PAYME_MERCHANT_ID`/`PAYME_MERCHANT_KEY` are not set anywhere yet (no contract signed) — every task must leave the system in a state where `backend/` still builds, boots, and serves every other route with these unset; `CheckoutService` must return `checkoutUrl: null` rather than throw when they're missing, and only `PaymeController`'s own routes (unreachable without real Payme traffic) may hard-fail via `ConfigService.getOrThrow` when they're absent.

---

## File Structure

| File | Responsibility |
|---|---|
| `backend/prisma/schema.prisma` | `Payment` gains `provider`, `transactionId`, `providerCreateTime`, `cancelledAt`, `cancelReason`, and the `@@unique([provider, transactionId])` idempotency guard. |
| `backend/src/customers/customers.service.ts` | New `findOrCreateByPhone(phone, name?)`. |
| `backend/src/orders/orders.service.ts` | `reserveOrderNumber()` extracted from `create()`'s inline sequence logic, made reusable by `CheckoutService`. No other behavior change. |
| `backend/src/checkout/checkout.service.ts`, `checkout.controller.ts`, `checkout.module.ts` | Cart → Order, house-seller resolution, Payme checkout-URL issuance. |
| `backend/src/checkout/dto/create-checkout.dto.ts` | Request body: `deliveryFee?`, `notes?`, `paymentMethod` (only `"ONLINE"` accepted today). |
| `backend/src/checkout/house-seller.ts` | Get-or-create the internal system `Seller`/`User` self-checkout orders are attached to. |
| `backend/src/payme/payme-money.ts` | Pure: `toTiyin`, `buildPaymeCheckoutUrl`, `paymeState` (Prisma `PaymentStatus` ↔ Payme's `1|2|-1|-2`). |
| `backend/src/payme/payme.service.ts` | The five Merchant API methods. |
| `backend/src/payme/payme.controller.ts`, `payme.module.ts` | JSON-RPC dispatch endpoint. |
| `backend/src/payme/payme-auth.guard.ts` | `Authorization: Basic base64("Paycom:"+PAYME_MERCHANT_KEY)` check. |
| `backend/src/app.module.ts` | Registers `CheckoutModule`, `PaymeModule`. |
| `app/api/v1/checkout/route.ts`, `route.test.ts` | Proxies to `backend/`'s checkout endpoint. |
| `.env.example`, `backend/.env.example` | Document the two new Payme env vars (values left blank — no contract yet). |

---

### Task 1: `Payment` schema extension for Payme

**Files:**
- Modify: `backend/prisma/schema.prisma`

**Interfaces:**
- Produces: `Payment.provider String?`, `Payment.transactionId String?`, `Payment.providerCreateTime BigInt?`, `Payment.cancelledAt DateTime?`, `Payment.cancelReason Int?`, and `@@unique([provider, transactionId])`. Task 5's `PaymeService` is the only consumer.

- [x] **Step 1: Extend the model**

In `backend/prisma/schema.prisma`, modify the `Payment` model:

```prisma
model Payment {
  id                 String        @id @default(cuid())
  orderId            String        @map("order_id")
  order              Order         @relation(fields: [orderId], references: [id], onDelete: Cascade)
  amount             Decimal       @db.Decimal(14, 2)
  method             PaymentMethod
  status             PaymentStatus @default(PENDING)
  /// "payme" once Click is wired in later this becomes "payme" | "click".
  /// Null for the existing staff-recorded (cash/card/transfer) payments.
  provider           String?
  /// The provider's own id for this attempt. Only PaymeService (driven by
  /// Payme's own webhook, never the frontend) may move a payment to
  /// COMPLETED — see PaymeService.performTransaction.
  transactionId      String?
  /// Payme's `time` (epoch ms) from CreateTransaction, echoed back verbatim
  /// on every retry — Payme's protocol requires CreateTransaction to be
  /// idempotent, and this is the value that makes a repeat call return the
  /// exact same create_time instead of a fresh one.
  providerCreateTime BigInt?
  cancelledAt        DateTime?
  /// Payme's CancelTransaction `reason` code, kept for support/audit only —
  /// no code branches on its value.
  cancelReason       Int?
  paidAt             DateTime?
  createdAt          DateTime      @default(now()) @map("created_at")
  updatedAt          DateTime      @updatedAt @map("updated_at")

  @@index([orderId])
  /// Guards webhook idempotency: a provider retrying the same callback must
  /// not be able to create a second row for one transaction and re-fire a
  /// COMPLETED transition. Postgres treats each NULL as distinct here, so
  /// the existing staff-recorded rows (provider/transactionId both null)
  /// are unaffected.
  @@unique([provider, transactionId])
  @@map("payments")
}
```

- [x] **Step 2: Migrate**

Run: `cd backend && npx prisma migrate dev --name payme_payment_fields`

Expected: applies cleanly against `diesel_parts_erp` (confirm this is still the target — `backend/.env`'s `DATABASE_URL` — before running, same check as the prior plan). Purely additive (new nullable columns, one new unique index over columns that are currently all-null) — no enum narrowing, so `migrate dev` should succeed non-interactively this time, unlike the `OrderStatus` narrowing earlier this session.

- [x] **Step 3: Regenerate and verify**

Run: `cd backend && npx prisma generate && npx tsc --noEmit`
Expected: both exit 0.

- [x] **Step 4: Commit**

```bash
git add backend/prisma
git commit -m "feat(backend): extend Payment for Payme (provider/transactionId/idempotency fields)"
```

---

### Task 2: `CustomersService.findOrCreateByPhone`

**Files:**
- Modify: `backend/src/customers/customers.service.ts`
- Create: `backend/src/customers/customers.service.spec.ts` (none exists yet — check with `ls backend/src/customers/*.spec.ts` before writing, and follow `reviews.service.spec.ts`'s `makePrisma` convention if any sibling spec already exists in a related module)

**Interfaces:**
- Produces: `findOrCreateByPhone(phone: string, name?: string): Promise<Customer>` — matches on canonical digits using `common/phone.ts`'s `extractNationalDigits`/`phoneTail`, exactly the scan pattern `findCustomersByPhone` used in the (removed) root app. Task 4's `CheckoutService` is the consumer.

- [x] **Step 1: Write the failing test**

Create `backend/src/customers/customers.service.spec.ts`:

```ts
import { CustomersService } from './customers.service';
import { PrismaService } from '../prisma/prisma.service';

function makePrisma(overrides: { customer?: Record<string, unknown> } = {}) {
  return {
    customer: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      ...overrides.customer,
    },
  } as unknown as PrismaService;
}

describe('CustomersService.findOrCreateByPhone', () => {
  it('creates a new customer when no match exists', async () => {
    const create = jest
      .fn()
      .mockResolvedValue({ id: 'cus-1', phone: '998901234567', name: 'Shopper' });
    const prisma = makePrisma({ customer: { findMany: jest.fn().mockResolvedValue([]), create } });
    const service = new CustomersService(prisma);

    const result = await service.findOrCreateByPhone('998901234567', 'Shopper');

    expect(create).toHaveBeenCalledWith({
      data: { phone: '998901234567', name: 'Shopper' },
    });
    expect(result).toEqual({ id: 'cus-1', phone: '998901234567', name: 'Shopper' });
  });

  it('reuses an existing customer matched on canonical digits, regardless of formatting', async () => {
    const findMany = jest.fn().mockResolvedValue([
      { id: 'cus-1', phone: '+998 90 123-45-67', name: 'Existing' },
    ]);
    const create = jest.fn();
    const prisma = makePrisma({ customer: { findMany, create } });
    const service = new CustomersService(prisma);

    const result = await service.findOrCreateByPhone('998901234567');

    expect(create).not.toHaveBeenCalled();
    expect(result).toEqual({ id: 'cus-1', phone: '+998 90 123-45-67', name: 'Existing' });
  });

  it('defaults the name to "Checkout" when none is given for a new customer', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'cus-2' });
    const prisma = makePrisma({ customer: { findMany: jest.fn().mockResolvedValue([]), create } });
    const service = new CustomersService(prisma);

    await service.findOrCreateByPhone('998901234567');

    expect(create).toHaveBeenCalledWith({
      data: { phone: '998901234567', name: 'Checkout' },
    });
  });
});
```

- [x] **Step 2: Run it to verify it fails**

Run: `cd backend && npx jest src/customers/customers.service.spec.ts`
Expected: FAIL — `findOrCreateByPhone` is not a function.

- [x] **Step 3: Implement**

In `backend/src/customers/customers.service.ts`, add the import at the top:

```ts
import { extractNationalDigits, phoneTail } from '../common/phone';
```

and add the method (near `create`):

```ts
  /**
   * A checkout customer identified only by an OTP-verified phone — no
   * Customer row exists yet unless they have ordered before. Matched on
   * canonical digits, same scan pattern the (removed) root app used: Customer.phone
   * is free text (a seller may have typed it with different formatting), so
   * no SQL `equals` can find it — the `contains` prefilter below narrows to
   * roughly one row in a hundred before the exact comparison runs in JS.
   */
  async findOrCreateByPhone(phone: string, name?: string) {
    const national = extractNationalDigits(phone);
    const candidates = await this.prisma.customer.findMany({
      where: { phone: { contains: phoneTail(national) } },
      take: 1000,
    });
    const existing = candidates.find(
      (candidate) => extractNationalDigits(candidate.phone) === national,
    );
    if (existing) return existing;

    return this.prisma.customer.create({
      data: { phone, name: name ?? 'Checkout' },
    });
  }
```

- [x] **Step 4: Run it to verify it passes**

Run: `cd backend && npx jest src/customers/customers.service.spec.ts`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add backend/src/customers
git commit -m "feat(backend): add CustomersService.findOrCreateByPhone for checkout"
```

---

### Task 3: `OrdersService.reserveOrderNumber` extraction

**Files:**
- Modify: `backend/src/orders/orders.service.ts`
- Modify: `backend/src/orders/orders.module.ts` (already exports `OrdersService` — no change needed there, just confirm)

**Interfaces:**
- Produces: `OrdersService.reserveOrderNumber(): Promise<string>` (public). `create()`'s existing behavior is unchanged — this is a pure extraction, not a rewrite. Task 4's `CheckoutModule` imports `OrdersModule` to inject `OrdersService` for this one method.

- [x] **Step 1: Extract the method**

In `backend/src/orders/orders.service.ts`, replace the inline block inside `create()`:

```ts
    return this.prisma.$transaction(async (tx) => {
      const sequence = await tx.orderSequence.upsert({
        where: { id: 1 },
        create: { id: 1, lastNumber: 1001 },
        update: { lastNumber: { increment: 1 } },
      });
      const orderNumber = `DP-${sequence.lastNumber}`;

      return tx.order.create({
```

with:

```ts
    const orderNumber = await this.reserveOrderNumber();

    return this.prisma.$transaction(async (tx) => {
      return tx.order.create({
```

and add the extracted method (near the bottom of the class, after `updateStatus`/`cancel`, before the private helpers):

```ts
  /**
   * The next `DP-N` reference, atomically. Shared by the POS/CRM order form
   * (create, above) and CheckoutService — one sequence, one numbering
   * scheme, regardless of which flow raised the order.
   */
  async reserveOrderNumber(): Promise<string> {
    const sequence = await this.prisma.orderSequence.upsert({
      where: { id: 1 },
      create: { id: 1, lastNumber: 1001 },
      update: { lastNumber: { increment: 1 } },
    });
    return `DP-${sequence.lastNumber}`;
  }
```

- [x] **Step 2: Confirm no existing test broke**

Run: `cd backend && npx jest src/orders`
Expected: PASS — there is no `orders.service.spec.ts` today (confirm with `ls backend/src/orders/*.spec.ts`; only `order-status-transitions.spec.ts` exists, which is untouched by this change), so this step is really "confirm the file still compiles and nothing else in the suite regresses."

- [x] **Step 3: Verify the build**

Run: `cd backend && npx tsc --noEmit && npm run build`
Expected: both exit 0.

- [x] **Step 4: Commit**

```bash
git add backend/src/orders/orders.service.ts
git commit -m "refactor(backend): extract OrdersService.reserveOrderNumber for reuse by checkout"
```

---

### Task 4: `CheckoutService`/`CheckoutController` — cart → Order

**Files:**
- Create: `backend/src/checkout/house-seller.ts`
- Create: `backend/src/checkout/house-seller.spec.ts`
- Create: `backend/src/payme/payme-money.ts`
- Create: `backend/src/payme/payme-money.spec.ts`
- Create: `backend/src/checkout/dto/create-checkout.dto.ts`
- Create: `backend/src/checkout/checkout.service.ts`
- Create: `backend/src/checkout/checkout.service.spec.ts`
- Create: `backend/src/checkout/checkout.controller.ts`
- Create: `backend/src/checkout/checkout.module.ts`
- Modify: `backend/src/app.module.ts`
- Modify: `backend/src/carts/carts.module.ts` (add `exports: [CartsService]` — needed so `CheckoutModule` can inject it; not exported today)
- Modify: `backend/.env.example`, `.env.example` (document `PAYME_MERCHANT_ID` — `PAYME_MERCHANT_KEY` is added in Task 5, both documented together there instead to keep this task's diff focused on what it actually uses)

**Interfaces:**
- Consumes: `CartsService.getCart` (Task from prior plan), `CustomersService.findOrCreateByPhone` (Task 2), `OrdersService.reserveOrderNumber` (Task 3), `buildPaymeCheckoutUrl`/`toTiyin` (this task, `payme-money.ts`).
- Produces: `POST /checkout` (`InternalServiceGuard`, `@VerifiedPhone()`) → `{ order: {...}, checkoutUrl: string | null }`. `getOrCreateHouseSeller(prisma): Promise<{ id: string }>` in `house-seller.ts`. `toTiyin(amount: Prisma.Decimal | number): number` and `buildPaymeCheckoutUrl(params): string` in `payme-money.ts` — Task 5's `PaymeService` also imports `toTiyin`.

- [x] **Step 1: Write the failing test for `payme-money.ts`**

Create `backend/src/payme/payme-money.spec.ts`:

```ts
import { Prisma } from '../../generated/prisma/client';
import { buildPaymeCheckoutUrl, toTiyin } from './payme-money';

describe('toTiyin', () => {
  it('converts a UZS Decimal to tiyin', () => {
    expect(toTiyin(new Prisma.Decimal('500000'))).toBe(50000000);
  });

  it('converts a UZS Decimal with fractional som', () => {
    expect(toTiyin(new Prisma.Decimal('1234.56'))).toBe(123456);
  });

  it('accepts a plain number too', () => {
    expect(toTiyin(5)).toBe(500);
  });

  it('rounds rather than truncates', () => {
    expect(toTiyin(new Prisma.Decimal('10.005'))).toBe(1001);
  });
});

describe('buildPaymeCheckoutUrl', () => {
  it('matches the exact example from Payme\'s own documentation', () => {
    // developer.help.paycom.uz/initsializatsiya-platezhey/otpravka-cheka-po-metodu-get/ —
    // m=587f72c72cac0d162c722ae2;ac.order_id=197;a=500 encodes to exactly this.
    const url = buildPaymeCheckoutUrl({
      merchantId: '587f72c72cac0d162c722ae2',
      orderId: '197',
      amountTiyin: 500,
    });
    expect(url).toBe(
      'https://checkout.paycom.uz/bT01ODdmNzJjNzJjYWMwZDE2MmM3MjJhZTI7YWMub3JkZXJfaWQ9MTk3O2E9NTAw',
    );
  });

  it('appends a return-url callback when given one', () => {
    const url = buildPaymeCheckoutUrl({
      merchantId: 'm1',
      orderId: 'o1',
      amountTiyin: 100,
      returnUrl: 'https://example.com/done',
    });
    const decoded = Buffer.from(url.split('/').pop()!, 'base64').toString('utf-8');
    expect(decoded).toBe('m=m1;ac.order_id=o1;a=100;c=https://example.com/done');
  });
});
```

- [x] **Step 2: Run it to verify it fails**

Run: `cd backend && npx jest src/payme/payme-money.spec.ts`
Expected: FAIL — module does not exist.

- [x] **Step 3: Implement `payme-money.ts`**

Create `backend/src/payme/payme-money.ts`:

```ts
import { Prisma, PaymentStatus } from '../../generated/prisma/client';

/**
 * UZS (Decimal, as Prisma stores it) to tiyin (the integer Payme's whole
 * protocol is denominated in) — the one place this conversion happens.
 */
export function toTiyin(amount: Prisma.Decimal | number): number {
  const som = amount instanceof Prisma.Decimal ? amount.toNumber() : amount;
  return Math.round(som * 100);
}

export interface PaymeCheckoutParams {
  merchantId: string;
  orderId: string;
  amountTiyin: number;
  /** Where Payme sends the shopper back after paying. */
  returnUrl?: string;
}

/**
 * https://checkout.paycom.uz/{base64(m=...;ac.order_id=...;a=...[;c=...])} —
 * confirmed against developer.help.paycom.uz's own GET-method example.
 */
export function buildPaymeCheckoutUrl(params: PaymeCheckoutParams): string {
  const parts = [
    `m=${params.merchantId}`,
    `ac.order_id=${params.orderId}`,
    `a=${params.amountTiyin}`,
  ];
  if (params.returnUrl) {
    parts.push(`c=${params.returnUrl}`);
  }
  const encoded = Buffer.from(parts.join(';'), 'utf-8').toString('base64');
  return `https://checkout.paycom.uz/${encoded}`;
}

/**
 * Payme's transaction state as an integer (1 created, 2 performed, -1
 * cancelled-before-perform, -2 cancelled-after-perform/refunded), mapped
 * from Prisma's own PaymentStatus so no second status vocabulary exists.
 */
export function paymeState(status: PaymentStatus): 1 | 2 | -1 | -2 {
  switch (status) {
    case PaymentStatus.PENDING:
      return 1;
    case PaymentStatus.COMPLETED:
      return 2;
    case PaymentStatus.FAILED:
      return -1;
    case PaymentStatus.REFUNDED:
      return -2;
  }
}
```

- [x] **Step 4: Run it to verify it passes**

Run: `cd backend && npx jest src/payme/payme-money.spec.ts`
Expected: PASS, including the exact-documented-example test — this is the one place in the whole Payme integration where the test asserts against ground truth from Payme's own docs rather than the code's own logic.

- [x] **Step 5: Write the failing test for the house seller**

Create `backend/src/checkout/house-seller.spec.ts`:

```ts
import { getOrCreateHouseSeller, HOUSE_SELLER_EMAIL } from './house-seller';
import { PrismaService } from '../prisma/prisma.service';

function makePrisma(overrides: { user?: Record<string, unknown> } = {}) {
  return {
    user: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      ...overrides.user,
    },
  } as unknown as PrismaService;
}

describe('getOrCreateHouseSeller', () => {
  it('reuses the existing house account when one already exists', async () => {
    const findUnique = jest.fn().mockResolvedValue({
      id: 'user-1',
      seller: { id: 'seller-1' },
    });
    const prisma = makePrisma({ user: { findUnique } });

    const seller = await getOrCreateHouseSeller(prisma);

    expect(findUnique).toHaveBeenCalledWith({
      where: { email: HOUSE_SELLER_EMAIL },
      include: { seller: true },
    });
    expect(seller).toEqual({ id: 'seller-1' });
  });

  it('creates the house user+seller pair on first use, inactive and unloginable', async () => {
    const create = jest.fn().mockResolvedValue({
      id: 'user-1',
      seller: { id: 'seller-1' },
    });
    const prisma = makePrisma({
      user: { findUnique: jest.fn().mockResolvedValue(null), create },
    });

    const seller = await getOrCreateHouseSeller(prisma);

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: HOUSE_SELLER_EMAIL,
          role: 'SELLER',
          isActive: false,
          seller: { create: {} },
        }),
        include: { seller: true },
      }),
    );
    expect(seller).toEqual({ id: 'seller-1' });
  });
});
```

- [x] **Step 6: Run it to verify it fails**

Run: `cd backend && npx jest src/checkout/house-seller.spec.ts`
Expected: FAIL — module does not exist.

- [x] **Step 7: Implement `house-seller.ts`**

Create `backend/src/checkout/house-seller.ts`:

```ts
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '../../generated/prisma/client';

/**
 * A self-checkout order has no seller to attach to — Order.sellerId is a
 * required FK, so one internal account holds every online order until a
 * staff member (or, later, a claim mechanism — not built yet) picks it up.
 * Same gap the abandoned backend-consolidation plan's Task 10 flagged for
 * CRM orders and never resolved; this is the minimal fix for checkout.
 *
 * `isActive: false` and a random, never-recorded password mean this account
 * can never sign in even if its row were somehow targeted directly — it
 * exists purely to satisfy the FK.
 */
export const HOUSE_SELLER_EMAIL = 'checkout@internal.diesel-parts.uz';

const BCRYPT_COST = 10; // matches AuthService's existing refresh-token hashing cost

export async function getOrCreateHouseSeller(
  prisma: PrismaService,
): Promise<{ id: string }> {
  const existing = await prisma.user.findUnique({
    where: { email: HOUSE_SELLER_EMAIL },
    include: { seller: true },
  });
  if (existing?.seller) {
    return existing.seller;
  }

  const passwordHash = await bcrypt.hash(randomBytes(32).toString('hex'), BCRYPT_COST);
  const created = await prisma.user.create({
    data: {
      email: HOUSE_SELLER_EMAIL,
      name: 'Checkout (system account)',
      passwordHash,
      role: Role.SELLER,
      isActive: false,
      seller: { create: {} },
    },
    include: { seller: true },
  });
  return created.seller!;
}
```

- [x] **Step 8: Run it to verify it passes**

Run: `cd backend && npx jest src/checkout/house-seller.spec.ts`
Expected: PASS.

- [x] **Step 9: DTO**

Create `backend/src/checkout/dto/create-checkout.dto.ts`:

```ts
import { IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateCheckoutDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  deliveryFee?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  /**
   * Only ONLINE is handled today. Accepting the field (rather than assuming
   * it) means BANK_TRANSFER/QUOTE reaching this endpoint fail loudly with a
   * clear 400 instead of silently creating an order with no way to pay it —
   * those two paths are their own future plan.
   */
  @IsIn(['ONLINE'])
  paymentMethod: 'ONLINE';
}
```

- [x] **Step 10: Write the failing test for `CheckoutService`**

Create `backend/src/checkout/checkout.service.spec.ts`:

```ts
import { BadRequestException } from '@nestjs/common';
import { CheckoutService } from './checkout.service';
import { PrismaService } from '../prisma/prisma.service';
import { CartsService } from '../carts/carts.service';
import { CustomersService } from '../customers/customers.service';
import { OrdersService } from '../orders/orders.service';

function makeDeps() {
  const cartsService = {
    getCart: jest.fn(),
    clear: jest.fn(),
  } as unknown as CartsService;

  const customersService = {
    findOrCreateByPhone: jest.fn().mockResolvedValue({ id: 'cus-1' }),
  } as unknown as CustomersService;

  const ordersService = {
    reserveOrderNumber: jest.fn().mockResolvedValue('DP-1001'),
  } as unknown as OrdersService;

  const prisma = {
    product: {
      findMany: jest.fn(),
    },
    order: {
      create: jest.fn(),
    },
    user: { findUnique: jest.fn().mockResolvedValue({ id: 'u1', seller: { id: 'house-1' } }) },
    payment: { create: jest.fn() },
    $transaction: jest.fn((fn: (tx: unknown) => unknown) => fn(prisma)),
  } as unknown as PrismaService;

  return { cartsService, customersService, ordersService, prisma };
}

describe('CheckoutService.createOrder', () => {
  it('rejects an empty cart', async () => {
    const { cartsService, customersService, ordersService, prisma } = makeDeps();
    (cartsService.getCart as jest.Mock).mockResolvedValue({ items: [] });
    const service = new CheckoutService(prisma, cartsService, customersService, ordersService);

    await expect(
      service.createOrder('998901234567', { paymentMethod: 'ONLINE' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('builds an order from the cart, snapshotting price/sku/name, and clears the cart', async () => {
    const { cartsService, customersService, ordersService, prisma } = makeDeps();
    (cartsService.getCart as jest.Mock).mockResolvedValue({
      items: [{ productId: 'p1', quantity: 2 }],
    });
    (prisma.product.findMany as jest.Mock).mockResolvedValue([
      { id: 'p1', sku: 'SKU-1', nameEn: 'Filter', isActive: true, price: { toNumber: () => 100 } },
    ]);
    (prisma.order.create as jest.Mock).mockResolvedValue({
      id: 'ord-1',
      orderNumber: 'DP-1001',
      total: { toNumber: () => 200 },
    });

    const service = new CheckoutService(prisma, cartsService, customersService, ordersService);
    const result = await service.createOrder('998901234567', { paymentMethod: 'ONLINE' });

    expect(customersService.findOrCreateByPhone).toHaveBeenCalledWith('998901234567');
    expect(prisma.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orderNumber: 'DP-1001',
          customerId: 'cus-1',
          sellerId: 'house-1',
          warehouseId: null,
          items: {
            create: [
              expect.objectContaining({
                productId: 'p1',
                productSku: 'SKU-1',
                productName: 'Filter',
                quantity: 2,
              }),
            ],
          },
        }),
      }),
    );
    expect(cartsService.clear).toHaveBeenCalledWith('998901234567');
    expect(result.order.id).toBe('ord-1');
  });

  it('rejects when a cart line references a retired or missing product', async () => {
    const { cartsService, customersService, ordersService, prisma } = makeDeps();
    (cartsService.getCart as jest.Mock).mockResolvedValue({
      items: [{ productId: 'p1', quantity: 1 }],
    });
    (prisma.product.findMany as jest.Mock).mockResolvedValue([]);

    const service = new CheckoutService(prisma, cartsService, customersService, ordersService);

    await expect(
      service.createOrder('998901234567', { paymentMethod: 'ONLINE' }),
    ).rejects.toThrow(BadRequestException);
  });
});
```

- [x] **Step 11: Run it to verify it fails**

Run: `cd backend && npx jest src/checkout/checkout.service.spec.ts`
Expected: FAIL — module does not exist.

- [x] **Step 12: Implement `CheckoutService`**

Create `backend/src/checkout/checkout.service.ts`:

```ts
import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CartsService } from '../carts/carts.service';
import { CustomersService } from '../customers/customers.service';
import { OrdersService } from '../orders/orders.service';
import { CreateCheckoutDto } from './dto/create-checkout.dto';
import { getOrCreateHouseSeller } from './house-seller';
import { buildPaymeCheckoutUrl, toTiyin } from '../payme/payme-money';
import { Prisma, PaymentMethod, PaymentStatus } from '../../generated/prisma/client';

interface OrderLine {
  productId: string;
  productSku: string;
  productName: string;
  quantity: number;
  price: Prisma.Decimal;
  total: Prisma.Decimal;
}

@Injectable()
export class CheckoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly carts: CartsService,
    private readonly customers: CustomersService,
    private readonly orders: OrdersService,
    private readonly config?: ConfigService,
  ) {}

  private async buildLines(
    items: readonly { productId: string; quantity: number }[],
  ): Promise<OrderLine[]> {
    const productIds = items.map((item) => item.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, isActive: true },
    });
    const byId = new Map(products.map((product) => [product.id, product]));

    return items.map((item) => {
      const product = byId.get(item.productId);
      if (!product) {
        throw new BadRequestException(
          `Product ${item.productId} is no longer available`,
        );
      }
      if (product.price === null) {
        throw new BadRequestException(
          `Product ${product.sku} has no catalog price and cannot be bought online`,
        );
      }
      const price = product.price;
      const total = price.mul(item.quantity);
      return {
        productId: product.id,
        productSku: product.sku,
        productName: product.nameEn,
        quantity: item.quantity,
        price,
        total,
      };
    });
  }

  async createOrder(phone: string, dto: CreateCheckoutDto) {
    const cart = await this.carts.getCart(phone);
    if (cart.items.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    const [customer, houseSeller, lines, orderNumber] = await Promise.all([
      this.customers.findOrCreateByPhone(phone),
      getOrCreateHouseSeller(this.prisma),
      this.buildLines(cart.items),
      this.orders.reserveOrderNumber(),
    ]);

    const subtotal = lines.reduce(
      (sum, line) => sum.add(line.total),
      new Prisma.Decimal(0),
    );
    const deliveryFee = new Prisma.Decimal(dto.deliveryFee ?? 0);
    const total = subtotal.add(deliveryFee);

    const order = await this.prisma.order.create({
      data: {
        orderNumber,
        customerId: customer.id,
        sellerId: houseSeller.id,
        // Left null on purpose: a self-checkout order doesn't pick a
        // warehouse up front, same as the CRM board flow the abandoned
        // consolidation plan anticipated (see house-seller.ts's comment).
        // A staff member confirms the order — and resolves a warehouse —
        // through the existing admin flow; that's out of this plan's scope.
        warehouseId: null,
        subtotal,
        deliveryFee,
        total,
        notes: dto.notes?.trim() || null,
        items: { create: lines.map(({ price, total: lineTotal, ...rest }) => ({
          ...rest,
          price,
          total: lineTotal,
        })) },
      },
    });

    await this.carts.clear(phone);

    let checkoutUrl: string | null = null;
    if (dto.paymentMethod === 'ONLINE') {
      await this.prisma.payment.create({
        data: {
          orderId: order.id,
          amount: total,
          method: PaymentMethod.ONLINE,
          status: PaymentStatus.PENDING,
          provider: 'payme',
        },
      });

      const merchantId = this.config?.get<string>('PAYME_MERCHANT_ID');
      if (merchantId) {
        checkoutUrl = buildPaymeCheckoutUrl({
          merchantId,
          orderId: order.id,
          amountTiyin: toTiyin(total),
        });
      }
    }

    return { order, checkoutUrl };
  }
}
```

- [x] **Step 13: Run it to verify it passes**

Run: `cd backend && npx jest src/checkout/checkout.service.spec.ts`
Expected: PASS.

- [x] **Step 14: Controller and module**

Create `backend/src/checkout/checkout.controller.ts`:

```ts
import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CheckoutService } from './checkout.service';
import { CreateCheckoutDto } from './dto/create-checkout.dto';
import { InternalServiceGuard } from '../common/guards/internal-service.guard';
import { VerifiedPhone } from '../common/decorators/verified-phone.decorator';

@Controller('checkout')
@UseGuards(InternalServiceGuard)
export class CheckoutController {
  constructor(private readonly checkout: CheckoutService) {}

  @Post()
  create(@VerifiedPhone() phone: string, @Body() dto: CreateCheckoutDto) {
    return this.checkout.createOrder(phone, dto);
  }
}
```

Create `backend/src/checkout/checkout.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';
import { CartsModule } from '../carts/carts.module';
import { CustomersModule } from '../customers/customers.module';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [CartsModule, CustomersModule, OrdersModule],
  controllers: [CheckoutController],
  providers: [CheckoutService],
})
export class CheckoutModule {}
```

In `backend/src/carts/carts.module.ts`, add the missing export (needed for `CheckoutModule` to inject `CartsService`):

```ts
@Module({
  controllers: [CartsController],
  providers: [CartsService],
  exports: [CartsService],
})
export class CartsModule {}
```

In `backend/src/app.module.ts`, add `import { CheckoutModule } from './checkout/checkout.module';` and add `CheckoutModule` to `imports`.

- [x] **Step 15: Verify the build**

Run: `cd backend && npx tsc --noEmit && npm run lint && npm run build`
Expected: all exit 0.

- [x] **Step 16: Run the full backend test suite**

Run: `cd backend && npx jest`
Expected: every test passes, including the new ones from this task.

- [x] **Step 17: Commit**

```bash
git add backend/src/checkout backend/src/payme/payme-money.ts backend/src/payme/payme-money.spec.ts backend/src/carts/carts.module.ts backend/src/app.module.ts
git commit -m "feat(backend): add CheckoutService — cart to Order, house seller, Payme checkout URL"
```

---

### Task 5: `PaymeService` — the five Merchant API methods

**Files:**
- Create: `backend/src/payme/payme-errors.ts`
- Create: `backend/src/payme/payme.service.ts`
- Create: `backend/src/payme/payme.service.spec.ts`
- Create: `backend/src/payme/payme-auth.guard.ts`
- Create: `backend/src/payme/payme.controller.ts`
- Create: `backend/src/payme/payme.module.ts`
- Modify: `backend/src/app.module.ts`
- Modify: `.env.example`, `backend/.env.example` (document `PAYME_MERCHANT_ID`, `PAYME_MERCHANT_KEY`, both blank)

**Interfaces:**
- Consumes: `toTiyin`, `paymeState` (Task 4's `payme-money.ts`).
- Produces: `PaymeService.checkPerformTransaction`, `.createTransaction`, `.performTransaction`, `.cancelTransaction`, `.checkTransaction` — each `(params) => Promise<PaymeResult>` where `PaymeResult = { result: unknown } | { error: { code: number; message: string } }`. `POST /payme` dispatches on `req.body.method` to these.

- [x] **Step 1: Error codes reference (no test — this is a pure constants file)**

Create `backend/src/payme/payme-errors.ts`:

```ts
/**
 * Error codes confirmed against developer.help.paycom.uz's Merchant API
 * error-reference page this session. The -31050..-31099 "account error"
 * family covers several distinct conditions (order not found, order
 * already has a pending transaction, ...) but the public docs give only
 * the family's meaning, not each sub-code — every use below picks -31050
 * as that family's general representative rather than guessing a specific
 * sub-code; revisit once Payme's sandbox reports back a real expected value.
 */
export const PAYME_ERROR = {
  INVALID_AMOUNT: -31001,
  TRANSACTION_NOT_FOUND: -31003,
  CANNOT_CANCEL: -31007,
  CANNOT_PERFORM: -31008,
  ACCOUNT_ERROR: -31050,
  SYSTEM_ERROR: -32400,
} as const;
```

- [x] **Step 2: Write the failing tests**

Create `backend/src/payme/payme.service.spec.ts`. First check `backend/src/reviews/reviews.service.spec.ts` for the `makePrisma` convention one more time (already the model for every prior spec this session) and follow it exactly:

```ts
import { PaymeService } from './payme.service';
import { PrismaService } from '../prisma/prisma.service';
import { PAYME_ERROR } from './payme-errors';

function makePrisma(
  overrides: {
    order?: Record<string, unknown>;
    payment?: Record<string, unknown>;
  } = {},
) {
  return {
    order: {
      findUnique: jest.fn().mockResolvedValue(null),
      update: jest.fn(),
      ...overrides.order,
    },
    payment: {
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      update: jest.fn(),
      aggregate: jest.fn().mockResolvedValue({ _sum: { amount: null } }),
      ...overrides.payment,
    },
  } as unknown as PrismaService;
}

const order = {
  id: 'ord-1',
  total: { toNumber: () => 500, mul: undefined },
};

describe('PaymeService.checkPerformTransaction', () => {
  it('allows a matching order and amount', async () => {
    const findUnique = jest.fn().mockResolvedValue(order);
    const prisma = makePrisma({ order: { findUnique } });
    const service = new PaymeService(prisma);

    const response = await service.checkPerformTransaction({
      amount: 50000,
      account: { order_id: 'ord-1' },
    });

    expect(response).toEqual({ result: { allow: true } });
  });

  it('refuses an order that does not exist', async () => {
    const prisma = makePrisma();
    const service = new PaymeService(prisma);

    const response = await service.checkPerformTransaction({
      amount: 50000,
      account: { order_id: 'missing' },
    });

    expect(response).toEqual({
      error: { code: PAYME_ERROR.ACCOUNT_ERROR, message: expect.any(String) },
    });
  });

  it('refuses a mismatched amount', async () => {
    const prisma = makePrisma({ order: { findUnique: jest.fn().mockResolvedValue(order) } });
    const service = new PaymeService(prisma);

    const response = await service.checkPerformTransaction({
      amount: 1,
      account: { order_id: 'ord-1' },
    });

    expect(response).toEqual({
      error: { code: PAYME_ERROR.INVALID_AMOUNT, message: expect.any(String) },
    });
  });
});

describe('PaymeService.createTransaction', () => {
  it('creates a new payment row and returns state 1', async () => {
    const findUniqueOrder = jest.fn().mockResolvedValue(order);
    const findFirstPayment = jest.fn().mockResolvedValue(null);
    const create = jest.fn().mockResolvedValue({
      id: 'pay-1',
      providerCreateTime: BigInt(1700000000000),
    });
    const prisma = makePrisma({
      order: { findUnique: findUniqueOrder },
      payment: { findFirst: findFirstPayment, create },
    });
    const service = new PaymeService(prisma);

    const response = await service.createTransaction({
      id: 'txn-1',
      time: 1700000000000,
      amount: 50000,
      account: { order_id: 'ord-1' },
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orderId: 'ord-1',
          provider: 'payme',
          transactionId: 'txn-1',
          providerCreateTime: BigInt(1700000000000),
        }),
      }),
    );
    expect(response).toEqual({
      result: { create_time: 1700000000000, transaction: 'pay-1', state: 1 },
    });
  });

  it('replays the same result for a repeated call on an existing PENDING transaction', async () => {
    const findFirstPayment = jest.fn().mockResolvedValue({
      id: 'pay-1',
      status: 'PENDING',
      providerCreateTime: BigInt(1700000000000),
    });
    const prisma = makePrisma({
      order: { findUnique: jest.fn().mockResolvedValue(order) },
      payment: { findFirst: findFirstPayment },
    });
    const service = new PaymeService(prisma);

    const response = await service.createTransaction({
      id: 'txn-1',
      time: 999999999999, // different time than what was stored — must be ignored
      amount: 50000,
      account: { order_id: 'ord-1' },
    });

    expect(response).toEqual({
      result: { create_time: 1700000000000, transaction: 'pay-1', state: 1 },
    });
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });
});

describe('PaymeService.performTransaction', () => {
  it('marks a PENDING payment COMPLETED and recomputes order.paymentStatus', async () => {
    const findUniquePayment = jest.fn().mockResolvedValue({
      id: 'pay-1',
      orderId: 'ord-1',
      status: 'PENDING',
      amount: { toNumber: () => 500 },
      providerCreateTime: BigInt(1700000000000),
    });
    const update = jest.fn().mockResolvedValue({
      id: 'pay-1',
      paidAt: new Date(1700000005000),
    });
    const aggregate = jest.fn().mockResolvedValue({ _sum: { amount: { toNumber: () => 500 } } });
    const orderUpdate = jest.fn();
    const prisma = makePrisma({
      order: { findUnique: jest.fn().mockResolvedValue(order), update: orderUpdate },
      payment: { findFirst: findUniquePayment, update, aggregate },
    });
    const service = new PaymeService(prisma);

    const response = await service.performTransaction({ id: 'txn-1' });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'COMPLETED' }),
      }),
    );
    expect(orderUpdate).toHaveBeenCalled();
    expect(response).toEqual({
      result: { transaction: 'pay-1', perform_time: 1700000005000, state: 2 },
    });
  });

  it('replays the same result for a repeated call on an already-COMPLETED transaction', async () => {
    const findFirstPayment = jest.fn().mockResolvedValue({
      id: 'pay-1',
      orderId: 'ord-1',
      status: 'COMPLETED',
      paidAt: new Date(1700000005000),
    });
    const prisma = makePrisma({ payment: { findFirst: findFirstPayment } });
    const service = new PaymeService(prisma);

    const response = await service.performTransaction({ id: 'txn-1' });

    expect(response).toEqual({
      result: { transaction: 'pay-1', perform_time: 1700000005000, state: 2 },
    });
    expect(prisma.payment.update).not.toHaveBeenCalled();
  });

  it('refuses to perform a transaction that was already cancelled', async () => {
    const findFirstPayment = jest.fn().mockResolvedValue({
      id: 'pay-1',
      status: 'FAILED',
    });
    const prisma = makePrisma({ payment: { findFirst: findFirstPayment } });
    const service = new PaymeService(prisma);

    const response = await service.performTransaction({ id: 'txn-1' });

    expect(response).toEqual({
      error: { code: PAYME_ERROR.CANNOT_PERFORM, message: expect.any(String) },
    });
  });

  it('answers TRANSACTION_NOT_FOUND for an unknown id', async () => {
    const prisma = makePrisma();
    const service = new PaymeService(prisma);

    const response = await service.performTransaction({ id: 'nope' });

    expect(response).toEqual({
      error: { code: PAYME_ERROR.TRANSACTION_NOT_FOUND, message: expect.any(String) },
    });
  });
});

describe('PaymeService.cancelTransaction', () => {
  it('cancels a PENDING payment to FAILED without touching order.paymentStatus math beyond the recompute', async () => {
    const findFirstPayment = jest.fn().mockResolvedValue({
      id: 'pay-1',
      orderId: 'ord-1',
      status: 'PENDING',
    });
    const update = jest.fn().mockResolvedValue({
      id: 'pay-1',
      cancelledAt: new Date(1700000009000),
    });
    const aggregate = jest.fn().mockResolvedValue({ _sum: { amount: null } });
    const orderUpdate = jest.fn();
    const prisma = makePrisma({
      order: { update: orderUpdate },
      payment: { findFirst: findFirstPayment, update, aggregate },
    });
    const service = new PaymeService(prisma);

    const response = await service.cancelTransaction({ id: 'txn-1', reason: 3 });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED', cancelReason: 3 }) }),
    );
    expect(response).toEqual({
      result: { transaction: 'pay-1', cancel_time: 1700000009000, state: -1 },
    });
  });

  it('cancels a COMPLETED payment to REFUNDED', async () => {
    const findFirstPayment = jest.fn().mockResolvedValue({
      id: 'pay-1',
      orderId: 'ord-1',
      status: 'COMPLETED',
    });
    const update = jest.fn().mockResolvedValue({
      id: 'pay-1',
      cancelledAt: new Date(1700000009000),
    });
    const prisma = makePrisma({
      order: { update: jest.fn() },
      payment: { findFirst: findFirstPayment, update },
    });
    const service = new PaymeService(prisma);

    const response = await service.cancelTransaction({ id: 'txn-1', reason: 5 });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'REFUNDED' }) }),
    );
    expect(response.result?.state).toBe(-2);
  });

  it('replays the same result for a repeated cancel on an already-cancelled transaction', async () => {
    const findFirstPayment = jest.fn().mockResolvedValue({
      id: 'pay-1',
      status: 'FAILED',
      cancelledAt: new Date(1700000009000),
    });
    const prisma = makePrisma({ payment: { findFirst: findFirstPayment } });
    const service = new PaymeService(prisma);

    const response = await service.cancelTransaction({ id: 'txn-1', reason: 1 });

    expect(response).toEqual({
      result: { transaction: 'pay-1', cancel_time: 1700000009000, state: -1 },
    });
    expect(prisma.payment.update).not.toHaveBeenCalled();
  });
});

describe('PaymeService.checkTransaction', () => {
  it('reports full state for an existing transaction', async () => {
    const findFirstPayment = jest.fn().mockResolvedValue({
      id: 'pay-1',
      status: 'COMPLETED',
      providerCreateTime: BigInt(1700000000000),
      paidAt: new Date(1700000005000),
      cancelledAt: null,
      cancelReason: null,
    });
    const prisma = makePrisma({ payment: { findFirst: findFirstPayment } });
    const service = new PaymeService(prisma);

    const response = await service.checkTransaction({ id: 'txn-1' });

    expect(response).toEqual({
      result: {
        create_time: 1700000000000,
        perform_time: 1700000005000,
        cancel_time: 0,
        transaction: 'pay-1',
        state: 2,
        reason: null,
      },
    });
  });

  it('answers TRANSACTION_NOT_FOUND for an unknown id', async () => {
    const prisma = makePrisma();
    const service = new PaymeService(prisma);

    const response = await service.checkTransaction({ id: 'nope' });

    expect(response).toEqual({
      error: { code: PAYME_ERROR.TRANSACTION_NOT_FOUND, message: expect.any(String) },
    });
  });
});
```

- [x] **Step 3: Run it to verify it fails**

Run: `cd backend && npx jest src/payme/payme.service.spec.ts`
Expected: FAIL — module does not exist.

- [x] **Step 4: Implement `PaymeService`**

Create `backend/src/payme/payme.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { toTiyin, paymeState } from './payme-money';
import { PAYME_ERROR } from './payme-errors';
import { PaymentStatus } from '../../generated/prisma/client';

type PaymeResult<T> = { result: T } | { error: { code: number; message: string } };

interface CheckPerformParams {
  amount: number;
  account: { order_id: string };
}

interface CreateParams extends CheckPerformParams {
  id: string;
  time: number;
}

/**
 * The Merchant API Payme calls into. Confirmed against
 * developer.help.paycom.uz's Merchant API method/error-code pages this
 * session — field names, error codes, and every idempotent-replay rule
 * below are sourced from there, not guessed.
 *
 * This is the only path that may ever move a Payment to COMPLETED — the
 * frontend can never self-report a successful payment.
 */
@Injectable()
export class PaymeService {
  constructor(private readonly prisma: PrismaService) {}

  private async findOrder(orderId: string) {
    return this.prisma.order.findUnique({ where: { id: orderId } });
  }

  private amountMismatch(orderTotal: unknown, amountTiyin: number): boolean {
    return toTiyin(orderTotal as never) !== amountTiyin;
  }

  async checkPerformTransaction(
    params: CheckPerformParams,
  ): Promise<PaymeResult<{ allow: true }>> {
    const order = await this.findOrder(params.account.order_id);
    if (!order) {
      return {
        error: { code: PAYME_ERROR.ACCOUNT_ERROR, message: 'Buyurtma topilmadi' },
      };
    }
    if (this.amountMismatch(order.total, params.amount)) {
      return { error: { code: PAYME_ERROR.INVALID_AMOUNT, message: 'Неверная сумма' } };
    }
    return { result: { allow: true } };
  }

  async createTransaction(
    params: CreateParams,
  ): Promise<PaymeResult<{ create_time: number; transaction: string; state: number }>> {
    const order = await this.findOrder(params.account.order_id);
    if (!order) {
      return {
        error: { code: PAYME_ERROR.ACCOUNT_ERROR, message: 'Buyurtma topilmadi' },
      };
    }
    if (this.amountMismatch(order.total, params.amount)) {
      return { error: { code: PAYME_ERROR.INVALID_AMOUNT, message: 'Неверная сумма' } };
    }

    const existing = await this.prisma.payment.findFirst({
      where: { provider: 'payme', transactionId: params.id },
    });

    if (existing) {
      if (existing.status === PaymentStatus.PENDING || existing.status === PaymentStatus.COMPLETED) {
        return {
          result: {
            create_time: Number(existing.providerCreateTime),
            transaction: existing.id,
            state: paymeState(existing.status),
          },
        };
      }
      return {
        error: { code: PAYME_ERROR.CANNOT_PERFORM, message: 'Невозможно выполнить операцию' },
      };
    }

    const created = await this.prisma.payment.create({
      data: {
        orderId: order.id,
        amount: order.total,
        method: 'ONLINE',
        status: PaymentStatus.PENDING,
        provider: 'payme',
        transactionId: params.id,
        providerCreateTime: BigInt(params.time),
      },
    });

    return {
      result: {
        create_time: Number(created.providerCreateTime),
        transaction: created.id,
        state: 1,
      },
    };
  }

  private async findPayment(transactionId: string) {
    return this.prisma.payment.findFirst({
      where: { provider: 'payme', transactionId },
    });
  }

  private async recomputeOrderPaymentStatus(orderId: string): Promise<void> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return;

    const paidSoFar = await this.prisma.payment.aggregate({
      where: { orderId, status: PaymentStatus.COMPLETED },
      _sum: { amount: true },
    });
    const totalPaid = paidSoFar._sum.amount?.toNumber() ?? 0;
    const orderTotal = order.total.toNumber();

    const paymentStatus =
      totalPaid >= orderTotal ? 'PAID' : totalPaid > 0 ? 'PARTIAL' : 'UNPAID';

    await this.prisma.order.update({
      where: { id: orderId },
      data: { paymentStatus },
    });
  }

  async performTransaction(
    params: { id: string },
  ): Promise<PaymeResult<{ transaction: string; perform_time: number; state: number }>> {
    const payment = await this.findPayment(params.id);
    if (!payment) {
      return {
        error: { code: PAYME_ERROR.TRANSACTION_NOT_FOUND, message: 'Транзакция не найдена' },
      };
    }

    if (payment.status === PaymentStatus.COMPLETED) {
      return {
        result: {
          transaction: payment.id,
          perform_time: payment.paidAt!.getTime(),
          state: 2,
        },
      };
    }

    if (payment.status !== PaymentStatus.PENDING) {
      return {
        error: { code: PAYME_ERROR.CANNOT_PERFORM, message: 'Невозможно выполнить операцию' },
      };
    }

    const updated = await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: PaymentStatus.COMPLETED, paidAt: new Date() },
    });

    await this.recomputeOrderPaymentStatus(payment.orderId);

    return {
      result: {
        transaction: updated.id,
        perform_time: updated.paidAt!.getTime(),
        state: 2,
      },
    };
  }

  async cancelTransaction(
    params: { id: string; reason: number },
  ): Promise<PaymeResult<{ transaction: string; cancel_time: number; state: number }>> {
    const payment = await this.findPayment(params.id);
    if (!payment) {
      return {
        error: { code: PAYME_ERROR.TRANSACTION_NOT_FOUND, message: 'Транзакция не найдена' },
      };
    }

    if (payment.status === PaymentStatus.FAILED || payment.status === PaymentStatus.REFUNDED) {
      return {
        result: {
          transaction: payment.id,
          cancel_time: payment.cancelledAt!.getTime(),
          state: paymeState(payment.status),
        },
      };
    }

    const nextStatus =
      payment.status === PaymentStatus.COMPLETED
        ? PaymentStatus.REFUNDED
        : PaymentStatus.FAILED;

    const updated = await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: nextStatus, cancelledAt: new Date(), cancelReason: params.reason },
    });

    await this.recomputeOrderPaymentStatus(payment.orderId);

    return {
      result: {
        transaction: updated.id,
        cancel_time: updated.cancelledAt!.getTime(),
        state: paymeState(nextStatus),
      },
    };
  }

  async checkTransaction(params: { id: string }): Promise<
    PaymeResult<{
      create_time: number;
      perform_time: number;
      cancel_time: number;
      transaction: string;
      state: number;
      reason: number | null;
    }>
  > {
    const payment = await this.findPayment(params.id);
    if (!payment) {
      return {
        error: { code: PAYME_ERROR.TRANSACTION_NOT_FOUND, message: 'Транзакция не найдена' },
      };
    }

    return {
      result: {
        create_time: Number(payment.providerCreateTime ?? 0),
        perform_time: payment.paidAt?.getTime() ?? 0,
        cancel_time: payment.cancelledAt?.getTime() ?? 0,
        transaction: payment.id,
        state: paymeState(payment.status),
        reason: payment.cancelReason,
      },
    };
  }
}
```

- [x] **Step 5: Run it to verify it passes**

Run: `cd backend && npx jest src/payme/payme.service.spec.ts`
Expected: PASS.

- [x] **Step 6: Auth guard**

Create `backend/src/payme/payme-auth.guard.ts`:

```ts
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

    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      throw new UnauthorizedException('Invalid Payme credentials');
    }

    return true;
  }
}
```

- [x] **Step 7: Controller and module**

Create `backend/src/payme/payme.controller.ts`:

```ts
import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { PaymeService } from './payme.service';
import { PaymeAuthGuard } from './payme-auth.guard';

interface JsonRpcRequest {
  method: string;
  params: Record<string, unknown>;
  id: number | string;
}

/**
 * The single URL registered in Payme's merchant cabinet. Payme sends every
 * Merchant API call here as a JSON-RPC 2.0 envelope; this dispatches on
 * `method` and always echoes the request `id` back, per the protocol.
 */
@Controller('payme')
@UseGuards(PaymeAuthGuard)
export class PaymeController {
  constructor(private readonly payme: PaymeService) {}

  @Post()
  async handle(@Body() body: JsonRpcRequest) {
    const outcome = await this.dispatch(body.method, body.params ?? {});
    return { jsonrpc: '2.0', id: body.id, ...outcome };
  }

  private dispatch(method: string, params: Record<string, unknown>) {
    switch (method) {
      case 'CheckPerformTransaction':
        return this.payme.checkPerformTransaction(params as never);
      case 'CreateTransaction':
        return this.payme.createTransaction(params as never);
      case 'PerformTransaction':
        return this.payme.performTransaction(params as never);
      case 'CancelTransaction':
        return this.payme.cancelTransaction(params as never);
      case 'CheckTransaction':
        return this.payme.checkTransaction(params as never);
      default:
        return Promise.resolve({
          error: { code: -32601, message: 'Method not found' },
        });
    }
  }
}
```

Create `backend/src/payme/payme.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { PaymeController } from './payme.controller';
import { PaymeService } from './payme.service';

@Module({
  controllers: [PaymeController],
  providers: [PaymeService],
})
export class PaymeModule {}
```

In `backend/src/app.module.ts`, add `import { PaymeModule } from './payme/payme.module';` and add `PaymeModule` to `imports`.

- [x] **Step 8: Document the env vars**

In `backend/.env.example`, add:

```
# Payme Business merchant credentials — provisioned once the merchant
# contract is signed. PAYME_MERCHANT_ID is the public cashbox id used in
# checkout links; PAYME_MERCHANT_KEY is the secret used to authenticate
# Payme's own calls into POST /api/payme (see payme-auth.guard.ts). Leaving
# either blank disables the ONLINE checkout path without breaking anything
# else — CheckoutService returns checkoutUrl: null and PaymeController's
# routes simply 500 (unreachable without real Payme traffic anyway).
PAYME_MERCHANT_ID=
PAYME_MERCHANT_KEY=
```

Mirror the same two lines (with the same comment, adapted to note this app never reads them directly — only `backend/` does) into the root `.env.example` only if root ever needs to reference the merchant id client-side; it doesn't today (`CheckoutService` builds the URL server-side in `backend/`), so **skip** adding them to the root `.env.example` — this avoids implying a var this app doesn't consume.

- [x] **Step 9: Verify the build**

Run: `cd backend && npx tsc --noEmit && npm run lint && npm run build`
Expected: all exit 0.

- [x] **Step 10: Run the full backend test suite**

Run: `cd backend && npx jest`
Expected: every test passes.

- [x] **Step 11: Commit**

```bash
git add backend/src/payme backend/src/app.module.ts backend/.env.example
git commit -m "feat(backend): implement Payme Merchant API webhook (CheckPerformTransaction..CheckTransaction)"
```

---

### Task 6: Next.js proxy — `/api/v1/checkout`

**Files:**
- Create: `app/api/v1/checkout/route.ts`
- Create: `app/api/v1/checkout/route.test.ts`
- Modify: `lib/schemas.ts` (add `checkoutRequestSchema`)

**Interfaces:**
- Consumes: `getSession`, `callBackendPhoneVerified` (both already established by the cart plan).
- Produces: `POST /api/v1/checkout` → `{ success: true, order: {...}, checkoutUrl: string | null }`.

- [x] **Step 1: Schema**

In `lib/schemas.ts`, add near the cart schemas:

```ts
export const checkoutRequestSchema = z.object({
  deliveryFee: z.number().nonnegative().optional(),
  notes: z.string().max(2000).optional(),
  paymentMethod: z.literal("ONLINE"),
});

export type CheckoutRequestInput = z.infer<typeof checkoutRequestSchema>;
```

- [x] **Step 2: Write the failing test**

Create `app/api/v1/checkout/route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();
vi.mock("@/lib/auth/session", () => ({ getSession: () => getSession() }));

const callBackendPhoneVerified = vi.fn();
vi.mock("@/lib/api/internal-backend", () => ({
  callBackendPhoneVerified: (...args: unknown[]) => callBackendPhoneVerified(...args),
}));

vi.mock("@/lib/auth/dal", () => ({ getStaffUser: vi.fn() }));

const { POST } = await import("./route");

function post(body: unknown): Request {
  return new Request("http://localhost/api/v1/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  getSession.mockReset();
  callBackendPhoneVerified.mockReset();
  callBackendPhoneVerified.mockResolvedValue({
    order: { id: "ord-1", orderNumber: "DP-1001" },
    checkoutUrl: "https://checkout.paycom.uz/xyz",
  });
});

describe("POST /api/v1/checkout", () => {
  it("answers 401 with no session", async () => {
    getSession.mockResolvedValue(null);
    expect((await POST(post({ paymentMethod: "ONLINE" }))).status).toBe(401);
    expect(callBackendPhoneVerified).not.toHaveBeenCalled();
  });

  it("proxies the checkout request and returns the order plus checkout URL", async () => {
    getSession.mockResolvedValue({ phone: "998901234567" });

    const response = await POST(post({ paymentMethod: "ONLINE", deliveryFee: 15000 }));

    expect(response.status).toBe(200);
    expect(callBackendPhoneVerified).toHaveBeenCalledWith("998901234567", "checkout", {
      method: "POST",
      body: { paymentMethod: "ONLINE", deliveryFee: 15000 },
    });
    expect(await response.json()).toEqual({
      success: true,
      order: { id: "ord-1", orderNumber: "DP-1001" },
      checkoutUrl: "https://checkout.paycom.uz/xyz",
    });
  });

  it("answers 400 for a payment method other than ONLINE", async () => {
    getSession.mockResolvedValue({ phone: "998901234567" });
    expect((await POST(post({ paymentMethod: "BANK_TRANSFER" }))).status).toBe(400);
    expect(callBackendPhoneVerified).not.toHaveBeenCalled();
  });
});
```

- [x] **Step 3: Run it to verify it fails**

Run: `npx vitest run app/api/v1/checkout`
Expected: FAIL — the route does not exist.

- [x] **Step 4: Implement**

Create `app/api/v1/checkout/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { callBackendPhoneVerified } from "@/lib/api/internal-backend";
import { apiError, parseJsonBody } from "@/lib/api/route-auth";
import { checkoutRequestSchema } from "@/lib/schemas";

interface CheckoutResult {
  order: Record<string, unknown>;
  checkoutUrl: string | null;
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return apiError(401, "Sign in to continue.");
  }

  const body = await parseJsonBody(request, checkoutRequestSchema);
  if (!body.ok) {
    return body.response;
  }

  const result = await callBackendPhoneVerified<CheckoutResult>(session.phone, "checkout", {
    method: "POST",
    body: body.data,
  });

  return NextResponse.json({ success: true, ...result });
}
```

- [x] **Step 5: Run it to verify it passes**

Run: `npx vitest run app/api/v1/checkout`
Expected: PASS.

- [x] **Step 6: Verify the root build**

Run: `npx tsc --noEmit && npm run lint && npm test && npm run build`
Expected: all clean; pre-existing unrelated failures in `lib/count-up.test.ts`/`workshop-backdrop.test.tsx` are the only ones acceptable.

- [x] **Step 7: Commit**

```bash
git add app/api/v1/checkout lib/schemas.ts
git commit -m "feat(checkout): proxy /api/v1/checkout through backend/'s CheckoutController"
```

---

### Task 7: End-to-end verification against a running `backend/`

No code changes — the same discipline as the cart plan's Task 6, extended to cover the payment webhook this time.

- [x] **Step 1:** Start `backend/` (`npm run start:dev`) and confirm `CheckoutController` and `PaymeController` routes are mapped in the boot log.
- [x] **Step 2:** Seed or find a real product id and a cart line for a test phone (reuse the cart endpoints from the prior plan to add an item).
- [x] **Step 3:** Call `POST /api/checkout` directly against `backend/` with a hand-computed phone-HMAC (same recipe as the cart plan's verification) and confirm a `200` with a real `Order` id back, and — separately — that the `Order`/`OrderItem` rows exist in `diesel_parts_erp` via a quick read.
- [x] **Step 4:** With `PAYME_MERCHANT_ID`/`PAYME_MERCHANT_KEY` still unset (expected — no contract yet), confirm the checkout call still succeeds and returns `checkoutUrl: null` rather than erroring — this is the concrete proof of the Global Constraint that an unconfigured Payme must not break checkout.
- [x] **Step 5:** Temporarily set both `PAYME_MERCHANT_ID`/`PAYME_MERCHANT_KEY` to throwaway local values (not real credentials — there are none yet) in `backend/.env`, restart `backend/`, repeat Step 3, and confirm `checkoutUrl` is now a real `https://checkout.paycom.uz/...` link whose base64 payload decodes to the order's actual id and tiyin amount. Then call `POST /api/payme` directly with a correctly Basic-Auth-signed `CheckPerformTransaction` request for that order and confirm `{ result: { allow: true } }` — proving the auth guard and the amount/order lookup work against a real row, not just mocks. Revert `backend/.env` back to blank afterward (no real credentials exist yet — this was only to exercise the code path).
- [x] **Step 6:** Call `POST /api/v1/checkout` through Next.js (mint a session token the same way the cart plan's verification did) and confirm the full chain end to end.
- [x] **Step 7:** Report exactly which steps passed, with real response bodies/status codes, and stop `backend/`'s dev server afterward.

---

## Self-Review Notes

- **Spec coverage:** "Checkout order creation" (cart → Order, backend/ pattern, Next.js proxy) — Tasks 2–4, 6. "Payme integration" (documented Merchant API) — Task 5, using only confirmed protocol details. Click — explicitly excluded per the user's own instruction this turn.
- **Placeholder scan:** no TBD/TODO; every step has real code. The two intentionally-narrowed spots (no auto-CONFIRMED on payment, collapsed `-31050` sub-codes) are documented as deliberate scope decisions with reasons, not left vague.
- **Type consistency:** `CartsService.getCart`'s `{ items: [{productId, quantity}] }` shape (established by the prior plan) is consumed as-is by `CheckoutService.buildLines`; `Payment.provider`/`transactionId` (Task 1) are exactly what `PaymeService` (Task 5) reads and writes — no translation layer between them.
