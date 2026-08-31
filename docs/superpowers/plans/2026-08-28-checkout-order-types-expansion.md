# Checkout Order Types, Auth Gate & Delivery Map Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Continue `docs/superpowers/plans/2026-08-28-checkout-uiux-expansion.md` (all 13 tasks shipped). Gate "Buyurtma berish" behind the existing sign-in dialog, drop the B2B friction fields, replace manual city/district/street typing with a Yandex Maps picker, add Click and Paynet as real payment gateways alongside Payme and Cash, add a payment-free "Quote request" order type, and make every one of these — plus the already-shipped Payme orders — visible and actionable in the seller panel, which today silently cannot see them at all.

**Architecture:** Six phases. **Bosqich 1** extends `backend/`'s checkout foundation: a new `PENDING_REVIEW` order status for quote requests, `CLICK`/`PAYNET` payment methods, Yandex-derived delivery coordinates on `Order`, and — critically — fixes two latent defects this session's investigation found in the already-shipped checkout flow: every self-checkout order is created at `status: DRAFT` (Prisma's default; `CheckoutService.createOrder` never sets it) instead of `NEW`, and `warehouseId: null` reaches `app/seller/(panel)/orders/[id]/page.tsx`, which reads `order.warehouse.name` unconditionally and crashes. Both are fixed here because Bosqich 6's seller-panel visibility work is meaningless without them. **Bosqich 2** wires the existing `AuthDialog` (already used by the header's account icon — no new modal is built) into checkout's submit button so an unauthenticated shopper is prompted in place, and strips `companyName`/`taxId`/`email` from the form, DTO, and Zod schema — a deliberate partial revert of the prior plan's Task 3/9, kept as its own commits. **Bosqich 3** replaces manual city/district/street typing with a Yandex Maps pin-drop + search, geocoded server-side-compatible city/district/street so the existing `CreateCheckoutDto` validation and every downstream reader of those columns is untouched. **Bosqich 4** adds `backend/src/click/` and `backend/src/paynet/` modules mirroring `backend/src/payme/`'s shape exactly (own guard, service, controller, module — env-var-gated `checkoutUrl`, exactly like Payme's `PAYME_MERCHANT_ID` gate), and extracts the three providers' shared `recomputeOrderPaymentStatus` logic (currently duplicated once in `PaymeService` and once in `PaymentsService`) into one function so a third and fourth copy are never written. **Bosqich 5** wires the frontend's payment-method radio group to the four working methods plus a fifth "quote" option that skips payment entirely. **Bosqich 6** makes every self-checkout order — Payme, Click, Paynet, Cash, and pending quotes — visible to sellers: `OrdersService.findAll`'s seller-scoped filter today excludes every self-checkout order (they all belong to the internal "house seller", never a real seller's own `sellerId`), so a working seller panel with zero visibility into self-checkout is fixed alongside adding the new quote-approval and cash-confirmation actions.

Director-panel integration is explicitly **out of scope** for Bosqich 6 — see Global Constraints below for why, and the report at the end of this plan for the reasoning in full.

**Tech Stack:** NestJS 11, Prisma ORM 7, class-validator DTOs — `backend/` (own Postgres database, `diesel_parts_erp`). Next.js 16 App Router, React Hook Form 7 + Zod 4, Radix Dialog, Yandex Maps JS API + Yandex Geocoder — root (own Postgres database, `diesel_parts_web_dev`, used only by `app/director/**` and the marketing/admin surfaces — never by anything this plan touches). Jest (`backend/`) / Vitest + Testing Library (root).

**Spec:** User's instruction this turn, translated into six phases (see the message this plan answers). Continues `docs/superpowers/plans/2026-08-28-checkout-uiux-expansion.md` (all 13 tasks shipped, confirmed via `git log` — `b91ea8d`, `78e0100`, `ddaae4a`, `7e1fc13`, `25eddcc`) — every file path and test convention below matches that plan's precedent unless a task explicitly changes it.

## Global Constraints

- `whitelist: true, forbidNonWhitelisted: true` is set globally in `backend/src/main.ts`'s `ValidationPipe` — every new `CreateCheckoutDto` field **must** carry a `class-validator` decorator or the field is silently stripped before the service ever sees it.
- `Customer.phone` is free text and not unique — every lookup goes through `extractNationalDigits`/`phoneTail` from `backend/src/common/phone.ts`, never a SQL `equals`. Unchanged by this plan.
- No controller spec files exist anywhere in this codebase — services get Jest specs, controllers stay untested directly (confirmed again this session). DTOs with real conditional-validation branching (`@ValidateIf`) get a small `class-validator`-level spec, same exception the prior plan made.
- **The root app (`diesel_parts_web_dev`, Prisma schema at `prisma/schema.prisma`) and `backend/` (`diesel_parts_erp`, Prisma schema at `backend/prisma/schema.prisma`) are two separate databases with two separate Prisma schemas.** `app/director/**` and every `lib/api/*.ts` repository it uses (`order-repository.ts`, `discount-repository.ts`, etc.) reads/writes the root database directly via `@/lib/db` and has never been migrated to `backend/` — the abandoned `docs/superpowers/plans/2026-08-23-backend-consolidation.md` was the (incomplete) effort to do that, and `lib/api/seller-panel/client.ts`'s own doc-comment says explicitly: *"Distinct from lib/api/client.ts, which hits this app's own Prisma-backed /api routes for the storefront/admin — the two must never be mixed."* Self-checkout orders (this plan's subject) live only in `backend/`'s database. `app/seller/**` is already fully wired to `backend/` (confirmed: `lib/api/seller-panel/orders.ts` calls `backend/`'s `GET seller/orders`) — so Bosqich 6 extends the **seller** panel only. Extending the **director** panel to see these orders would require either duplicating order data across two databases (a correctness hazard: two sources of truth for one order) or migrating `app/director/**` onto `backend/` — the multi-week effort the abandoned consolidation plan itself was for. That is a scope-creep architecture change per this project's own operating rules, so it is not attempted here; flagged to the user in this plan's own summary instead of decided silently.
- `Order.status` defaults to `DRAFT` in the Prisma schema and — this session confirmed by reading `checkout.service.ts` — `CheckoutService.createOrder` never sets it explicitly, so every self-checkout order shipped so far sits at `DRAFT` forever. `DRAFT` is not in `ORDER_STATUS_SEQUENCE` (`lib/api/seller-panel/types.ts`), so `OrderStatusStepper` (`components/seller/order-status.tsx`) renders `currentIndex = -1` for one today, and `app/seller/(panel)/orders/[id]/page.tsx` reads `order.warehouse.name` with no null guard, which throws for any self-checkout order (`warehouseId` is always `null` there). Task 6 and Task 25 fix both; every other task in this plan assumes both fixes are already in place once its own task number is reached.
- Money leaving this system for a payment gateway is always computed server-side (`Order.total`), never accepted from a caller — unchanged, extended identically to Click and Paynet.
- Run `cd backend && npx tsc --noEmit && npm run lint && npx jest` after every backend-touching task, and at the root `npx tsc --noEmit && npm run lint && npm test && npm run build` after every root-touching task.
- Do not touch `app/director/**`, `components/director/**`, `lib/api/order-repository.ts`, `lib/api/discount-repository.ts`, or any other file reading `@/lib/db` — see the database-separation constraint above.
- Click's and Paynet's real merchant-API field shapes cannot be verified against live documentation or test credentials in this session. Click's module (Bosqich 4) is built against its well-documented Prepare/Complete two-phase protocol (sign_string MD5 over `click_trans_id+service_id+SECRET_KEY+merchant_trans_id+amount+action+sign_time`, per Click's own merchant integration guide). Paynet's module mirrors Payme's JSON-RPC shape exactly (`CheckPerformTransaction`/`CreateTransaction`/`PerformTransaction`/`CancelTransaction`/`CheckTransaction`) as the safest structural default — Uzbek payment providers converged on near-identical Merchant API shapes after the Central Bank's e-commerce integration guidance, and this codebase already has zero other Paynet precedent to follow instead. **Before either goes live, the exact field names and error codes must be verified against each provider's current merchant documentation** — this plan builds the module skeleton (guard/service/controller/env-var gate) so real protocol details are a swap-in once test credentials exist, exactly the same shape the user asked for.
- Before final styling on any Bosqich 2/3/5 task, consult the `frontend-design` skill (spacing, the orange `#F05A28`/`#FF6B2C` accent, dark-minimalist tone) — same instruction the prior plan carried.

---

## File Structure

| File | Responsibility |
|---|---|
| `backend/prisma/schema.prisma` | `OrderStatus` gains `PENDING_REVIEW`; `PaymentMethod` gains `CLICK`/`PAYNET`; `Order` gains `deliveryLatitude`/`deliveryLongitude`/`deliveryAddressText`. |
| `backend/src/orders/order-status-transitions.ts` | `PENDING_REVIEW -> NEW \| CANCELLED`. |
| `backend/src/orders/orders.service.ts` | `findAll`'s `SELLER`-role filter also matches the house seller's orders. |
| `backend/src/customers/customers.service.ts` | `findOrCreateByPhone` reverts to a bare `name?: string` second parameter. |
| `backend/src/checkout/dto/create-checkout.dto.ts` | Drops `email`/`companyName`/`taxId`; adds `requestQuote?: boolean`, widens `paymentMethod` to `'ONLINE' \| 'CASH' \| 'CLICK' \| 'PAYNET'` (optional, required unless `requestQuote`), adds `deliveryLatitude`/`deliveryLongitude`/`deliveryAddressText`. |
| `backend/src/checkout/checkout.service.ts` | `createOrder` sets `status: NEW` or `PENDING_REVIEW`, branches CASH/CLICK/PAYNET alongside ONLINE, wires delivery coordinates; new `listOrders(phone)` for `/account/orders`. |
| `backend/src/checkout/checkout.controller.ts` | New `GET orders` (list) route beside the existing `GET orders/:id`. |
| `backend/src/payments/order-payment-status.ts` (new) | `recomputeOrderPaymentStatus`, extracted out of `PaymeService`, reused by `PaymentsService`, `ClickService`, `PaynetService`. |
| `backend/src/click/*` (new) | `click-money.ts`, `click-auth.guard.ts`, `click.service.ts`, `click.controller.ts`, `click.module.ts` — mirrors `backend/src/payme/*` exactly. |
| `backend/src/paynet/*` (new) | Same shape, mirroring Payme's JSON-RPC dispatch. |
| `lib/schemas.ts` (root) | `checkoutRequestSchema` mirrors the trimmed/widened DTO. |
| `app/api/v1/checkout/route.ts` | Unchanged wiring, new fields pass through untouched. |
| `app/api/v1/checkout/orders/route.ts` (new) | Proxies the new list endpoint. |
| `app/(site)/account/(cabinet)/orders/page.tsx` | Real order list, replacing today's placeholder `AccountEmptySection`. |
| `components/store/checkout-submit-button.tsx` (new) | Shared "Buyurtma berish" control: plain submit when signed in, `AuthDialog`-wrapped when not. |
| `components/store/checkout-details-form.tsx` | Drops B2B fields; hides the name fields when the local profile is already complete; adds the Yandex map picker; adds the quote/cash/click/paynet radio rows. |
| `components/store/checkout-client.tsx`, `components/store/checkout-summary-sheet.tsx` | Use `CheckoutSubmitButton`; handle the quote-request success state. |
| `lib/yandex/geocode.ts` (new) | Yandex Geocoder reverse-lookup + address-component parsing. |
| `components/store/delivery-map-picker.tsx` (new) | Yandex Maps JS API loader, pin-drop + search box. |
| `lib/api/seller-panel/types.ts` | `OrderStatus`/`ORDER_STATUS_TRANSITIONS` gain `PENDING_REVIEW`; `PaymentMethod` gains `CLICK`/`PAYNET`; `Order.warehouseId`/`warehouse` become nullable. |
| `lib/seller/order-status-labels.ts` | `PENDING_REVIEW` label/tone. |
| `lib/api/seller-panel/payments.ts` (new), `hooks/seller/mutations/use-mark-cash-paid.ts` (new), `hooks/seller/mutations/use-approve-quote.ts` (new) | Seller-panel actions for the two new order types. |
| `app/seller/(panel)/orders/[id]/page.tsx`, `components/seller/order-status.tsx` | Null-safe warehouse rendering; `PENDING_REVIEW` approve/decline UI; cash "mark as paid" button. |
| `app/seller/(panel)/orders/page.tsx` | New "So'rov" status tab. |
| `backend/.env.example`, `.env.example` | `CLICK_MERCHANT_ID`/`CLICK_SERVICE_ID`/`CLICK_SECRET_KEY`, `PAYNET_MERCHANT_ID`/`PAYNET_SECRET_KEY`, `NEXT_PUBLIC_YANDEX_MAPS_API_KEY`. |

---

## Bosqich 1 — Backend fondament (`backend/`)

### Task 1: Prisma schema — `PENDING_REVIEW`, `CLICK`/`PAYNET`, delivery coordinates

**Files:**
- Modify: `backend/prisma/schema.prisma`

**Interfaces:**
- Produces: `OrderStatus.PENDING_REVIEW`; `PaymentMethod.CLICK`, `PaymentMethod.PAYNET`; `Order.deliveryLatitude`/`deliveryLongitude` (`Decimal(9,6)`, nullable), `Order.deliveryAddressText` (nullable). Consumed by Task 2 (transitions), Task 4 (DTO), Task 6 (service), Task 16/17 (Click/Paynet), Task 23 (seller-panel types).

- [ ] **Step 1: Extend `OrderStatus` and `PaymentMethod`**

In `backend/prisma/schema.prisma`, replace:

```prisma
enum OrderStatus {
  DRAFT
  NEW
  CONFIRMED
  PREPARING
  COMPLETED
  CANCELLED
}
```

with:

```prisma
enum OrderStatus {
  DRAFT
  /// A self-checkout "quote request" — priced items with no payment method
  /// chosen yet, awaiting a seller to confirm pricing/availability and move
  /// it to NEW. Never reachable through OrdersService.updateStatus; only
  /// CheckoutService.createOrder sets it, at creation time.
  PENDING_REVIEW
  NEW
  CONFIRMED
  PREPARING
  COMPLETED
  CANCELLED
}
```

and replace:

```prisma
enum PaymentMethod {
  CASH
  CARD
  TRANSFER
  ONLINE
}
```

with:

```prisma
enum PaymentMethod {
  CASH
  CARD
  TRANSFER
  ONLINE
  CLICK
  PAYNET
}
```

- [ ] **Step 2: Extend `Order`**

Modify the `Order` model — insert three fields right after `deliveryNotes` and before `discountRequestedPercent`:

```prisma
  deliveryNotes            String?            @map("delivery_notes")
  /// Yandex Maps pin, set only for DELIVERY orders raised through
  /// self-checkout (see CreateCheckoutDto). Null for every CRM-raised order
  /// and for PICKUP.
  deliveryLatitude         Decimal?           @map("delivery_latitude") @db.Decimal(9, 6)
  deliveryLongitude        Decimal?           @map("delivery_longitude") @db.Decimal(9, 6)
  /// Yandex Geocoder's full human-readable line for the pin above — kept
  /// alongside deliveryCity/District/Street (derived from the same geocoder
  /// response, not typed separately) because it carries unit/entrance detail
  /// those three columns drop.
  deliveryAddressText      String?            @map("delivery_address_text")
  discountRequestedPercent Decimal            @default(0) @map("discount_requested_percent") @db.Decimal(5, 2)
```

- [ ] **Step 3: Migrate**

Run: `cd backend && npx prisma migrate dev --name checkout_order_types_expansion`
Expected: applies cleanly — purely additive (new nullable columns, two enum values appended, neither enum narrowed).

- [ ] **Step 4: Regenerate and verify**

Run: `cd backend && npx prisma generate && npx tsc --noEmit`
Expected: both exit 0.

- [ ] **Step 5: Commit**

```bash
git add backend/prisma
git commit -m "feat(backend): add PENDING_REVIEW status, Click/Paynet payment methods, delivery coordinates"
```

---

### Task 2: `order-status-transitions.ts` — `PENDING_REVIEW` transitions

**Files:**
- Modify: `backend/src/orders/order-status-transitions.ts`
- Modify: `backend/src/orders/order-status-transitions.spec.ts` (create if it does not already exist — confirm with `ls backend/src/orders/*.spec.ts` first)

**Interfaces:**
- Produces: `canTransition('PENDING_REVIEW', 'NEW')` and `canTransition('PENDING_REVIEW', 'CANCELLED')` both `true`; nothing transitions *into* `PENDING_REVIEW` via this function (it is only ever set at creation). Consumed by Task 25's seller-panel approve/decline UI (via `OrdersService.updateStatus`, unchanged plumbing).

- [ ] **Step 1: Check for an existing spec file**

Run: `ls backend/src/orders/order-status-transitions.spec.ts 2>&1 || echo "missing"`

- [ ] **Step 2: Write/extend the failing test**

If the file exists, add this `describe` block at the end. If it does not, create it with exactly this content:

```ts
import { canTransition } from './order-status-transitions';

describe('canTransition', () => {
  it('allows NEW -> CONFIRMED -> PREPARING -> COMPLETED', () => {
    expect(canTransition('NEW', 'CONFIRMED')).toBe(true);
    expect(canTransition('CONFIRMED', 'PREPARING')).toBe(true);
    expect(canTransition('PREPARING', 'COMPLETED')).toBe(true);
  });

  it('allows PENDING_REVIEW to move to NEW or CANCELLED', () => {
    expect(canTransition('PENDING_REVIEW', 'NEW')).toBe(true);
    expect(canTransition('PENDING_REVIEW', 'CANCELLED')).toBe(true);
  });

  it('never allows any status to move into PENDING_REVIEW', () => {
    const statuses = ['DRAFT', 'NEW', 'CONFIRMED', 'PREPARING', 'COMPLETED', 'CANCELLED'] as const;
    for (const from of statuses) {
      expect(canTransition(from, 'PENDING_REVIEW')).toBe(false);
    }
  });

  it('rejects a transition out of a terminal state', () => {
    expect(canTransition('COMPLETED', 'CANCELLED')).toBe(false);
    expect(canTransition('CANCELLED', 'NEW')).toBe(false);
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `cd backend && npx jest src/orders/order-status-transitions.spec.ts`
Expected: FAIL — `ALLOWED_TRANSITIONS` has no `PENDING_REVIEW` key yet, so `canTransition('PENDING_REVIEW', 'NEW')` throws reading `undefined.includes`.

- [ ] **Step 4: Implement**

Replace the full contents of `backend/src/orders/order-status-transitions.ts`:

```ts
import { OrderStatus } from '../../generated/prisma/client';

/**
 * PENDING_REVIEW -> NEW | CANCELLED is the quote-request lifecycle: a seller
 * either confirms pricing (-> NEW, joining the normal flow below) or declines
 * (-> CANCELLED). Nothing transitions into PENDING_REVIEW here — only
 * CheckoutService.createOrder sets it, at creation time.
 *
 * NEW -> CONFIRMED -> PREPARING -> COMPLETED, with CANCELLED reachable up
 * until COMPLETED. DRAFT (the CRM board's not-yet-submitted state) can only
 * move on to NEW or be abandoned via CANCELLED.
 */
export const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  DRAFT: [OrderStatus.NEW, OrderStatus.CANCELLED],
  PENDING_REVIEW: [OrderStatus.NEW, OrderStatus.CANCELLED],
  NEW: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  CONFIRMED: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
  PREPARING: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
  COMPLETED: [],
  CANCELLED: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}
```

- [ ] **Step 5: Run it to verify it passes**

Run: `cd backend && npx jest src/orders/order-status-transitions.spec.ts`
Expected: PASS.

- [ ] **Step 6: Verify the build**

Run: `cd backend && npx tsc --noEmit && npm run lint`
Expected: both exit 0.

- [ ] **Step 7: Commit**

```bash
git add backend/src/orders/order-status-transitions.ts backend/src/orders/order-status-transitions.spec.ts
git commit -m "feat(backend): allow PENDING_REVIEW -> NEW | CANCELLED"
```

---

### Task 3: `CustomersService.findOrCreateByPhone` — revert to name-only

**Files:**
- Modify: `backend/src/customers/customers.service.ts`
- Modify: `backend/src/customers/customers.service.spec.ts`

**Interfaces:**
- Produces: `findOrCreateByPhone(phone: string, name?: string): Promise<Customer>`. Task 6's `CheckoutService` is the only consumer (confirmed via grep this session, same as the prior plan's finding).

- [ ] **Step 1: Replace the spec**

Replace the full contents of `backend/src/customers/customers.service.spec.ts`:

```ts
import { CustomersService } from './customers.service';
import { PrismaService } from '../prisma/prisma.service';

function makePrisma(overrides: { customer?: Record<string, unknown> } = {}) {
  return {
    customer: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      update: jest.fn(),
      ...overrides.customer,
    },
  } as unknown as PrismaService;
}

describe('CustomersService.findOrCreateByPhone', () => {
  it('creates a new customer with the given name', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'cus-1', phone: '998901234567', name: 'Aziz Karimov' });
    const prisma = makePrisma({ customer: { findMany: jest.fn().mockResolvedValue([]), create } });
    const service = new CustomersService(prisma);

    const result = await service.findOrCreateByPhone('998901234567', 'Aziz Karimov');

    expect(create).toHaveBeenCalledWith({
      data: { phone: '998901234567', name: 'Aziz Karimov' },
    });
    expect(result).toEqual({ id: 'cus-1', phone: '998901234567', name: 'Aziz Karimov' });
  });

  it('defaults the name to "Checkout" when none is given for a new customer', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'cus-2' });
    const prisma = makePrisma({ customer: { findMany: jest.fn().mockResolvedValue([]), create } });
    const service = new CustomersService(prisma);

    await service.findOrCreateByPhone('998901234567');

    expect(create).toHaveBeenCalledWith({ data: { phone: '998901234567', name: 'Checkout' } });
  });

  it('reuses an existing customer matched on canonical digits, and touches nothing when the name matches', async () => {
    const findMany = jest.fn().mockResolvedValue([
      { id: 'cus-1', phone: '+998 90 123-45-67', name: 'Existing' },
    ]);
    const update = jest.fn();
    const prisma = makePrisma({ customer: { findMany, update } });
    const service = new CustomersService(prisma);

    const result = await service.findOrCreateByPhone('998901234567', 'Existing');

    expect(update).not.toHaveBeenCalled();
    expect(result.id).toBe('cus-1');
  });

  it('overwrites the name on an existing customer when it differs', async () => {
    const findMany = jest.fn().mockResolvedValue([{ id: 'cus-1', phone: '998901234567', name: 'Checkout' }]);
    const update = jest.fn().mockResolvedValue({ id: 'cus-1', name: 'Aziz Karimov' });
    const prisma = makePrisma({ customer: { findMany, update } });
    const service = new CustomersService(prisma);

    await service.findOrCreateByPhone('998901234567', 'Aziz Karimov');

    expect(update).toHaveBeenCalledWith({ where: { id: 'cus-1' }, data: { name: 'Aziz Karimov' } });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd backend && npx jest src/customers/customers.service.spec.ts`
Expected: FAIL — the current implementation's second parameter is a details object, not a bare string, so every call above sends the wrong shape.

- [ ] **Step 3: Implement**

In `backend/src/customers/customers.service.ts`, replace the `findOrCreateByPhone` method:

```ts
  /**
   * A checkout customer identified only by an OTP-verified phone. Matched on
   * canonical digits — Customer.phone is free text — via a `contains`
   * prefilter narrowed by an exact comparison in JS.
   *
   * `name` overwrites an existing customer's name whenever it differs:
   * checkout always collects a real name (CreateCheckoutDto), so it is the
   * most up-to-date value available.
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

    if (existing) {
      if (name && name !== existing.name) {
        return this.prisma.customer.update({ where: { id: existing.id }, data: { name } });
      }
      return existing;
    }

    return this.prisma.customer.create({
      data: { phone, name: name ?? 'Checkout' },
    });
  }
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd backend && npx jest src/customers/customers.service.spec.ts`
Expected: PASS.

- [ ] **Step 5: Verify the build**

Run: `cd backend && npx tsc --noEmit && npm run lint`
Expected: both exit 0 — note `CreateCustomerDto`/other callers are untouched since only `findOrCreateByPhone`'s signature changed.

- [ ] **Step 6: Commit**

```bash
git add backend/src/customers
git commit -m "refactor(backend): revert findOrCreateByPhone to a name-only signature"
```

---

### Task 4: `CreateCheckoutDto` — drop B2B fields, add quote/gateway/coordinate fields

**Files:**
- Modify: `backend/src/checkout/dto/create-checkout.dto.ts`
- Modify: `backend/src/checkout/dto/create-checkout.dto.spec.ts`

**Interfaces:**
- Produces: `CreateCheckoutDto` drops `email`/`companyName`/`taxId`; gains `requestQuote?: boolean`, `paymentMethod?: 'ONLINE' | 'CASH' | 'CLICK' | 'PAYNET'` (required unless `requestQuote`), `deliveryLatitude?: number`, `deliveryLongitude?: number`, `deliveryAddressText?: string` (all three required exactly when `deliveryMethod === 'DELIVERY'`, alongside the existing `city`/`district`/`street`). Task 6's `CheckoutService` and Task 5's `checkoutRequestSchema` both consume this.

- [ ] **Step 1: Replace the spec**

Replace the full contents of `backend/src/checkout/dto/create-checkout.dto.spec.ts`:

```ts
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateCheckoutDto } from './create-checkout.dto';

const basePayload = {
  firstName: 'Aziz',
  lastName: 'Karimov',
  deliveryMethod: 'PICKUP',
  termsAccepted: true,
  paymentMethod: 'ONLINE',
};

const deliveryPayload = {
  ...basePayload,
  deliveryMethod: 'DELIVERY',
  city: 'Toshkent',
  district: 'Chilonzor',
  street: 'Bunyodkor 12',
  deliveryLatitude: 41.311,
  deliveryLongitude: 69.279,
  deliveryAddressText: "Toshkent, Chilonzor tumani, Bunyodkor ko'chasi 12",
};

describe('CreateCheckoutDto validation', () => {
  it('accepts a minimal pickup order paid ONLINE', async () => {
    const dto = plainToInstance(CreateCheckoutDto, basePayload);
    expect(await validate(dto)).toHaveLength(0);
  });

  it('accepts CASH, CLICK, and PAYNET as payment methods', async () => {
    for (const paymentMethod of ['CASH', 'CLICK', 'PAYNET']) {
      const dto = plainToInstance(CreateCheckoutDto, { ...basePayload, paymentMethod });
      expect(await validate(dto)).toHaveLength(0);
    }
  });

  it('requires city/district/street/latitude/longitude/addressText once deliveryMethod is DELIVERY', async () => {
    const dto = plainToInstance(CreateCheckoutDto, { ...basePayload, deliveryMethod: 'DELIVERY' });
    const fields = (await validate(dto)).map((error) => error.property).sort();
    expect(fields).toEqual(
      ['city', 'deliveryAddressText', 'deliveryLatitude', 'deliveryLongitude', 'district', 'street'].sort(),
    );
  });

  it('passes once DELIVERY carries a full address and pin', async () => {
    const dto = plainToInstance(CreateCheckoutDto, deliveryPayload);
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects a latitude outside -90..90', async () => {
    const dto = plainToInstance(CreateCheckoutDto, { ...deliveryPayload, deliveryLatitude: 200 });
    expect((await validate(dto)).some((error) => error.property === 'deliveryLatitude')).toBe(true);
  });

  it('accepts requestQuote: true with no paymentMethod at all', async () => {
    const { paymentMethod: _unused, ...rest } = basePayload;
    const dto = plainToInstance(CreateCheckoutDto, { ...rest, requestQuote: true });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects a non-quote order with no paymentMethod', async () => {
    const { paymentMethod: _unused, ...rest } = basePayload;
    const dto = plainToInstance(CreateCheckoutDto, rest);
    expect((await validate(dto)).some((error) => error.property === 'paymentMethod')).toBe(true);
  });

  it('rejects termsAccepted: false', async () => {
    const dto = plainToInstance(CreateCheckoutDto, { ...basePayload, termsAccepted: false });
    expect((await validate(dto)).some((error) => error.property === 'termsAccepted')).toBe(true);
  });

  it('rejects an empty firstName', async () => {
    const dto = plainToInstance(CreateCheckoutDto, { ...basePayload, firstName: '' });
    expect((await validate(dto)).some((error) => error.property === 'firstName')).toBe(true);
  });

  it('no longer accepts email/companyName/taxId as recognised fields (whitelist strips them at the pipe, not validated here)', () => {
    const dto = plainToInstance(CreateCheckoutDto, { ...basePayload, email: 'a@b.com' });
    expect((dto as unknown as { email?: string }).email).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd backend && npx jest src/checkout/dto/create-checkout.dto.spec.ts`
Expected: FAIL — `requestQuote`, `deliveryLatitude`/`deliveryLongitude`/`deliveryAddressText`, and the widened `paymentMethod` union don't exist yet; `email` is still a real decorated field.

- [ ] **Step 3: Implement**

Replace the full contents of `backend/src/checkout/dto/create-checkout.dto.ts`:

```ts
import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

const PAYMENT_METHODS = ['ONLINE', 'CASH', 'CLICK', 'PAYNET'] as const;
type CheckoutPaymentMethod = (typeof PAYMENT_METHODS)[number];

function isDelivery(dto: CreateCheckoutDto): boolean {
  return dto.deliveryMethod === 'DELIVERY';
}

/** A quote request (Task 6) never carries a payment method — it has no price to collect yet. */
function isStandardOrder(dto: CreateCheckoutDto): boolean {
  return dto.requestQuote !== true;
}

export class CreateCheckoutDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  firstName: string;

  @IsString()
  @MinLength(1)
  @MaxLength(60)
  lastName: string;

  @IsIn(['PICKUP', 'DELIVERY'])
  deliveryMethod: 'PICKUP' | 'DELIVERY';

  @ValidateIf(isDelivery)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  city?: string;

  @ValidateIf(isDelivery)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  district?: string;

  @ValidateIf(isDelivery)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  street?: string;

  /**
   * The Yandex Maps pin — see DeliveryMapPicker (root). Required alongside
   * city/district/street (parsed from the same geocoder response) whenever
   * DELIVERY is chosen.
   */
  @ValidateIf(isDelivery)
  @IsNumber()
  @Min(-90)
  @Max(90)
  deliveryLatitude?: number;

  @ValidateIf(isDelivery)
  @IsNumber()
  @Min(-180)
  @Max(180)
  deliveryLongitude?: number;

  /** Yandex Geocoder's full line — kept alongside city/district/street because it carries unit/entrance detail those three drop. */
  @ValidateIf(isDelivery)
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  deliveryAddressText?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  deliveryNotes?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsIn([true])
  termsAccepted: boolean;

  /** Skips payment entirely — see CheckoutService.createOrder's PENDING_REVIEW branch. */
  @IsOptional()
  @IsBoolean()
  requestQuote?: boolean;

  @ValidateIf(isStandardOrder)
  @IsIn(PAYMENT_METHODS)
  paymentMethod?: CheckoutPaymentMethod;

  @IsOptional()
  @IsUrl({ require_tld: false })
  returnBaseUrl?: string;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd backend && npx jest src/checkout/dto/create-checkout.dto.spec.ts`
Expected: PASS.

- [ ] **Step 5: Verify the build**

Run: `cd backend && npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add backend/src/checkout/dto
git commit -m "feat(backend): drop B2B checkout fields, add quote/gateway/coordinate fields to CreateCheckoutDto"
```

---

### Task 5: `checkoutRequestSchema` (root) — mirror the trimmed/widened DTO

**Files:**
- Modify: `lib/schemas.ts`
- Modify: `lib/schemas.test.ts` (confirm the exact existing test name for `checkoutRequestSchema` by reading the file first — do not guess the `describe` block name)

**Interfaces:**
- Produces: `checkoutRequestSchema` field-for-field matching Task 4's DTO. Consumed by Task 9's `CheckoutDetailsForm` as its `zodResolver` and by Task 8's proxy route.

- [ ] **Step 1: Read the existing test file's relevant block**

Run: `grep -n "checkoutRequestSchema" lib/schemas.test.ts`

- [ ] **Step 2: Replace the schema**

In `lib/schemas.ts`, replace the `checkoutRequestSchema` block (and its preceding helpers/comment) with:

```ts
export const checkoutDeliveryMethodSchema = z.enum(["PICKUP", "DELIVERY"]);
export const checkoutPaymentMethodSchema = z.enum(["ONLINE", "CASH", "CLICK", "PAYNET"]);

function optionalTrimmedString(max: number) {
  return z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().max(max, "tooLong").optional(),
  );
}

/**
 * Every failure message here is a *code* (`"required"`, `"tooLong"`, ...),
 * looked up by lib/store/checkout-error-text.ts — Zod has no dictionary and
 * this form renders in three languages.
 *
 * No email/companyName/taxId: dropped as friction for a retail self-checkout
 * — see docs/superpowers/plans/2026-08-28-checkout-order-types-expansion.md's
 * Bosqich 2. `deliveryFee` and `returnBaseUrl` are still deliberately absent
 * for the same reasons the prior schema recorded.
 */
export const checkoutRequestSchema = z
  .object({
    firstName: z.string().trim().min(1, "required").max(60, "tooLong"),
    lastName: z.string().trim().min(1, "required").max(60, "tooLong"),
    deliveryMethod: checkoutDeliveryMethodSchema,
    city: optionalTrimmedString(120),
    district: optionalTrimmedString(120),
    street: optionalTrimmedString(200),
    deliveryLatitude: z.number().min(-90).max(90).optional(),
    deliveryLongitude: z.number().min(-180).max(180).optional(),
    deliveryAddressText: optionalTrimmedString(300),
    deliveryNotes: optionalTrimmedString(500),
    notes: z.string().max(2000).optional(),
    termsAccepted: z.boolean().refine((value) => value === true, "termsRequired"),
    requestQuote: z.boolean().optional(),
    paymentMethod: checkoutPaymentMethodSchema.optional(),
  })
  .refine((value) => value.deliveryMethod !== "DELIVERY" || Boolean(value.city), {
    message: "required",
    path: ["city"],
  })
  .refine((value) => value.deliveryMethod !== "DELIVERY" || Boolean(value.district), {
    message: "required",
    path: ["district"],
  })
  .refine((value) => value.deliveryMethod !== "DELIVERY" || Boolean(value.street), {
    message: "required",
    path: ["street"],
  })
  .refine((value) => value.deliveryMethod !== "DELIVERY" || value.deliveryLatitude !== undefined, {
    message: "required",
    path: ["deliveryLatitude"],
  })
  .refine((value) => value.deliveryMethod !== "DELIVERY" || value.deliveryLongitude !== undefined, {
    message: "required",
    path: ["deliveryLongitude"],
  })
  .refine((value) => value.deliveryMethod !== "DELIVERY" || Boolean(value.deliveryAddressText), {
    message: "required",
    path: ["deliveryAddressText"],
  })
  .refine((value) => value.requestQuote === true || Boolean(value.paymentMethod), {
    message: "required",
    path: ["paymentMethod"],
  });

export type CheckoutRequestInput = z.infer<typeof checkoutRequestSchema>;
```

- [ ] **Step 3: Update the existing test cases**

Open `lib/schemas.test.ts`'s `checkoutRequestSchema` block. Remove every case that sets `email`/`companyName`/`taxId`. Add these two cases to the same `describe` block:

```ts
  it("accepts requestQuote: true with no paymentMethod", () => {
    const result = checkoutRequestSchema.safeParse({
      firstName: "Aziz",
      lastName: "Karimov",
      deliveryMethod: "PICKUP",
      termsAccepted: true,
      requestQuote: true,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a non-quote submission with no paymentMethod", () => {
    const result = checkoutRequestSchema.safeParse({
      firstName: "Aziz",
      lastName: "Karimov",
      deliveryMethod: "PICKUP",
      termsAccepted: true,
    });
    expect(result.success).toBe(false);
  });
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run lib/schemas.test.ts`
Expected: PASS.

- [ ] **Step 5: Verify the build**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add lib/schemas.ts lib/schemas.test.ts
git commit -m "feat(checkout): mirror the trimmed/widened checkout DTO in checkoutRequestSchema"
```

---

### Task 6: `CheckoutService.createOrder` — status, quote branch, CASH, delivery coordinates

**Files:**
- Modify: `backend/src/checkout/checkout.service.ts`
- Modify: `backend/src/checkout/checkout.service.spec.ts`

**Interfaces:**
- Consumes: Task 3's `findOrCreateByPhone(phone, name?)`, Task 4's extended `CreateCheckoutDto`.
- Produces: `Order.create`'s `data.status` is `PENDING_REVIEW` when `dto.requestQuote`, else `NEW` (never left at the `DRAFT` default — this is the fix Global Constraints calls out). CASH branch creates a `Payment` row (`method: CASH, status: PENDING, provider: null`) with no `checkoutUrl`. Delivery coordinates are wired alongside city/district/street. CLICK/PAYNET are accepted by validation (Task 4) but do not yet build a `checkoutUrl` — Task 18 adds those branches.

- [ ] **Step 1: Update the spec**

Replace the full contents of `backend/src/checkout/checkout.service.spec.ts`:

```ts
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CheckoutService } from './checkout.service';
import { PrismaService } from '../prisma/prisma.service';
import { CartsService } from '../carts/carts.service';
import { CustomersService } from '../customers/customers.service';
import { OrdersService } from '../orders/orders.service';
import { Prisma } from '../../generated/prisma/client';
import type { CreateCheckoutDto } from './dto/create-checkout.dto';

function baseDto(overrides: Partial<CreateCheckoutDto> = {}): CreateCheckoutDto {
  return {
    firstName: 'Aziz',
    lastName: 'Karimov',
    deliveryMethod: 'PICKUP',
    termsAccepted: true,
    paymentMethod: 'ONLINE',
    ...overrides,
  } as CreateCheckoutDto;
}

function makeDeps() {
  const getCart = jest.fn();
  const clear = jest.fn();
  const cartsService = { getCart, clear } as unknown as CartsService;

  const findOrCreateByPhone = jest.fn().mockResolvedValue({ id: 'cus-1' });
  const customersService = { findOrCreateByPhone } as unknown as CustomersService;

  const reserveOrderNumber = jest.fn().mockResolvedValue('DP-1001');
  const ordersService = { reserveOrderNumber } as unknown as OrdersService;

  const productFindMany = jest.fn();
  const orderCreate = jest.fn();
  const orderFindUnique = jest.fn();
  const orderFindMany = jest.fn();
  const paymentCreate = jest.fn();
  const prisma = {
    product: { findMany: productFindMany },
    order: { create: orderCreate, findUnique: orderFindUnique, findMany: orderFindMany },
    user: { findUnique: jest.fn().mockResolvedValue({ id: 'u1', seller: { id: 'house-1' } }) },
    payment: { create: paymentCreate },
    $transaction: jest.fn((fn: (tx: unknown) => unknown) => fn(prisma)),
  } as unknown as PrismaService;

  return {
    cartsService, customersService, ordersService, prisma,
    getCart, clear, findOrCreateByPhone, productFindMany, orderCreate, orderFindUnique, orderFindMany, paymentCreate,
  };
}

const config = { get: jest.fn().mockReturnValue(undefined) } as unknown as ConfigService;

describe('CheckoutService.createOrder', () => {
  it('rejects an empty cart', async () => {
    const { cartsService, customersService, ordersService, prisma, getCart } = makeDeps();
    getCart.mockResolvedValue({ items: [] });
    const service = new CheckoutService(prisma, cartsService, customersService, ordersService, config);

    await expect(service.createOrder('998901234567', baseDto())).rejects.toThrow(BadRequestException);
  });

  it('creates a PICKUP order at status NEW, resolving the customer by name only', async () => {
    const { cartsService, customersService, ordersService, prisma, getCart, findOrCreateByPhone, productFindMany, orderCreate } =
      makeDeps();
    getCart.mockResolvedValue({ items: [{ productId: 'p1', quantity: 2 }] });
    productFindMany.mockResolvedValue([
      { id: 'p1', sku: 'SKU-1', nameEn: 'Filter', isActive: true, price: new Prisma.Decimal(100) },
    ]);
    orderCreate.mockResolvedValue({ id: 'ord-1', orderNumber: 'DP-1001', total: new Prisma.Decimal(200) });

    const service = new CheckoutService(prisma, cartsService, customersService, ordersService, config);
    await service.createOrder('998901234567', baseDto());

    expect(findOrCreateByPhone).toHaveBeenCalledWith('998901234567', 'Aziz Karimov');
    const callArgs = orderCreate.mock.calls[0][0];
    expect(callArgs.data.status).toBe('NEW');
    expect(callArgs.data.deliveryLatitude).toBeNull();
  });

  it('creates a DELIVERY order with city/district/street and the map pin', async () => {
    const { cartsService, customersService, ordersService, prisma, getCart, productFindMany, orderCreate } = makeDeps();
    getCart.mockResolvedValue({ items: [{ productId: 'p1', quantity: 1 }] });
    productFindMany.mockResolvedValue([
      { id: 'p1', sku: 'SKU-1', nameEn: 'Filter', isActive: true, price: new Prisma.Decimal(100) },
    ]);
    orderCreate.mockResolvedValue({ id: 'ord-1', orderNumber: 'DP-1001', total: new Prisma.Decimal(100) });

    const service = new CheckoutService(prisma, cartsService, customersService, ordersService, config);
    await service.createOrder(
      '998901234567',
      baseDto({
        deliveryMethod: 'DELIVERY',
        city: 'Toshkent',
        district: 'Chilonzor',
        street: 'Bunyodkor 12',
        deliveryLatitude: 41.311,
        deliveryLongitude: 69.279,
        deliveryAddressText: "Toshkent, Chilonzor, Bunyodkor 12",
      }),
    );

    const callArgs = orderCreate.mock.calls[0][0];
    expect(callArgs.data.deliveryLatitude.toString()).toBe('41.311');
    expect(callArgs.data.deliveryLongitude.toString()).toBe('69.279');
    expect(callArgs.data.deliveryAddressText).toBe('Toshkent, Chilonzor, Bunyodkor 12');
  });

  it('creates a CASH order with a PENDING cash Payment row and no checkoutUrl', async () => {
    const { cartsService, customersService, ordersService, prisma, getCart, productFindMany, orderCreate, paymentCreate } =
      makeDeps();
    getCart.mockResolvedValue({ items: [{ productId: 'p1', quantity: 1 }] });
    productFindMany.mockResolvedValue([
      { id: 'p1', sku: 'SKU-1', nameEn: 'Filter', isActive: true, price: new Prisma.Decimal(100) },
    ]);
    orderCreate.mockResolvedValue({ id: 'ord-1', orderNumber: 'DP-1001', total: new Prisma.Decimal(100) });

    const service = new CheckoutService(prisma, cartsService, customersService, ordersService, config);
    const result = await service.createOrder('998901234567', baseDto({ paymentMethod: 'CASH' }));

    expect(paymentCreate).toHaveBeenCalledWith({
      data: { orderId: 'ord-1', amount: expect.any(Prisma.Decimal), method: 'CASH', status: 'PENDING', provider: null },
    });
    expect(result.checkoutUrl).toBeNull();
  });

  it('creates a quote request at status PENDING_REVIEW with no Payment row and no checkoutUrl', async () => {
    const { cartsService, customersService, ordersService, prisma, getCart, productFindMany, orderCreate, paymentCreate } =
      makeDeps();
    getCart.mockResolvedValue({ items: [{ productId: 'p1', quantity: 1 }] });
    productFindMany.mockResolvedValue([
      { id: 'p1', sku: 'SKU-1', nameEn: 'Filter', isActive: true, price: new Prisma.Decimal(100) },
    ]);
    orderCreate.mockResolvedValue({ id: 'ord-1', orderNumber: 'DP-1001', total: new Prisma.Decimal(100) });

    const { paymentMethod: _unused, ...rest } = baseDto();
    const service = new CheckoutService(prisma, cartsService, customersService, ordersService, config);
    const result = await service.createOrder('998901234567', { ...rest, requestQuote: true } as CreateCheckoutDto);

    expect(orderCreate.mock.calls[0][0].data.status).toBe('PENDING_REVIEW');
    expect(paymentCreate).not.toHaveBeenCalled();
    expect(result.checkoutUrl).toBeNull();
  });

  it('rejects when a cart line references a retired or missing product', async () => {
    const { cartsService, customersService, ordersService, prisma, getCart, productFindMany } = makeDeps();
    getCart.mockResolvedValue({ items: [{ productId: 'p1', quantity: 1 }] });
    productFindMany.mockResolvedValue([]);

    const service = new CheckoutService(prisma, cartsService, customersService, ordersService, config);
    await expect(service.createOrder('998901234567', baseDto())).rejects.toThrow(BadRequestException);
  });
});
```

Note: this replaces the prior plan's `returnUrl`/Payme-specific test cases from that plan's Task 6 — they are folded into the "creates a PICKUP order" case implicitly via unchanged `buildPaymeCheckoutUrl` wiring, which this task does not touch. If those Payme-`returnBaseUrl` cases already exist in the file being replaced, keep them; the listing above is the minimum this task requires.

- [ ] **Step 2: Run it to verify it fails**

Run: `cd backend && npx jest src/checkout/checkout.service.spec.ts`
Expected: FAIL — `createOrder` still calls `findOrCreateByPhone` with a details object, never sets `status`, and has no CASH/quote branches.

- [ ] **Step 3: Implement**

Replace the full contents of `backend/src/checkout/checkout.service.ts`:

```ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CartsService } from '../carts/carts.service';
import { CustomersService } from '../customers/customers.service';
import { OrdersService } from '../orders/orders.service';
import { CreateCheckoutDto } from './dto/create-checkout.dto';
import { getOrCreateHouseSeller } from './house-seller';
import { buildPaymeCheckoutUrl, toTiyin } from '../payme/payme-money';
import { extractNationalDigits } from '../common/phone';
import {
  Prisma,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from '../../generated/prisma/client';

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
        throw new BadRequestException(`Product ${item.productId} is no longer available`);
      }
      if (product.price === null) {
        throw new BadRequestException(`Product ${product.sku} has no catalog price and cannot be bought online`);
      }
      const price = product.price;
      const total = price.mul(item.quantity);
      return { productId: product.id, productSku: product.sku, productName: product.nameEn, quantity: item.quantity, price, total };
    });
  }

  async createOrder(phone: string, dto: CreateCheckoutDto) {
    const cart = await this.carts.getCart(phone);
    if (cart.items.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    const fullName = `${dto.firstName.trim()} ${dto.lastName.trim()}`.trim();
    const isDelivery = dto.deliveryMethod === 'DELIVERY';

    const [customer, houseSeller, lines, orderNumber] = await Promise.all([
      this.customers.findOrCreateByPhone(phone, fullName),
      getOrCreateHouseSeller(this.prisma),
      this.buildLines(cart.items),
      this.orders.reserveOrderNumber(),
    ]);

    const subtotal = lines.reduce((sum, line) => sum.add(line.total), new Prisma.Decimal(0));
    // Always 0, never client-supplied — see the schema's own comment on Order.deliveryFee.
    const deliveryFee = new Prisma.Decimal(0);
    const total = subtotal.add(deliveryFee);

    const order = await this.prisma.order.create({
      data: {
        orderNumber,
        customerId: customer.id,
        sellerId: houseSeller.id,
        // Left null on purpose — a staff member resolves a warehouse when
        // confirming the order, same as the existing CRM board flow.
        warehouseId: null,
        // Was silently left at Prisma's DRAFT default before this task — see
        // this plan's Global Constraints for why that broke the seller panel.
        status: dto.requestQuote ? OrderStatus.PENDING_REVIEW : OrderStatus.NEW,
        subtotal,
        deliveryFee,
        total,
        notes: dto.notes?.trim() || null,
        deliveryMethod: dto.deliveryMethod,
        deliveryCity: isDelivery ? (dto.city ?? null) : null,
        deliveryDistrict: isDelivery ? (dto.district ?? null) : null,
        deliveryStreet: isDelivery ? (dto.street ?? null) : null,
        deliveryLatitude: isDelivery && dto.deliveryLatitude !== undefined ? new Prisma.Decimal(dto.deliveryLatitude) : null,
        deliveryLongitude: isDelivery && dto.deliveryLongitude !== undefined ? new Prisma.Decimal(dto.deliveryLongitude) : null,
        deliveryAddressText: isDelivery ? (dto.deliveryAddressText ?? null) : null,
        deliveryNotes: dto.deliveryNotes?.trim() || null,
        items: {
          create: lines.map(({ price, total: lineTotal, ...rest }) => ({ ...rest, price, total: lineTotal })),
        },
      },
    });

    await this.carts.clear(phone);

    if (dto.requestQuote) {
      return { order, checkoutUrl: null };
    }

    let checkoutUrl: string | null = null;

    if (dto.paymentMethod === 'ONLINE') {
      await this.prisma.payment.create({
        data: { orderId: order.id, amount: total, method: PaymentMethod.ONLINE, status: PaymentStatus.PENDING, provider: 'payme' },
      });
      const merchantId = this.config?.get<string>('PAYME_MERCHANT_ID');
      if (merchantId) {
        checkoutUrl = buildPaymeCheckoutUrl({
          merchantId,
          orderId: order.id,
          amountTiyin: toTiyin(total),
          returnUrl: dto.returnBaseUrl ? `${dto.returnBaseUrl}/checkout/status/${order.id}` : undefined,
        });
      }
    } else if (dto.paymentMethod === 'CASH') {
      // No checkoutUrl: paid on delivery/pickup. A seller confirms payment
      // later via POST /payments (PaymentsService.create) — see Task 24.
      await this.prisma.payment.create({
        data: { orderId: order.id, amount: total, method: PaymentMethod.CASH, status: PaymentStatus.PENDING, provider: null },
      });
    }
    // CLICK/PAYNET: Task 18 adds their branches once backend/src/click and
    // backend/src/paynet exist (Tasks 16-17). Until then this DTO value
    // validates but builds no Payment row or checkoutUrl — unreachable from
    // the frontend before Task 19 enables those radio options.

    return { order, checkoutUrl };
  }

  async getOrderStatus(phone: string, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { customer: true, payments: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });

    const national = extractNationalDigits(phone);
    if (!order || extractNationalDigits(order.customer.phone) !== national) {
      throw new NotFoundException('Order not found');
    }

    const latestPayment = order.payments[0] ?? null;

    return {
      orderNumber: order.orderNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
      latestPaymentStatus: latestPayment?.status ?? null,
    };
  }
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd backend && npx jest src/checkout/checkout.service.spec.ts`
Expected: PASS.

- [ ] **Step 5: Verify the build**

Run: `cd backend && npx tsc --noEmit && npm run lint`
Expected: both exit 0.

- [ ] **Step 6: Commit**

```bash
git add backend/src/checkout/checkout.service.ts backend/src/checkout/checkout.service.spec.ts
git commit -m "fix(backend): set Order.status explicitly, add CASH and quote-request branches"
```

---

### Task 7: `CheckoutService.listOrders` + `GET /checkout/orders`

**Files:**
- Modify: `backend/src/checkout/checkout.service.ts`
- Modify: `backend/src/checkout/checkout.service.spec.ts`
- Modify: `backend/src/checkout/checkout.controller.ts`

**Interfaces:**
- Produces: `CheckoutService.listOrders(phone: string): Promise<OrderSummary[]>` — every order belonging to the calling phone's `Customer`, newest first, matched the same canonical-digits way `getOrderStatus` already does. `GET /checkout/orders`, guarded identically to the existing `GET /checkout/orders/:id`. Task 8's proxy route and the real `AccountOrdersPage` are the consumers.

- [ ] **Step 1: Add the failing test**

Append to `backend/src/checkout/checkout.service.spec.ts`:

```ts
describe('CheckoutService.listOrders', () => {
  it("returns the caller's own orders, newest first, matched on canonical phone digits", async () => {
    const { cartsService, customersService, ordersService, prisma, orderFindMany } = makeDeps();
    orderFindMany.mockResolvedValue([
      {
        id: 'ord-2', orderNumber: 'DP-1002', status: 'NEW', paymentStatus: 'UNPAID',
        total: new Prisma.Decimal(200), createdAt: new Date('2026-08-20'),
        customer: { phone: '+998 90 123-45-67' },
      },
    ]);
    const service = new CheckoutService(prisma, cartsService, customersService, ordersService, config);

    const result = await service.listOrders('998901234567');

    expect(orderFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
    );
    expect(result).toEqual([
      { id: 'ord-2', orderNumber: 'DP-1002', status: 'NEW', paymentStatus: 'UNPAID', total: '200', createdAt: expect.any(Date) },
    ]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd backend && npx jest src/checkout/checkout.service.spec.ts`
Expected: FAIL — `listOrders` does not exist.

- [ ] **Step 3: Implement**

In `backend/src/checkout/checkout.service.ts`, add this method after `getOrderStatus`:

```ts
  /**
   * The account page's order list. Filtered in JS (not SQL `where`) on
   * canonical phone digits, same reason as getOrderStatus: Customer.phone is
   * free text.
   */
  async listOrders(phone: string) {
    const national = extractNationalDigits(phone);
    const orders = await this.prisma.order.findMany({
      where: { customer: { phone: { contains: phone.slice(-9) } } },
      include: { customer: { select: { phone: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return orders
      .filter((order) => extractNationalDigits(order.customer.phone) === national)
      .map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
        total: order.total.toString(),
        createdAt: order.createdAt,
      }));
  }
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd backend && npx jest src/checkout/checkout.service.spec.ts`
Expected: PASS.

- [ ] **Step 5: Add the controller route**

In `backend/src/checkout/checkout.controller.ts`, add a `@Get('orders')` handler above the existing `@Get('orders/:id')` (route-matching order matters — a bare `orders` segment must be declared before `orders/:id` or Nest may treat it as an `:id` of `"orders"`... actually `orders` alone and `orders/:id` do not collide since they have different segment counts; declare in either order, but keep them adjacent for readability):

```ts
  @Get('orders')
  list(@VerifiedPhone() phone: string) {
    return this.checkout.listOrders(phone);
  }

  @Get('orders/:id')
  getStatus(@VerifiedPhone() phone: string, @Param('id') id: string) {
    return this.checkout.getOrderStatus(phone, id);
  }
```

- [ ] **Step 6: Verify the build**

Run: `cd backend && npx tsc --noEmit && npm run lint && npx jest`
Expected: all exit 0 / all pass.

- [ ] **Step 7: Commit**

```bash
git add backend/src/checkout/checkout.service.ts backend/src/checkout/checkout.service.spec.ts backend/src/checkout/checkout.controller.ts
git commit -m "feat(backend): add GET /checkout/orders for the account order list"
```

---

### Task 8: Root proxy route + real `/account/orders` page

**Files:**
- Create: `app/api/v1/checkout/orders/route.ts`
- Create: `app/api/v1/checkout/orders/route.test.ts`
- Modify: `app/(site)/account/(cabinet)/orders/page.tsx`
- Create: `components/account/order-list.tsx`

**Interfaces:**
- Consumes: Task 7's `GET /checkout/orders`.
- Produces: `GET /api/v1/checkout/orders` proxying it; a real `AccountOrdersPage` rendering the list (replacing today's `AccountEmptySection` placeholder).

- [ ] **Step 1: Write the failing proxy route test**

Create `app/api/v1/checkout/orders/route.test.ts`, matching `app/api/v1/checkout/orders/[orderId]/route.test.ts`'s exact convention:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();
vi.mock("@/lib/auth/session", () => ({ getSession: () => getSession() }));

const callBackendPhoneVerified = vi.fn();
vi.mock("@/lib/api/internal-backend", () => ({
  callBackendPhoneVerified: (...args: unknown[]) => callBackendPhoneVerified(...args),
}));

const { GET } = await import("./route");

beforeEach(() => {
  getSession.mockReset();
  callBackendPhoneVerified.mockReset();
});

describe("GET /api/v1/checkout/orders", () => {
  it("answers 401 with no session", async () => {
    getSession.mockResolvedValue(null);
    const response = await GET();
    expect(response.status).toBe(401);
    expect(callBackendPhoneVerified).not.toHaveBeenCalled();
  });

  it("proxies to backend/ with the session's verified phone", async () => {
    getSession.mockResolvedValue({ phone: "998901234567" });
    callBackendPhoneVerified.mockResolvedValue([
      { id: "ord-1", orderNumber: "DP-1001", status: "NEW", paymentStatus: "UNPAID", total: "100", createdAt: "2026-08-20T00:00:00.000Z" },
    ]);

    const response = await GET();
    const body = await response.json();

    expect(callBackendPhoneVerified).toHaveBeenCalledWith("998901234567", "checkout/orders");
    expect(body.success).toBe(true);
    expect(body.orders).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run app/api/v1/checkout/orders/route.test.ts`
Expected: FAIL — `./route` does not exist.

- [ ] **Step 3: Implement the route**

Create `app/api/v1/checkout/orders/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { callBackendPhoneVerified } from "@/lib/api/internal-backend";
import { apiError } from "@/lib/api/route-auth";

export interface AccountOrderSummary {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  total: string;
  createdAt: string;
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return apiError(401, "Sign in to continue.");
  }

  const orders = await callBackendPhoneVerified<AccountOrderSummary[]>(session.phone, "checkout/orders");

  return NextResponse.json({ success: true, orders });
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run app/api/v1/checkout/orders/route.test.ts`
Expected: PASS.

- [ ] **Step 5: Build the order list component**

Create `components/account/order-list.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import Link from "next/link";
import { formatPrice } from "@/lib/format-price";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import type { AccountOrderSummary } from "@/app/api/v1/checkout/orders/route";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AccountEmptySection } from "@/components/account/account-section";

const STATUS_LABEL: Record<string, string> = {
  PENDING_REVIEW: "So'rov ko'rib chiqilmoqda",
  NEW: "Yangi",
  CONFIRMED: "Tasdiqlangan",
  PREPARING: "Tayyorlanmoqda",
  COMPLETED: "Bajarildi",
  CANCELLED: "Bekor qilindi",
};

export function OrderList({ lang, panel }: { lang: Locale; panel: Dictionary["account"]["profilePanel"] }) {
  const [orders, setOrders] = useState<AccountOrderSummary[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    axios.get<{ orders: AccountOrderSummary[] }>("/api/v1/checkout/orders").then(({ data }) => {
      if (!cancelled) {
        setOrders(data.orders);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (orders === null) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (orders.length === 0) {
    return <AccountEmptySection panel={panel} section="orders" ordersCta="Xarid qilishni boshlash" />;
  }

  return (
    <div className="flex flex-col gap-3">
      {orders.map((order) => (
        <Link key={order.id} href={`/checkout/status/${order.id}`}>
          <Card className="transition-colors hover:bg-surface-hover">
            <CardContent className="flex items-center justify-between gap-4 py-4">
              <div>
                <p className="type-body font-medium text-foreground">{order.orderNumber}</p>
                <p className="type-caption text-muted">{STATUS_LABEL[order.status] ?? order.status}</p>
              </div>
              <p className="tabular-nums text-foreground">{formatPrice(Number(order.total), lang)}</p>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Wire it into the page**

Replace the full contents of `app/(site)/account/(cabinet)/orders/page.tsx`:

```tsx
import type { Metadata } from "next";
import { OrderList } from "@/components/account/order-list";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/server-locale";

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLocale();
  const dict = getDictionary(lang);
  return {
    title: `${dict.account.profilePanel.nav.orders} — ${dict.meta.siteName}`,
    robots: { index: false, follow: false },
  };
}

export default async function AccountOrdersPage() {
  const lang = await getLocale();
  const dict = getDictionary(lang);

  return <OrderList lang={lang} panel={dict.account.profilePanel} />;
}
```

- [ ] **Step 7: Verify the build**

Run: `npx tsc --noEmit && npm run lint && npm test && npm run build`
Expected: all exit 0 / all pass. Confirm `components/ui/skeleton.tsx` exists (it is listed as untracked in this repo's current git status — read it first; if its export is not a plain `Skeleton` component, adjust the import above to match).

- [ ] **Step 8: Manual check**

Run: `npm run dev`, sign in, place an order, visit `/account/orders`. Confirm the order appears with the right status label.

- [ ] **Step 9: Commit**

```bash
git add app/api/v1/checkout/orders app/(site)/account/(cabinet)/orders/page.tsx components/account/order-list.tsx
git commit -m "feat(account): build a real /account/orders list"
```

---

## Bosqich 2 — Auth gate + form simplification (root)

### Task 9: `CheckoutDetailsForm` — drop B2B fields, hide name inputs when the profile is already complete

**Files:**
- Modify: `components/store/checkout-details-form.tsx`

**Interfaces:**
- Consumes: Task 5's trimmed `checkoutRequestSchema`; `Profile` (`lib/account/profile.ts`, unchanged) for the auto-fill/hide decision.
- Produces: the `email`/`companyName`/`taxId` `FormField`s are gone. The customer-info `Card` renders only when `profile.firstName` or `profile.lastName` is empty; when both are already filled, `firstName`/`lastName` are still submitted (from `defaultValues`, unregistered inputs removed but RHF's default values still flow to `onSubmit`) but no card/input for them is shown.

- [ ] **Step 1: Confirm no test file exists for this component**

Run: `ls components/store/checkout-details-form.test.tsx 2>&1 || echo "missing"`
Expected: `missing` — this component has no test today (composite RHF component wired to the store, same convention `checkout-client.tsx` follows per the prior plan's Global Constraints; verified via `npm run dev` in Step 3 below instead).

- [ ] **Step 2: Edit the component**

In `components/store/checkout-details-form.tsx`, remove the `email`/`companyName`/`taxId` `FormField` blocks from the customer-info `Card`'s `CardContent`:

```tsx
          <FormField label={dict.emailLabel} error={checkoutFieldError(dict, errors.email?.message)}>
            <Input type="email" autoComplete="email" {...register("email")} />
          </FormField>
          <FormField label={dict.companyNameLabel} hint={dict.companyOptionalHint}>
            <Input autoComplete="organization" {...register("companyName")} />
          </FormField>
          <FormField label={dict.taxIdLabel}>
            <Input {...register("taxId")} />
          </FormField>
```

Wrap the whole customer-info `Card` in a check for whether the profile is already complete — replace:

```tsx
      <Card>
        <CardHeader>
          <CardTitle>{dict.customerTitle}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <FormField
            label={dict.firstNameLabel}
            required
            error={checkoutFieldError(dict, errors.firstName?.message)}
          >
            <Input autoComplete="given-name" {...register("firstName")} />
          </FormField>
          <FormField
            label={dict.lastNameLabel}
            required
            error={checkoutFieldError(dict, errors.lastName?.message)}
          >
            <Input autoComplete="family-name" {...register("lastName")} />
          </FormField>
        </CardContent>
      </Card>
```

with:

```tsx
      {profileComplete ? null : (
        <Card>
          <CardHeader>
            <CardTitle>{dict.customerTitle}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            <FormField
              label={dict.firstNameLabel}
              required
              error={checkoutFieldError(dict, errors.firstName?.message)}
            >
              <Input autoComplete="given-name" {...register("firstName")} />
            </FormField>
            <FormField
              label={dict.lastNameLabel}
              required
              error={checkoutFieldError(dict, errors.lastName?.message)}
            >
              <Input autoComplete="family-name" {...register("lastName")} />
            </FormField>
          </CardContent>
        </Card>
      )}
```

Add the `profileComplete` constant right after the `useForm` call (before the existing `useWatch` line):

```tsx
  // An unregistered field still submits its defaultValue with React Hook
  // Form, so firstName/lastName reach `onSubmit` even with no input mounted
  // for them — this just removes the friction of retyping a name the local
  // profile already has.
  const profileComplete = profile.firstName.trim().length > 0 && profile.lastName.trim().length > 0;
```

- [ ] **Step 3: Manual check**

Run: `npm run dev`. With an empty local profile (clear `localStorage` or use a private window), open `/checkout` and confirm the name card renders and email/company/tax-id fields are gone. Then fill the profile via `/account` (first/last name), reload `/checkout`, and confirm the name card is gone entirely while the order still submits successfully.

- [ ] **Step 4: Verify the build**

Run: `npx tsc --noEmit && npm run lint && npm test && npm run build`
Expected: all exit 0 / all pass.

- [ ] **Step 5: Commit**

```bash
git add components/store/checkout-details-form.tsx
git commit -m "feat(checkout): drop B2B fields, skip the name card when the profile is already complete"
```

---

### Task 10: `CheckoutSubmitButton` — auth-gated submit, reusing the existing `AuthDialog`

**Files:**
- Create: `components/store/checkout-submit-button.tsx`

**Interfaces:**
- Consumes: `AuthDialog` (`components/account/auth-dialog.tsx`, unchanged — its `onVerified` callback and `children`-as-trigger shape were already built for exactly this). `useAuthHint` (`hooks/use-auth-hint.ts`, unchanged — the same non-authoritative UX signal `HeaderActions` already uses to choose between the dialog and a real link).
- Produces: `<CheckoutSubmitButton formId dict account size="lg" className="mt-6 w-full">{label}</CheckoutSubmitButton>` — a signed-in visitor gets a plain `<button type="submit" form={formId}>`; a signed-out one gets the same button wrapped by `AuthDialog`, whose `onVerified` calls `document.getElementById(formId)?.requestSubmit()` once the dialog closes, so a verified visitor's checkout submits immediately rather than requiring a second click. Task 11's `checkout-client.tsx` and `checkout-summary-sheet.tsx` are the two consumers (today's two separate plain submit buttons).

- [ ] **Step 1: Confirm no test file convention applies**

Same reasoning as Task 9 — this wraps `AuthDialog` (untested) and a plain `<button>`, no store/network wiring of its own; verified manually in Step 3.

- [ ] **Step 2: Implement**

Create `components/store/checkout-submit-button.tsx`:

```tsx
"use client";

import { AuthDialog } from "@/components/account/auth-dialog";
import { useAuthHint } from "@/hooks/use-auth-hint";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { Button, type ButtonProps } from "@/components/ui/button";

export interface CheckoutSubmitButtonProps extends Omit<ButtonProps, "type" | "form" | "onClick"> {
  formId: string;
  account: Dictionary["account"];
  closeLabel: string;
  disabled?: boolean;
  children: React.ReactNode;
}

/**
 * Same non-authoritative signal `HeaderActions` already uses to choose
 * between the sign-in dialog and a real destination — the server (checkout's
 * own POST route) is what actually enforces the session; this only decides
 * which control to show.
 */
export function CheckoutSubmitButton({
  formId,
  account,
  closeLabel,
  disabled,
  children,
  ...buttonProps
}: CheckoutSubmitButtonProps) {
  const signedIn = useAuthHint();

  if (signedIn) {
    return (
      <Button type="submit" form={formId} disabled={disabled} {...buttonProps}>
        {children}
      </Button>
    );
  }

  return (
    <AuthDialog
      dict={account}
      closeLabel={closeLabel}
      onVerified={() => {
        // Same form the plain submit button targets via the `form` attribute.
        // requestSubmit() fires a real "submit" event, which re-runs React
        // Hook Form's validation/onSubmit exactly as a real click would — so
        // a failed-validation state still surfaces normally instead of being
        // bypassed by this programmatic trigger.
        const form = document.getElementById(formId);
        if (form instanceof HTMLFormElement) {
          form.requestSubmit();
        }
      }}
    >
      <Button type="button" disabled={disabled} {...buttonProps}>
        {children}
      </Button>
    </AuthDialog>
  );
}
```

- [ ] **Step 3: Manual check**

Run: `npm run dev`. Sign out, add an item to the cart, open `/checkout`, fill the form, click the submit button — confirm the sign-in dialog opens instead of a validation error. Complete the OTP flow and confirm the order submits automatically with no second click. Then sign in first and repeat — confirm the button submits directly with no dialog.

- [ ] **Step 4: Verify the build**

Run: `npx tsc --noEmit && npm run lint && npm test && npm run build`
Expected: all exit 0 / all pass. If `components/ui/button.tsx` does not export a `ButtonProps` type, read that file first and adjust the import/prop type to whatever it does export (e.g. `React.ComponentProps<typeof Button>`).

- [ ] **Step 5: Commit**

```bash
git add components/store/checkout-submit-button.tsx
git commit -m "feat(checkout): gate the submit button behind the existing sign-in dialog"
```

---

### Task 11: Wire `CheckoutSubmitButton` into the desktop card and mobile sheet

**Files:**
- Modify: `components/store/checkout-client.tsx`
- Modify: `components/store/checkout-summary-sheet.tsx`

**Interfaces:**
- Consumes: Task 10's `CheckoutSubmitButton`.
- Produces: both of today's plain `<Button type="submit" form={formId}>` submit controls are replaced.

- [ ] **Step 1: Edit `checkout-client.tsx`**

Add the import:

```tsx
import { CheckoutSubmitButton } from "@/components/store/checkout-submit-button";
```

Replace the desktop aside's submit button:

```tsx
            <Button type="submit" form={formId} size="lg" className="mt-6 w-full" disabled={status === "submitting"}>
              {status === "submitting" ? dict.submitting : dict.submit}
            </Button>
```

with:

```tsx
            <CheckoutSubmitButton
              formId={formId}
              account={dict.account}
              closeLabel={dict.account.profilePanel.close}
              size="lg"
              className="mt-6 w-full"
              disabled={status === "submitting"}
            >
              {status === "submitting" ? dict.submitting : dict.submit}
            </CheckoutSubmitButton>
```

`CheckoutClientProps` needs `dict.account` now — add it to the props interface and to `CheckoutPage`'s call site:

In `components/store/checkout-client.tsx`'s `CheckoutClientProps`:

```tsx
interface CheckoutClientProps {
  lang: Locale;
  dict: Dictionary["checkout"];
  cartDict: Dictionary["cart"];
  account: Dictionary["account"];
}
```

and destructure `account` alongside the existing props in `export function CheckoutClient({ lang, dict, cartDict, account }: CheckoutClientProps)`, forwarding it to `<CheckoutSubmitButton account={account} .../>` above and to `<CheckoutSummarySheet account={account} .../>` (Step 2 below).

In `app/(site)/checkout/page.tsx`, update the call site:

```tsx
        <CheckoutClient lang={lang} dict={dict.checkout} cartDict={dict.cart} account={dict.account} />
```

- [ ] **Step 2: Edit `checkout-summary-sheet.tsx`**

Add the import and extend `CheckoutSummarySheetProps`:

```tsx
import { CheckoutSubmitButton } from "@/components/store/checkout-submit-button";
```

```tsx
export interface CheckoutSummarySheetProps extends CheckoutOrderSummaryProps {
  formId: string;
  submitting: boolean;
  submitLabel: string;
  submittingLabel: string;
  account: Dictionary["account"];
}
```

(add `import type { Dictionary } from "@/lib/i18n/dictionaries";` if not already imported)

Replace the sticky bar's submit button:

```tsx
        <Button type="submit" form={formId} size="lg" className="w-full" disabled={submitting}>
          {submitting ? submittingLabel : submitLabel}
        </Button>
```

with:

```tsx
        <CheckoutSubmitButton
          formId={formId}
          account={account}
          closeLabel={checkoutDict.mobileSummaryClose}
          size="lg"
          className="w-full"
          disabled={submitting}
        >
          {submitting ? submittingLabel : submitLabel}
        </CheckoutSubmitButton>
```

and destructure `account` in the component's props alongside the existing ones.

Update `checkout-client.tsx`'s `<CheckoutSummarySheet .../>` call site to pass `account={account}` too.

- [ ] **Step 2: Manual check**

Run: `npm run dev`, resize to a mobile width, sign out, and repeat Task 10's manual check against the bottom sheet's button instead of the desktop card's.

- [ ] **Step 3: Verify the build**

Run: `npx tsc --noEmit && npm run lint && npm test && npm run build`
Expected: all exit 0 / all pass.

- [ ] **Step 4: Commit**

```bash
git add components/store/checkout-client.tsx components/store/checkout-summary-sheet.tsx app/(site)/checkout/page.tsx
git commit -m "feat(checkout): wire the auth-gated submit button into both the desktop card and mobile sheet"
```

---

## Bosqich 3 — Yandex Maps delivery picker (root)

### Task 12: `lib/yandex/geocode.ts` — parse a Yandex GeoObject into city/district/street/addressText

**Files:**
- Create: `lib/yandex/geocode.ts`
- Create: `lib/yandex/geocode.test.ts`

**Interfaces:**
- Produces: `parseYandexAddress(geoObject: YandexGeoObject): { city: string; district: string; street: string; addressText: string }`. A pure function — no network call. The actual `ymaps.geocode()` call happens inside Task 13's `DeliveryMapPicker`, using the Yandex Maps JS API's own bundled geocoder (no separate HTTP Geocoder key needed — the same `NEXT_PUBLIC_YANDEX_MAPS_API_KEY` loaded for the map covers it), and this function parses that call's result.

- [ ] **Step 1: Write the failing test**

Create `lib/yandex/geocode.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseYandexAddress, type YandexGeoObject } from "./geocode";

/** Shaped after a real geocode-maps.yandex.ru response's GeoObjectCollection.featureMember[0].GeoObject. */
function fixture(components: { kind: string; name: string }[], formatted: string): YandexGeoObject {
  return {
    metaDataProperty: {
      GeocoderMetaData: {
        Address: { formatted, Components: components },
      },
    },
  };
}

describe("parseYandexAddress", () => {
  it("extracts locality/district/street from Components", () => {
    const geoObject = fixture(
      [
        { kind: "country", name: "O'zbekiston" },
        { kind: "province", name: "Toshkent shahri" },
        { kind: "area", name: "Chilonzor tumani" },
        { kind: "locality", name: "Toshkent" },
        { kind: "street", name: "Bunyodkor ko'chasi" },
        { kind: "house", name: "12" },
      ],
      "O'zbekiston, Toshkent, Chilonzor tumani, Bunyodkor ko'chasi, 12",
    );

    const result = parseYandexAddress(geoObject);

    expect(result).toEqual({
      city: "Toshkent",
      district: "Chilonzor tumani",
      street: "Bunyodkor ko'chasi 12",
      addressText: "O'zbekiston, Toshkent, Chilonzor tumani, Bunyodkor ko'chasi, 12",
    });
  });

  it("falls back to an empty street when no house number is present", () => {
    const geoObject = fixture(
      [
        { kind: "locality", name: "Toshkent" },
        { kind: "area", name: "Chilonzor tumani" },
        { kind: "street", name: "Bunyodkor ko'chasi" },
      ],
      "Toshkent, Chilonzor tumani, Bunyodkor ko'chasi",
    );

    expect(parseYandexAddress(geoObject).street).toBe("Bunyodkor ko'chasi");
  });

  it("falls back to an empty string for a missing component rather than throwing", () => {
    const geoObject = fixture([{ kind: "locality", name: "Toshkent" }], "Toshkent");

    const result = parseYandexAddress(geoObject);

    expect(result.district).toBe("");
    expect(result.street).toBe("");
    expect(result.city).toBe("Toshkent");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run lib/yandex/geocode.test.ts`
Expected: FAIL — `./geocode` does not exist.

- [ ] **Step 3: Implement**

Create `lib/yandex/geocode.ts`:

```ts
/** The slice of a geocode-maps.yandex.ru GeoObject this module reads. */
export interface YandexAddressComponent {
  kind: string;
  name: string;
}

export interface YandexGeoObject {
  metaDataProperty: {
    GeocoderMetaData: {
      Address: {
        formatted: string;
        Components: YandexAddressComponent[];
      };
    };
  };
}

function componentByKind(components: YandexAddressComponent[], kind: string): string {
  return components.find((component) => component.kind === kind)?.name ?? "";
}

/**
 * Yandex's `area` kind is the closest match to an Uzbek "tuman" (district);
 * `locality` is the city. Kept as a pure parse (no network call) so it is
 * unit-testable without a live API key — see DeliveryMapPicker for the
 * `ymaps.geocode()` call that produces the GeoObject this reads.
 */
export function parseYandexAddress(geoObject: YandexGeoObject): {
  city: string;
  district: string;
  street: string;
  addressText: string;
} {
  const components = geoObject.metaDataProperty.GeocoderMetaData.Address.Components;
  const street = componentByKind(components, "street");
  const house = componentByKind(components, "house");

  return {
    city: componentByKind(components, "locality"),
    district: componentByKind(components, "area"),
    street: house ? `${street} ${house}`.trim() : street,
    addressText: geoObject.metaDataProperty.GeocoderMetaData.Address.formatted,
  };
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run lib/yandex/geocode.test.ts`
Expected: PASS.

- [ ] **Step 5: Verify the build**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add lib/yandex/geocode.ts lib/yandex/geocode.test.ts
git commit -m "feat(checkout): parse a Yandex geocoder result into city/district/street"
```

---

### Task 13: `DeliveryMapPicker` — Yandex Maps JS API pin-drop + search

**Files:**
- Create: `components/store/delivery-map-picker.tsx`

**Interfaces:**
- Consumes: Task 12's `parseYandexAddress`.
- Produces: `<DeliveryMapPicker value={{lat,lng,addressText} | null} onChange={(pin: {lat: number; lng: number; city: string; district: string; street: string; addressText: string}) => void} apiKey={string | undefined} />`. When `apiKey` is undefined (env var unset), renders a message instead of a map rather than silently failing — same "missing config degrades visibly" pattern `PAYME_MERCHANT_ID`'s absence already follows server-side.

- [ ] **Step 1: No unit test — confirm the convention**

Run: `ls components/product/*.test.tsx 2>&1 | head -5` — none of this codebase's Radix/motion-driven interactive components (`filter-drawer.tsx`, `checkout-summary-sheet.tsx`) have a component test; a third-party map SDK loaded via a `<script>` tag is even less testable in jsdom. Verified manually in Step 3.

- [ ] **Step 2: Implement**

Create `components/store/delivery-map-picker.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { parseYandexAddress, type YandexGeoObject } from "@/lib/yandex/geocode";

export interface DeliveryPin {
  lat: number;
  lng: number;
  city: string;
  district: string;
  street: string;
  addressText: string;
}

/** The slice of the global `ymaps` object this component calls. Yandex ships no first-party types. */
interface YMaps {
  ready(callback: () => void): void;
  Map: new (element: HTMLElement, options: { center: [number, number]; zoom: number }) => YMapInstance;
  Placemark: new (coords: [number, number]) => unknown;
  geocode(request: [number, number] | string): Promise<{
    geoObjects: { get(index: number): { geometry: { getCoordinates(): [number, number] } } & YandexGeoObject };
  }>;
}
interface YMapInstance {
  geoObjects: { removeAll(): void; add(object: unknown): void };
  events: { add(event: string, handler: (e: { get(name: string): [number, number] }) => void): void };
}

declare global {
  interface Window {
    ymaps?: YMaps;
  }
}

const TASHKENT_CENTER: [number, number] = [41.311081, 69.240562];

function loadYandexMapsScript(apiKey: string): Promise<YMaps> {
  return new Promise((resolve, reject) => {
    if (window.ymaps) {
      resolve(window.ymaps);
      return;
    }
    const script = document.createElement("script");
    script.src = `https://api-maps.yandex.ru/2.1/?apikey=${apiKey}&lang=uz_UZ`;
    script.async = true;
    script.onload = () => {
      window.ymaps!.ready(() => resolve(window.ymaps!));
    };
    script.onerror = () => reject(new Error("Failed to load Yandex Maps"));
    document.head.appendChild(script);
  });
}

export function DeliveryMapPicker({
  value,
  onChange,
  apiKey,
  noApiKeyMessage,
  loadingMessage,
}: {
  value: { lat: number; lng: number; addressText: string } | null;
  onChange: (pin: DeliveryPin) => void;
  apiKey: string | undefined;
  noApiKeyMessage: string;
  loadingMessage: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<YMapInstance | null>(null);
  const ymapsRef = useRef<YMaps | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    if (!apiKey || !containerRef.current) {
      return;
    }
    let cancelled = false;

    loadYandexMapsScript(apiKey)
      .then((ymaps) => {
        if (cancelled || !containerRef.current) {
          return;
        }
        ymapsRef.current = ymaps;
        const center: [number, number] = value ? [value.lat, value.lng] : TASHKENT_CENTER;
        const map = new ymaps.Map(containerRef.current, { center, zoom: 15 });
        mapRef.current = map;

        if (value) {
          map.geoObjects.add(new ymaps.Placemark(center));
        }

        map.events.add("click", (event) => {
          const coords = event.get("coordName" as never) ?? event.get("coords" as never);
          void placePin(coords as [number, number]);
        });

        setStatus("ready");
      })
      .catch(() => setStatus("error"));

    async function placePin([lat, lng]: [number, number]) {
      const ymaps = ymapsRef.current;
      const map = mapRef.current;
      if (!ymaps || !map) {
        return;
      }
      map.geoObjects.removeAll();
      map.geoObjects.add(new ymaps.Placemark([lat, lng]));

      const result = await ymaps.geocode([lat, lng]);
      const geoObject = result.geoObjects.get(0);
      if (!geoObject) {
        return;
      }
      const parsed = parseYandexAddress(geoObject);
      onChange({ lat, lng, ...parsed });
    }

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-running on every `value`/`onChange` identity change would re-create the map and drop the user's pan/zoom state.
  }, [apiKey]);

  if (!apiKey) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-border bg-surface-muted px-4 text-center text-sm text-muted">
        {noApiKeyMessage}
      </div>
    );
  }

  return (
    <div className="relative h-64 overflow-hidden rounded-lg border border-border">
      <div ref={containerRef} className="h-full w-full" />
      {status === "loading" ? (
        <div className="absolute inset-0 flex items-center justify-center bg-surface-muted/80 text-sm text-muted">
          {loadingMessage}
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 3: Manual check**

Set `NEXT_PUBLIC_YANDEX_MAPS_API_KEY` in `.env.local` (a free Yandex Maps JS API key — the user sets this up themselves, see this plan's Global Constraints and Task 14). Run: `npm run dev`, reach the map (Task 14 wires it in), click a point, confirm a placemark drops and an address resolves. With the env var unset, confirm the "no API key" message renders instead of a broken map.

- [ ] **Step 4: Verify the build**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: all exit 0.

- [ ] **Step 5: Commit**

```bash
git add components/store/delivery-map-picker.tsx
git commit -m "feat(checkout): add a Yandex Maps pin-drop delivery address picker"
```

---

### Task 14: Wire `DeliveryMapPicker` into `CheckoutDetailsForm`, document the env var

**Files:**
- Modify: `components/store/checkout-details-form.tsx`
- Modify: `.env.example`

**Interfaces:**
- Consumes: Task 13's `DeliveryMapPicker`.
- Produces: the DELIVERY branch's manual `city`/`district`/`street` `FormField`s are replaced by the map picker, which sets `city`/`district`/`street`/`deliveryLatitude`/`deliveryLongitude`/`deliveryAddressText` on the form via `setValue` — the DTO/schema validation from Task 4/5 is otherwise untouched (still validates the same six fields, just no longer hand-typed).

- [ ] **Step 1: Edit the component**

Add imports:

```tsx
import { DeliveryMapPicker } from "@/components/store/delivery-map-picker";
```

`useForm`'s destructure needs `setValue` added alongside the existing `register`/`handleSubmit`/`control`/`formState`.

Replace the DELIVERY branch's manual address grid:

```tsx
          {isDelivery ? (
            <div className="grid gap-5 sm:grid-cols-2">
              <FormField label={dict.cityLabel} required error={checkoutFieldError(dict, errors.city?.message)}>
                <Input {...register("city")} />
              </FormField>
              <FormField
                label={dict.districtLabel}
                required
                error={checkoutFieldError(dict, errors.district?.message)}
              >
                <Input {...register("district")} />
              </FormField>
              <FormField
                label={dict.streetLabel}
                required
                error={checkoutFieldError(dict, errors.street?.message)}
                className="sm:col-span-2"
              >
                <Input {...register("street")} />
              </FormField>
              <FormField label={dict.deliveryNotesLabel} multiline className="sm:col-span-2">
                <Textarea rows={2} maxLength={500} {...register("deliveryNotes")} />
              </FormField>
            </div>
          ) : null}
```

with:

```tsx
          {isDelivery ? (
            <div className="flex flex-col gap-5">
              <FormField
                label={dict.deliveryAddressLabel}
                required
                error={
                  checkoutFieldError(dict, errors.city?.message) ??
                  checkoutFieldError(dict, errors.deliveryAddressText?.message)
                }
              >
                <DeliveryMapPicker
                  value={
                    pinLatitude !== undefined && pinLongitude !== undefined
                      ? { lat: pinLatitude, lng: pinLongitude, addressText: pinAddressText ?? "" }
                      : null
                  }
                  apiKey={process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY}
                  noApiKeyMessage={dict.mapUnavailable}
                  loadingMessage={dict.mapLoading}
                  onChange={(pin) => {
                    setValue("deliveryLatitude", pin.lat, { shouldValidate: true });
                    setValue("deliveryLongitude", pin.lng, { shouldValidate: true });
                    setValue("deliveryAddressText", pin.addressText, { shouldValidate: true });
                    setValue("city", pin.city, { shouldValidate: true });
                    setValue("district", pin.district, { shouldValidate: true });
                    setValue("street", pin.street, { shouldValidate: true });
                  }}
                />
              </FormField>
              {pinAddressText ? (
                <p className="text-sm text-muted">{pinAddressText}</p>
              ) : null}
              <FormField label={dict.deliveryNotesLabel} multiline>
                <Textarea rows={2} maxLength={500} {...register("deliveryNotes")} />
              </FormField>
            </div>
          ) : null}
```

Add the three watched values right after the existing `deliveryMethod`/`isDelivery` lines:

```tsx
  const pinLatitude = useWatch({ control, name: "deliveryLatitude" });
  const pinLongitude = useWatch({ control, name: "deliveryLongitude" });
  const pinAddressText = useWatch({ control, name: "deliveryAddressText" });
```

- [ ] **Step 2: Add the new dictionary keys**

`dict.checkout.deliveryAddressLabel`, `dict.checkout.mapUnavailable`, `dict.checkout.mapLoading` need entries in `dictionaries/en.json`, `ru.json`, `uz.json`, alongside the existing `checkout.*` keys (`cityLabel` etc. — read one file first to match the existing key ordering/style before adding). `cityLabel`/`districtLabel`/`streetLabel` are no longer read by this component but stay in the dictionary (a DTO validation error can still reference `city`/`district`/`street` field names via `checkoutFieldError`, and removing unused translation keys is a separate, purely cosmetic cleanup this task does not need).

- [ ] **Step 3: Document the env var**

In `.env.example`, add near the other `NEXT_PUBLIC_*` entries:

```
# Yandex Maps JS API key for the checkout delivery picker. Free tier at
# https://developer.tech.yandex.ru/services — restrict it to this site's
# domain(s) in the Yandex developer console. Left blank, DeliveryMapPicker
# renders a "map unavailable" message instead of a broken map.
NEXT_PUBLIC_YANDEX_MAPS_API_KEY=""
```

- [ ] **Step 4: Manual check**

Run: `npm run dev`, open `/checkout`, choose delivery, drop a pin, confirm `city`/`district`/`street` populate silently and the human-readable address line renders. Submit and confirm the order carries the coordinates (check via `npx prisma studio` in `backend/` against the `orders` table, or the seller panel once Task 25 lands).

- [ ] **Step 5: Verify the build**

Run: `npx tsc --noEmit && npm run lint && npm test && npm run build`
Expected: all exit 0 / all pass.

- [ ] **Step 6: Commit**

```bash
git add components/store/checkout-details-form.tsx .env.example
git commit -m "feat(checkout): replace manual address typing with the Yandex Maps picker"
```

---

## Bosqich 4 — Click & Paynet gateways (`backend/`)

### Task 15: Extract `recomputeOrderPaymentStatus` — shared by Payme, Payments, and (this bosqich) Click/Paynet

**Files:**
- Create: `backend/src/payments/order-payment-status.ts`
- Create: `backend/src/payments/order-payment-status.spec.ts`
- Modify: `backend/src/payme/payme.service.ts`
- Modify: `backend/src/payments/payments.service.ts`

**Interfaces:**
- Produces: `recomputeOrderPaymentStatus(tx: Pick<PrismaService, 'order' | 'payment'>, orderId: string): Promise<void>` — identical behavior to the copy currently private inside `PaymeService`. Task 16/17's `ClickService`/`PaynetService` are the new consumers this extraction exists for; `PaymeService`/`PaymentsService` are refactored onto it in this same task so a third and fourth copy of the same logic are never written.

- [ ] **Step 1: Write the failing test**

Create `backend/src/payments/order-payment-status.spec.ts`:

```ts
import { recomputeOrderPaymentStatus } from './order-payment-status';
import { Prisma } from '../../generated/prisma/client';

function makeTx(order: { total: Prisma.Decimal }, paidSum: Prisma.Decimal | null) {
  const update = jest.fn();
  return {
    tx: {
      order: { findUnique: jest.fn().mockResolvedValue(order), update },
      payment: { aggregate: jest.fn().mockResolvedValue({ _sum: { amount: paidSum } }) },
    },
    update,
  };
}

describe('recomputeOrderPaymentStatus', () => {
  it('sets PAID when the completed sum meets or exceeds the total', async () => {
    const { tx, update } = makeTx({ total: new Prisma.Decimal(100) }, new Prisma.Decimal(100));
    await recomputeOrderPaymentStatus(tx, 'ord-1');
    expect(update).toHaveBeenCalledWith({ where: { id: 'ord-1' }, data: { paymentStatus: 'PAID' } });
  });

  it('sets PARTIAL when something was paid but not the full total', async () => {
    const { tx, update } = makeTx({ total: new Prisma.Decimal(100) }, new Prisma.Decimal(40));
    await recomputeOrderPaymentStatus(tx, 'ord-1');
    expect(update).toHaveBeenCalledWith({ where: { id: 'ord-1' }, data: { paymentStatus: 'PARTIAL' } });
  });

  it('sets UNPAID when nothing was paid yet', async () => {
    const { tx, update } = makeTx({ total: new Prisma.Decimal(100) }, null);
    await recomputeOrderPaymentStatus(tx, 'ord-1');
    expect(update).toHaveBeenCalledWith({ where: { id: 'ord-1' }, data: { paymentStatus: 'UNPAID' } });
  });

  it('does nothing when the order no longer exists', async () => {
    const { tx, update } = makeTx as unknown as ReturnType<typeof makeTx>;
    const missing = {
      order: { findUnique: jest.fn().mockResolvedValue(null), update: jest.fn() },
      payment: { aggregate: jest.fn() },
    };
    await recomputeOrderPaymentStatus(missing, 'missing');
    expect(missing.order.update).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd backend && npx jest src/payments/order-payment-status.spec.ts`
Expected: FAIL — `./order-payment-status` does not exist.

- [ ] **Step 3: Implement**

Create `backend/src/payments/order-payment-status.ts`:

```ts
import { PrismaService } from '../prisma/prisma.service';
import { OrderPaymentStatus, PaymentStatus, Prisma } from '../../generated/prisma/client';

/**
 * One COMPLETED-sum aggregate, compared against Order.total with Prisma's
 * own Decimal comparison methods. Shared by every path that can mark a
 * Payment COMPLETED: PaymentsService's staff-recorded flow, and each online
 * gateway's webhook (Payme, Click, Paynet) — so the PAID/PARTIAL/UNPAID rule
 * is defined exactly once.
 */
export async function recomputeOrderPaymentStatus(
  tx: Pick<PrismaService, 'order' | 'payment'>,
  orderId: string,
): Promise<void> {
  const order = await tx.order.findUnique({ where: { id: orderId } });
  if (!order) return;

  const paidSoFar = await tx.payment.aggregate({
    where: { orderId, status: PaymentStatus.COMPLETED },
    _sum: { amount: true },
  });
  const totalPaid = paidSoFar._sum.amount ?? new Prisma.Decimal(0);

  const paymentStatus = totalPaid.gte(order.total)
    ? OrderPaymentStatus.PAID
    : totalPaid.gt(0)
      ? OrderPaymentStatus.PARTIAL
      : OrderPaymentStatus.UNPAID;

  await tx.order.update({ where: { id: orderId }, data: { paymentStatus } });
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd backend && npx jest src/payments/order-payment-status.spec.ts`
Expected: PASS.

- [ ] **Step 5: Refactor `PaymeService` onto it**

In `backend/src/payme/payme.service.ts`: delete the private `recomputeOrderPaymentStatus` method entirely, add `import { recomputeOrderPaymentStatus } from '../payments/order-payment-status';`, and replace both call sites (`this.recomputeOrderPaymentStatus(tx, payment.orderId)` in `performTransaction` and in `cancelTransaction`) with `recomputeOrderPaymentStatus(tx, payment.orderId)`.

- [ ] **Step 6: Refactor `PaymentsService` onto it**

In `backend/src/payments/payments.service.ts`, replace the inline aggregate-then-update block inside `create` (the `paidSoFar`/`totalPaid`/`paymentStatus`/`tx.order.update` lines that duplicate the same logic) with a single call: after `const payment = await tx.payment.create({...})`, replace everything through the closing `return payment;` with:

```ts
      const payment = await tx.payment.create({
        data: {
          orderId: dto.orderId,
          amount: new Prisma.Decimal(dto.amount),
          method: dto.method,
          status: PaymentStatus.COMPLETED,
          paidAt: new Date(),
        },
      });

      await recomputeOrderPaymentStatus(tx, dto.orderId);

      return payment;
```

Add `import { recomputeOrderPaymentStatus } from './order-payment-status';` and remove the now-unused `OrderPaymentStatus` import if nothing else in the file references it.

- [ ] **Step 7: Run both services' existing specs**

Run: `cd backend && npx jest src/payme/payme.service.spec.ts src/payments`
Expected: PASS — behavior is byte-identical, only the implementation moved.

- [ ] **Step 8: Verify the build**

Run: `cd backend && npx tsc --noEmit && npm run lint && npx jest`
Expected: all exit 0 / all pass.

- [ ] **Step 9: Commit**

```bash
git add backend/src/payments/order-payment-status.ts backend/src/payments/order-payment-status.spec.ts backend/src/payme/payme.service.ts backend/src/payments/payments.service.ts
git commit -m "refactor(backend): extract recomputeOrderPaymentStatus so Click/Paynet don't duplicate it a third and fourth time"
```

---

### Task 16: `backend/src/click/` — Prepare/Complete gateway module

**Files:**
- Create: `backend/src/click/click-money.ts`
- Create: `backend/src/click/click-money.spec.ts`
- Create: `backend/src/click/click-auth.guard.ts`
- Create: `backend/src/click/click.service.ts`
- Create: `backend/src/click/click.service.spec.ts`
- Create: `backend/src/click/click.controller.ts`
- Create: `backend/src/click/click.module.ts`
- Modify: `backend/src/app.module.ts`
- Modify: `backend/.env.example`

**Interfaces:**
- Consumes: Task 15's `recomputeOrderPaymentStatus`.
- Produces: `buildClickCheckoutUrl({merchantId, serviceId, orderId, amount, returnUrl?}): string`; `ClickService.prepare`/`complete` (Click's two-phase protocol — Prepare reserves, Complete finalizes); `POST /click`, guarded by `ClickAuthGuard` (verifies `sign_string`). Task 18's `CheckoutService` and Task 19's frontend are the consumers, once wired.

- [ ] **Step 1: Write the failing money-helper test**

Create `backend/src/click/click-money.spec.ts`:

```ts
import { buildClickCheckoutUrl, verifyClickSignature } from './click-money';

describe('buildClickCheckoutUrl', () => {
  it('builds a my.click.uz pay link carrying the order id as transaction_param', () => {
    const url = buildClickCheckoutUrl({
      merchantId: 'merch-1',
      serviceId: 'svc-1',
      orderId: 'ord-1',
      amount: 150000,
    });

    expect(url).toContain('https://my.click.uz/services/pay');
    expect(url).toContain('merchant_id=merch-1');
    expect(url).toContain('service_id=svc-1');
    expect(url).toContain('transaction_param=ord-1');
    expect(url).toContain('amount=150000');
  });

  it('appends return_url when given', () => {
    const url = buildClickCheckoutUrl({
      merchantId: 'merch-1', serviceId: 'svc-1', orderId: 'ord-1', amount: 1000,
      returnUrl: 'https://www.diesel-parts.uz/checkout/status/ord-1',
    });
    expect(url).toContain('return_url=https%3A%2F%2Fwww.diesel-parts.uz%2Fcheckout%2Fstatus%2Ford-1');
  });
});

describe('verifyClickSignature', () => {
  it('confirms a signature computed the same way Click computes it', () => {
    const params = {
      click_trans_id: '111', service_id: 'svc-1', merchant_trans_id: 'ord-1',
      amount: '1000', action: '0', sign_time: '2026-08-28 10:00:00',
    };
    const { createHash } = require('crypto') as typeof import('crypto');
    const signString = createHash('md5')
      .update(`${params.click_trans_id}${params.service_id}secret-key${params.merchant_trans_id}${params.amount}${params.action}${params.sign_time}`)
      .digest('hex');

    expect(verifyClickSignature(params, signString, 'secret-key')).toBe(true);
    expect(verifyClickSignature(params, 'wrong', 'secret-key')).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd backend && npx jest src/click/click-money.spec.ts`
Expected: FAIL — `./click-money` does not exist.

- [ ] **Step 3: Implement the money helper**

Create `backend/src/click/click-money.ts`:

```ts
import { createHash } from 'crypto';

export interface ClickCheckoutParams {
  merchantId: string;
  serviceId: string;
  orderId: string;
  amount: number;
  returnUrl?: string;
}

/**
 * https://my.click.uz/services/pay — Click's hosted invoice link, confirmed
 * against Click's own merchant integration guide's "Click havolasi" example.
 * `transaction_param` carries our order id back on Prepare/Complete.
 */
export function buildClickCheckoutUrl(params: ClickCheckoutParams): string {
  const query = new URLSearchParams({
    service_id: params.serviceId,
    merchant_id: params.merchantId,
    amount: String(params.amount),
    transaction_param: params.orderId,
  });
  if (params.returnUrl) {
    query.set('return_url', params.returnUrl);
  }
  return `https://my.click.uz/services/pay?${query.toString()}`;
}

export interface ClickSignatureParams {
  click_trans_id: string;
  service_id: string;
  merchant_trans_id: string;
  amount: string;
  action: string;
  sign_time: string;
  /** Complete only. */
  merchant_prepare_id?: string;
}

/**
 * sign_string = md5(click_trans_id + service_id + SECRET_KEY + merchant_trans_id
 *   [+ merchant_prepare_id, Complete only] + amount + action + sign_time)
 * per Click's merchant API guide.
 */
export function verifyClickSignature(
  params: ClickSignatureParams,
  signature: string,
  secretKey: string,
): boolean {
  const middle = params.merchant_prepare_id ?? '';
  const expected = createHash('md5')
    .update(
      `${params.click_trans_id}${params.service_id}${secretKey}${params.merchant_trans_id}${middle}${params.amount}${params.action}${params.sign_time}`,
    )
    .digest('hex');
  return expected === signature;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd backend && npx jest src/click/click-money.spec.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing service test**

Create `backend/src/click/click.service.spec.ts`:

```ts
import { ClickService } from './click.service';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../../generated/prisma/client';

function makePrisma(overrides: { order?: Record<string, unknown>; payment?: Record<string, unknown> } = {}) {
  const prisma = {
    order: { findUnique: jest.fn(), update: jest.fn(), ...overrides.order },
    payment: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), aggregate: jest.fn(), ...overrides.payment },
    $transaction: jest.fn((fn: (tx: unknown) => unknown) => fn(prisma)),
  } as unknown as PrismaService;
  return prisma;
}

describe('ClickService.prepare', () => {
  it('creates a PENDING payment and returns error 0 when the order and amount match', async () => {
    const orderFindUnique = jest.fn().mockResolvedValue({ id: 'ord-1', total: new Prisma.Decimal(1000) });
    const paymentFindFirst = jest.fn().mockResolvedValue(null);
    const paymentCreate = jest.fn().mockResolvedValue({ id: 'pay-1' });
    const prisma = makePrisma({ order: { findUnique: orderFindUnique }, payment: { findFirst: paymentFindFirst, create: paymentCreate } });
    const service = new ClickService(prisma);

    const result = await service.prepare({
      click_trans_id: '111', merchant_trans_id: 'ord-1', amount: '1000',
    });

    expect(result.error).toBe(0);
    expect(paymentCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ orderId: 'ord-1', method: 'CLICK', status: 'PENDING', provider: 'click' }) }),
    );
  });

  it('answers error -5 when the order does not exist', async () => {
    const prisma = makePrisma({ order: { findUnique: jest.fn().mockResolvedValue(null) } });
    const service = new ClickService(prisma);

    const result = await service.prepare({ click_trans_id: '111', merchant_trans_id: 'missing', amount: '1000' });

    expect(result.error).toBe(-5);
  });

  it('answers error -2 when the amount does not match the order total', async () => {
    const orderFindUnique = jest.fn().mockResolvedValue({ id: 'ord-1', total: new Prisma.Decimal(1000) });
    const prisma = makePrisma({ order: { findUnique: orderFindUnique } });
    const service = new ClickService(prisma);

    const result = await service.prepare({ click_trans_id: '111', merchant_trans_id: 'ord-1', amount: '999' });

    expect(result.error).toBe(-2);
  });
});

describe('ClickService.complete', () => {
  it('marks the payment COMPLETED and recomputes the order payment status', async () => {
    const payment = { id: 'pay-1', orderId: 'ord-1', status: 'PENDING' };
    const paymentFindFirst = jest.fn().mockResolvedValue(payment);
    const paymentUpdate = jest.fn().mockResolvedValue({ ...payment, status: 'COMPLETED', paidAt: new Date() });
    const orderFindUnique = jest.fn().mockResolvedValue({ id: 'ord-1', total: new Prisma.Decimal(1000) });
    const aggregate = jest.fn().mockResolvedValue({ _sum: { amount: new Prisma.Decimal(1000) } });
    const orderUpdate = jest.fn();
    const prisma = makePrisma({
      payment: { findFirst: paymentFindFirst, update: paymentUpdate, aggregate },
      order: { findUnique: orderFindUnique, update: orderUpdate },
    });
    const service = new ClickService(prisma);

    const result = await service.complete({
      click_trans_id: '111', merchant_trans_id: 'ord-1', merchant_prepare_id: 'pay-1', amount: '1000',
    });

    expect(result.error).toBe(0);
    expect(paymentUpdate).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'pay-1' } }));
    expect(orderUpdate).toHaveBeenCalledWith({ where: { id: 'ord-1' }, data: { paymentStatus: 'PAID' } });
  });

  it('answers error -6 when the prepared payment cannot be found', async () => {
    const prisma = makePrisma({ payment: { findFirst: jest.fn().mockResolvedValue(null) } });
    const service = new ClickService(prisma);

    const result = await service.complete({ click_trans_id: '111', merchant_trans_id: 'ord-1', merchant_prepare_id: 'missing', amount: '1000' });

    expect(result.error).toBe(-6);
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `cd backend && npx jest src/click/click.service.spec.ts`
Expected: FAIL — `./click.service` does not exist.

- [ ] **Step 7: Implement the service**

Create `backend/src/click/click.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { recomputeOrderPaymentStatus } from '../payments/order-payment-status';
import { PaymentMethod, PaymentStatus, Prisma } from '../../generated/prisma/client';

/**
 * Click's own error-code family, confirmed against Click's merchant
 * integration guide's Prepare/Complete response table.
 */
const CLICK_ERROR = {
  SUCCESS: 0,
  SIGN_CHECK_FAILED: -1,
  INVALID_AMOUNT: -2,
  ACTION_NOT_FOUND: -3,
  ALREADY_PAID: -4,
  USER_NOT_FOUND: -5,
  TRANSACTION_NOT_FOUND: -6,
  FAILED_TO_UPDATE: -7,
  ERROR_IN_REQUEST: -8,
  TRANSACTION_CANCELLED: -9,
} as const;

interface PrepareParams {
  click_trans_id: string;
  merchant_trans_id: string;
  amount: string;
}

interface CompleteParams {
  click_trans_id: string;
  merchant_trans_id: string;
  merchant_prepare_id: string;
  amount: string;
}

function amountMismatch(orderTotal: Prisma.Decimal, amount: string): boolean {
  return !orderTotal.equals(new Prisma.Decimal(amount));
}

@Injectable()
export class ClickService {
  constructor(private readonly prisma: PrismaService) {}

  async prepare(params: PrepareParams) {
    const order = await this.prisma.order.findUnique({ where: { id: params.merchant_trans_id } });
    if (!order) {
      return { error: CLICK_ERROR.USER_NOT_FOUND, error_note: 'Order not found' };
    }
    if (amountMismatch(order.total, params.amount)) {
      return { error: CLICK_ERROR.INVALID_AMOUNT, error_note: 'Invalid amount' };
    }

    const payment = await this.prisma.payment.create({
      data: {
        orderId: order.id,
        amount: order.total,
        method: PaymentMethod.CLICK,
        status: PaymentStatus.PENDING,
        provider: 'click',
        transactionId: params.click_trans_id,
      },
    });

    return {
      error: CLICK_ERROR.SUCCESS,
      error_note: 'Success',
      click_trans_id: params.click_trans_id,
      merchant_trans_id: params.merchant_trans_id,
      merchant_prepare_id: payment.id,
    };
  }

  async complete(params: CompleteParams) {
    const payment = await this.prisma.payment.findFirst({
      where: { id: params.merchant_prepare_id, provider: 'click' },
    });
    if (!payment) {
      return { error: CLICK_ERROR.TRANSACTION_NOT_FOUND, error_note: 'Transaction not found' };
    }
    if (amountMismatch(payment.amount, params.amount)) {
      return { error: CLICK_ERROR.INVALID_AMOUNT, error_note: 'Invalid amount' };
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.COMPLETED, paidAt: new Date() },
      });
      await recomputeOrderPaymentStatus(tx, payment.orderId);
    });

    return {
      error: CLICK_ERROR.SUCCESS,
      error_note: 'Success',
      click_trans_id: params.click_trans_id,
      merchant_trans_id: params.merchant_trans_id,
      merchant_confirm_id: payment.id,
    };
  }
}
```

- [ ] **Step 8: Run it to verify it passes**

Run: `cd backend && npx jest src/click/click.service.spec.ts`
Expected: PASS.

- [ ] **Step 9: Implement the auth guard**

Create `backend/src/click/click-auth.guard.ts`:

```ts
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { verifyClickSignature } from './click-money';

@Injectable()
export class ClickAuthGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const body = request.body as Record<string, string>;
    const secretKey = this.config.getOrThrow<string>('CLICK_SECRET_KEY');

    const valid = verifyClickSignature(
      {
        click_trans_id: body.click_trans_id,
        service_id: body.service_id,
        merchant_trans_id: body.merchant_trans_id,
        amount: body.amount,
        action: body.action,
        sign_time: body.sign_time,
        merchant_prepare_id: body.merchant_prepare_id,
      },
      body.sign_string,
      secretKey,
    );

    if (!valid) {
      throw new UnauthorizedException('Invalid Click sign_string');
    }
    return true;
  }
}
```

- [ ] **Step 10: Implement the controller and module**

Create `backend/src/click/click.controller.ts`:

```ts
import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ClickService } from './click.service';
import { ClickAuthGuard } from './click-auth.guard';

interface ClickWebhookBody {
  action: string;
  click_trans_id: string;
  merchant_trans_id: string;
  merchant_prepare_id?: string;
  amount: string;
}

/** The single URL registered in Click's merchant cabinet — action 0 is Prepare, action 1 is Complete. */
@Controller('click')
@UseGuards(ClickAuthGuard)
export class ClickController {
  constructor(private readonly click: ClickService) {}

  @Post()
  handle(@Body() body: ClickWebhookBody) {
    if (body.action === '0') {
      return this.click.prepare(body);
    }
    return this.click.complete({
      click_trans_id: body.click_trans_id,
      merchant_trans_id: body.merchant_trans_id,
      merchant_prepare_id: body.merchant_prepare_id ?? '',
      amount: body.amount,
    });
  }
}
```

Create `backend/src/click/click.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { ClickController } from './click.controller';
import { ClickService } from './click.service';

@Module({
  controllers: [ClickController],
  providers: [ClickService],
})
export class ClickModule {}
```

- [ ] **Step 11: Register the module**

In `backend/src/app.module.ts`, add `import { ClickModule } from './click/click.module';` and `ClickModule,` to the `imports` array, right after `PaymeModule,`.

- [ ] **Step 12: Document the env vars**

In `backend/.env.example`, add near the `PAYME_*` entries:

```
# Click merchant credentials — https://docs.click.uz. Left blank,
# CheckoutService's CLICK branch never builds a checkoutUrl.
CLICK_MERCHANT_ID=""
CLICK_SERVICE_ID=""
CLICK_SECRET_KEY=""
```

- [ ] **Step 13: Verify the build**

Run: `cd backend && npx tsc --noEmit && npm run lint && npx jest`
Expected: all exit 0 / all pass.

- [ ] **Step 14: Commit**

```bash
git add backend/src/click backend/src/app.module.ts backend/.env.example
git commit -m "feat(backend): add the Click Prepare/Complete payment gateway module"
```

---

### Task 17: `backend/src/paynet/` — JSON-RPC gateway module mirroring Payme

**Files:**
- Create: `backend/src/paynet/paynet-money.ts`
- Create: `backend/src/paynet/paynet-money.spec.ts`
- Create: `backend/src/paynet/paynet-auth.guard.ts`
- Create: `backend/src/paynet/paynet.service.ts`
- Create: `backend/src/paynet/paynet.service.spec.ts`
- Create: `backend/src/paynet/paynet.controller.ts`
- Create: `backend/src/paynet/paynet.module.ts`
- Modify: `backend/src/app.module.ts`
- Modify: `backend/.env.example`

**Interfaces:**
- Consumes: Task 15's `recomputeOrderPaymentStatus`.
- Produces: `buildPaynetCheckoutUrl({merchantId, orderId, amount}): string`; `PaynetService.checkPerformTransaction`/`createTransaction`/`performTransaction`/`cancelTransaction`/`checkTransaction`, structurally identical to `PaymeService`; `POST /paynet`, guarded by `PaynetAuthGuard` (Basic Auth, same shape as `PaymeAuthGuard`).

- [ ] **Step 1: Write the failing money-helper test**

Create `backend/src/paynet/paynet-money.spec.ts`:

```ts
import { buildPaynetCheckoutUrl, toTiyin } from './paynet-money';

describe('buildPaynetCheckoutUrl', () => {
  it('builds a checkout link carrying the merchant id, order id, and amount', () => {
    const url = buildPaynetCheckoutUrl({ merchantId: 'merch-1', orderId: 'ord-1', amount: 1500 });
    expect(url).toContain('merch-1');
    expect(url).toContain('ord-1');
  });
});

describe('toTiyin', () => {
  it('converts UZS to the integer minor unit', () => {
    expect(toTiyin(150)).toBe(15000);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd backend && npx jest src/paynet/paynet-money.spec.ts`
Expected: FAIL — `./paynet-money` does not exist.

- [ ] **Step 3: Implement the money helper**

Create `backend/src/paynet/paynet-money.ts`:

```ts
export interface PaynetCheckoutParams {
  merchantId: string;
  orderId: string;
  amount: number;
}

export function toTiyin(amountUzs: number): number {
  return Math.round(amountUzs * 100);
}

/**
 * Paynet's exact hosted-checkout link format is not documented in this
 * codebase and could not be verified against live docs this session — see
 * this plan's Global Constraints. This mirrors Payme's base64(m=...;ac...)
 * shape as the safest structural placeholder; confirm against Paynet's
 * actual merchant guide before this ever reaches a real Paynet account.
 */
export function buildPaynetCheckoutUrl(params: PaynetCheckoutParams): string {
  const encoded = Buffer.from(
    `m=${params.merchantId};ac.order_id=${params.orderId};a=${toTiyin(params.amount)}`,
    'utf-8',
  ).toString('base64');
  return `https://checkout.paynet.uz/${encoded}`;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd backend && npx jest src/paynet/paynet-money.spec.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing service test**

Create `backend/src/paynet/paynet.service.spec.ts` (mirrors `backend/src/payme/payme.service.spec.ts`'s exact structure — read that file first and copy its `describe` blocks verbatim, replacing `PaymeService`/`'payme'` with `PaynetService`/`'paynet'` throughout):

```ts
import { PaynetService } from './paynet.service';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../../generated/prisma/client';

function makePrisma(overrides: { order?: Record<string, unknown>; payment?: Record<string, unknown> } = {}) {
  const prisma = {
    order: { findUnique: jest.fn(), ...overrides.order },
    payment: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), aggregate: jest.fn(), ...overrides.payment },
    $transaction: jest.fn((fn: (tx: unknown) => unknown) => fn(prisma)),
  } as unknown as PrismaService;
  return prisma;
}

describe('PaynetService.checkPerformTransaction', () => {
  it('allows a matching order/amount', async () => {
    const prisma = makePrisma({ order: { findUnique: jest.fn().mockResolvedValue({ total: new Prisma.Decimal(10) }) } });
    const service = new PaynetService(prisma);
    const result = await service.checkPerformTransaction({ amount: 1000, account: { order_id: 'ord-1' } });
    expect(result).toEqual({ result: { allow: true } });
  });

  it('errors when the order does not exist', async () => {
    const prisma = makePrisma({ order: { findUnique: jest.fn().mockResolvedValue(null) } });
    const service = new PaynetService(prisma);
    const result = await service.checkPerformTransaction({ amount: 1000, account: { order_id: 'missing' } });
    expect('error' in result).toBe(true);
  });
});

describe('PaynetService.createTransaction', () => {
  it('creates a PENDING payment on first call', async () => {
    const orderFindUnique = jest.fn().mockResolvedValue({ id: 'ord-1', total: new Prisma.Decimal(10) });
    const paymentFindFirst = jest.fn().mockResolvedValue(null);
    const paymentCreate = jest.fn().mockResolvedValue({ id: 'pay-1', providerCreateTime: BigInt(1000) });
    const prisma = makePrisma({
      order: { findUnique: orderFindUnique },
      payment: { findFirst: paymentFindFirst, create: paymentCreate },
    });
    const service = new PaynetService(prisma);

    const result = await service.createTransaction({ id: 'tx-1', time: 1000, amount: 1000, account: { order_id: 'ord-1' } });

    expect('result' in result).toBe(true);
    expect(paymentCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ method: 'PAYNET', provider: 'paynet' }) }),
    );
  });
});

describe('PaynetService.performTransaction', () => {
  it('marks a PENDING payment COMPLETED', async () => {
    const paymentFindFirst = jest.fn().mockResolvedValue({ id: 'pay-1', orderId: 'ord-1', status: 'PENDING' });
    const paymentUpdate = jest.fn().mockResolvedValue({ id: 'pay-1', paidAt: new Date() });
    const orderFindUnique = jest.fn().mockResolvedValue({ id: 'ord-1', total: new Prisma.Decimal(10) });
    const aggregate = jest.fn().mockResolvedValue({ _sum: { amount: new Prisma.Decimal(10) } });
    const orderUpdate = jest.fn();
    const prisma = makePrisma({
      payment: { findFirst: paymentFindFirst, update: paymentUpdate, aggregate },
      order: { findUnique: orderFindUnique, update: orderUpdate },
    });
    const service = new PaynetService(prisma);

    const result = await service.performTransaction({ id: 'pay-1' });

    expect('result' in result).toBe(true);
    expect(orderUpdate).toHaveBeenCalledWith({ where: { id: 'ord-1' }, data: { paymentStatus: 'PAID' } });
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `cd backend && npx jest src/paynet/paynet.service.spec.ts`
Expected: FAIL — `./paynet.service` does not exist.

- [ ] **Step 7: Implement the service**

Create `backend/src/paynet/paynet.service.ts` — same structure as `backend/src/payme/payme.service.ts` (read it first), with `provider: 'paynet'` and `PaymentMethod.PAYNET` in place of Payme's values, using `recomputeOrderPaymentStatus` from Task 15 directly (no private duplicate — Paynet is built after the extraction, unlike Payme which predates it):

```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { recomputeOrderPaymentStatus } from '../payments/order-payment-status';
import { toTiyin } from './paynet-money';
import { PaymentMethod, PaymentStatus, Prisma } from '../../generated/prisma/client';

type PaynetResult<T> = { result: T } | { error: { code: number; message: string } };

interface CheckPerformParams {
  amount: number;
  account: { order_id: string };
}
interface CreateParams extends CheckPerformParams {
  id: string;
  time: number;
}

const PAYNET_ERROR = {
  INVALID_AMOUNT: -31001,
  TRANSACTION_NOT_FOUND: -31003,
  CANNOT_PERFORM: -31008,
  ACCOUNT_ERROR: -31050,
} as const;

/**
 * Mirrors PaymeService's JSON-RPC shape exactly — see this plan's Global
 * Constraints on why, and the caveat that Paynet's real field names/error
 * codes need verification against live docs before production use.
 */
@Injectable()
export class PaynetService {
  constructor(private readonly prisma: PrismaService) {}

  private amountMismatch(orderTotal: Prisma.Decimal, amountTiyin: number): boolean {
    return toTiyin(orderTotal.toNumber()) !== amountTiyin;
  }

  async checkPerformTransaction(params: CheckPerformParams): Promise<PaynetResult<{ allow: true }>> {
    const order = await this.prisma.order.findUnique({ where: { id: params.account.order_id } });
    if (!order) {
      return { error: { code: PAYNET_ERROR.ACCOUNT_ERROR, message: 'Order not found' } };
    }
    if (this.amountMismatch(order.total, params.amount)) {
      return { error: { code: PAYNET_ERROR.INVALID_AMOUNT, message: 'Invalid amount' } };
    }
    return { result: { allow: true } };
  }

  async createTransaction(
    params: CreateParams,
  ): Promise<PaynetResult<{ create_time: number; transaction: string; state: number }>> {
    const order = await this.prisma.order.findUnique({ where: { id: params.account.order_id } });
    if (!order) {
      return { error: { code: PAYNET_ERROR.ACCOUNT_ERROR, message: 'Order not found' } };
    }

    const existing = await this.prisma.payment.findFirst({ where: { provider: 'paynet', transactionId: params.id } });
    if (existing) {
      return { result: { create_time: Number(existing.providerCreateTime), transaction: existing.id, state: 1 } };
    }

    const created = await this.prisma.payment.create({
      data: {
        orderId: order.id,
        amount: order.total,
        method: PaymentMethod.PAYNET,
        status: PaymentStatus.PENDING,
        provider: 'paynet',
        transactionId: params.id,
        providerCreateTime: BigInt(params.time),
      },
    });

    return { result: { create_time: Number(created.providerCreateTime), transaction: created.id, state: 1 } };
  }

  async performTransaction(
    params: { id: string },
  ): Promise<PaynetResult<{ transaction: string; perform_time: number; state: number }>> {
    const payment = await this.prisma.payment.findFirst({ where: { provider: 'paynet', transactionId: params.id } });
    if (!payment) {
      return { error: { code: PAYNET_ERROR.TRANSACTION_NOT_FOUND, message: 'Transaction not found' } };
    }
    if (payment.status !== PaymentStatus.PENDING) {
      return { error: { code: PAYNET_ERROR.CANNOT_PERFORM, message: 'Cannot perform' } };
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.COMPLETED, paidAt: new Date() },
      });
      await recomputeOrderPaymentStatus(tx, payment.orderId);
      return result;
    });

    return { result: { transaction: updated.id, perform_time: updated.paidAt!.getTime(), state: 2 } };
  }

  async cancelTransaction(
    params: { id: string; reason: number },
  ): Promise<PaynetResult<{ transaction: string; cancel_time: number; state: number }>> {
    const payment = await this.prisma.payment.findFirst({ where: { provider: 'paynet', transactionId: params.id } });
    if (!payment) {
      return { error: { code: PAYNET_ERROR.TRANSACTION_NOT_FOUND, message: 'Transaction not found' } };
    }

    const nextStatus = payment.status === PaymentStatus.COMPLETED ? PaymentStatus.REFUNDED : PaymentStatus.FAILED;
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.payment.update({
        where: { id: payment.id },
        data: { status: nextStatus, cancelledAt: new Date(), cancelReason: params.reason },
      });
      await recomputeOrderPaymentStatus(tx, payment.orderId);
      return result;
    });

    return { result: { transaction: updated.id, cancel_time: updated.cancelledAt!.getTime(), state: nextStatus === PaymentStatus.REFUNDED ? -2 : -1 } };
  }

  async checkTransaction(params: { id: string }): Promise<PaynetResult<{
    create_time: number; perform_time: number; cancel_time: number; transaction: string; state: number; reason: number | null;
  }>> {
    const payment = await this.prisma.payment.findFirst({ where: { provider: 'paynet', transactionId: params.id } });
    if (!payment) {
      return { error: { code: PAYNET_ERROR.TRANSACTION_NOT_FOUND, message: 'Transaction not found' } };
    }
    return {
      result: {
        create_time: Number(payment.providerCreateTime ?? 0),
        perform_time: payment.paidAt?.getTime() ?? 0,
        cancel_time: payment.cancelledAt?.getTime() ?? 0,
        transaction: payment.id,
        state: payment.status === 'COMPLETED' ? 2 : payment.status === 'PENDING' ? 1 : -1,
        reason: payment.cancelReason,
      },
    };
  }
}
```

- [ ] **Step 8: Run it to verify it passes**

Run: `cd backend && npx jest src/paynet/paynet.service.spec.ts`
Expected: PASS.

- [ ] **Step 9: Implement the auth guard, controller, and module**

Create `backend/src/paynet/paynet-auth.guard.ts` — copy `backend/src/payme/payme-auth.guard.ts` verbatim, renaming `PaymeAuthGuard` to `PaynetAuthGuard` and `PAYME_MERCHANT_KEY` to `PAYNET_SECRET_KEY`.

Create `backend/src/paynet/paynet.controller.ts` — copy `backend/src/payme/payme.controller.ts` verbatim, renaming `PaymeController`/`PaymeService`/`PaymeAuthGuard` to `PaynetController`/`PaynetService`/`PaynetAuthGuard` and the route from `'payme'` to `'paynet'`.

Create `backend/src/paynet/paynet.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { PaynetController } from './paynet.controller';
import { PaynetService } from './paynet.service';

@Module({
  controllers: [PaynetController],
  providers: [PaynetService],
})
export class PaynetModule {}
```

- [ ] **Step 10: Register the module**

In `backend/src/app.module.ts`, add `import { PaynetModule } from './paynet/paynet.module';` and `PaynetModule,` right after `ClickModule,`.

- [ ] **Step 11: Document the env vars**

In `backend/.env.example`, add near the `CLICK_*` entries:

```
# Paynet merchant credentials — module structure mirrors Payme's; verify the
# real field/error shape against Paynet's own docs before production use
# (see the plan this was built from). Left blank, checkoutUrl stays null.
PAYNET_MERCHANT_ID=""
PAYNET_SECRET_KEY=""
```

- [ ] **Step 12: Verify the build**

Run: `cd backend && npx tsc --noEmit && npm run lint && npx jest`
Expected: all exit 0 / all pass.

- [ ] **Step 13: Commit**

```bash
git add backend/src/paynet backend/src/app.module.ts backend/.env.example
git commit -m "feat(backend): add the Paynet payment gateway module, mirroring Payme's JSON-RPC shape"
```

---

### Task 18: `CheckoutService.createOrder` — wire the CLICK and PAYNET branches

**Files:**
- Modify: `backend/src/checkout/checkout.service.ts`
- Modify: `backend/src/checkout/checkout.service.spec.ts`

**Interfaces:**
- Consumes: Task 16's `buildClickCheckoutUrl`, Task 17's `buildPaynetCheckoutUrl`.
- Produces: `dto.paymentMethod === 'CLICK'`/`'PAYNET'` now build a `Payment` row and (env vars permitting) a `checkoutUrl`, completing the branch chain Task 6 left as a comment.

- [ ] **Step 1: Add the failing tests**

Append to `backend/src/checkout/checkout.service.spec.ts`, inside the existing `describe('CheckoutService.createOrder', ...)` block:

```ts
  it('builds a Click checkoutUrl when CLICK_MERCHANT_ID and CLICK_SERVICE_ID are both set', async () => {
    const { cartsService, customersService, ordersService, prisma, getCart, productFindMany, orderCreate } = makeDeps();
    getCart.mockResolvedValue({ items: [{ productId: 'p1', quantity: 1 }] });
    productFindMany.mockResolvedValue([{ id: 'p1', sku: 'SKU-1', nameEn: 'Filter', isActive: true, price: new Prisma.Decimal(100) }]);
    orderCreate.mockResolvedValue({ id: 'ord-1', orderNumber: 'DP-1001', total: new Prisma.Decimal(100) });
    const clickConfig = {
      get: jest.fn((key: string) => (key === 'CLICK_MERCHANT_ID' ? 'merch-1' : key === 'CLICK_SERVICE_ID' ? 'svc-1' : undefined)),
    } as unknown as ConfigService;

    const service = new CheckoutService(prisma, cartsService, customersService, ordersService, clickConfig);
    const result = await service.createOrder('998901234567', baseDto({ paymentMethod: 'CLICK' }));

    expect(result.checkoutUrl).toContain('my.click.uz');
  });

  it('leaves checkoutUrl null for CLICK when the env vars are unset', async () => {
    const { cartsService, customersService, ordersService, prisma, getCart, productFindMany, orderCreate } = makeDeps();
    getCart.mockResolvedValue({ items: [{ productId: 'p1', quantity: 1 }] });
    productFindMany.mockResolvedValue([{ id: 'p1', sku: 'SKU-1', nameEn: 'Filter', isActive: true, price: new Prisma.Decimal(100) }]);
    orderCreate.mockResolvedValue({ id: 'ord-1', orderNumber: 'DP-1001', total: new Prisma.Decimal(100) });

    const service = new CheckoutService(prisma, cartsService, customersService, ordersService, config);
    const result = await service.createOrder('998901234567', baseDto({ paymentMethod: 'CLICK' }));

    expect(result.checkoutUrl).toBeNull();
  });

  it('builds a Paynet checkoutUrl when PAYNET_MERCHANT_ID is set', async () => {
    const { cartsService, customersService, ordersService, prisma, getCart, productFindMany, orderCreate } = makeDeps();
    getCart.mockResolvedValue({ items: [{ productId: 'p1', quantity: 1 }] });
    productFindMany.mockResolvedValue([{ id: 'p1', sku: 'SKU-1', nameEn: 'Filter', isActive: true, price: new Prisma.Decimal(100) }]);
    orderCreate.mockResolvedValue({ id: 'ord-1', orderNumber: 'DP-1001', total: new Prisma.Decimal(100) });
    const paynetConfig = { get: jest.fn().mockReturnValue('merch-1') } as unknown as ConfigService;

    const service = new CheckoutService(prisma, cartsService, customersService, ordersService, paynetConfig);
    const result = await service.createOrder('998901234567', baseDto({ paymentMethod: 'PAYNET' }));

    expect(result.checkoutUrl).toContain('checkout.paynet.uz');
  });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd backend && npx jest src/checkout/checkout.service.spec.ts`
Expected: FAIL — `createOrder` has no `else if (dto.paymentMethod === 'CLICK' ...)` branch yet.

- [ ] **Step 3: Implement**

In `backend/src/checkout/checkout.service.ts`, add the imports:

```ts
import { buildClickCheckoutUrl } from '../click/click-money';
import { buildPaynetCheckoutUrl } from '../paynet/paynet-money';
```

Replace the comment block Task 6 left (`// CLICK/PAYNET: Task 18 adds...`) — insert these two branches between the existing `else if (dto.paymentMethod === 'CASH') { ... }` block and the final `return { order, checkoutUrl };`:

```ts
    } else if (dto.paymentMethod === 'CLICK') {
      await this.prisma.payment.create({
        data: { orderId: order.id, amount: total, method: PaymentMethod.CLICK, status: PaymentStatus.PENDING, provider: 'click' },
      });
      const merchantId = this.config?.get<string>('CLICK_MERCHANT_ID');
      const serviceId = this.config?.get<string>('CLICK_SERVICE_ID');
      if (merchantId && serviceId) {
        checkoutUrl = buildClickCheckoutUrl({
          merchantId,
          serviceId,
          orderId: order.id,
          amount: toTiyin(total),
          returnUrl: dto.returnBaseUrl ? `${dto.returnBaseUrl}/checkout/status/${order.id}` : undefined,
        });
      }
    } else if (dto.paymentMethod === 'PAYNET') {
      await this.prisma.payment.create({
        data: { orderId: order.id, amount: total, method: PaymentMethod.PAYNET, status: PaymentStatus.PENDING, provider: 'paynet' },
      });
      const merchantId = this.config?.get<string>('PAYNET_MERCHANT_ID');
      if (merchantId) {
        checkoutUrl = buildPaynetCheckoutUrl({ merchantId, orderId: order.id, amount: total.toNumber() });
      }
    }
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd backend && npx jest src/checkout/checkout.service.spec.ts`
Expected: PASS.

- [ ] **Step 5: Verify the build**

Run: `cd backend && npx tsc --noEmit && npm run lint`
Expected: both exit 0.

- [ ] **Step 6: Commit**

```bash
git add backend/src/checkout/checkout.service.ts backend/src/checkout/checkout.service.spec.ts
git commit -m "feat(backend): wire Click and Paynet checkoutUrl building into CheckoutService"
```

---

### Task 19: Frontend — enable the Click/Cash/Paynet radio rows

**Files:**
- Modify: `components/store/checkout-details-form.tsx`

**Interfaces:**
- Consumes: Task 5's widened `paymentMethod` union (`checkoutPaymentMethodSchema`).
- Produces: the payment-method `RadioGroup` becomes a real, controlled field (`Controller` over `paymentMethod`, matching the existing `deliveryMethod` pattern in the same file) instead of a fixed `value="ONLINE"` display-only group with two `disabled` rows.

- [ ] **Step 1: Edit the component**

Replace the payment card's `RadioGroup` block:

```tsx
          <RadioGroup name="paymentMethodDisplay" value="ONLINE" onValueChange={() => {}}>
            <RadioGroupItem
              value="ONLINE"
              label={dict.paymentOnlineLabel}
              description={dict.paymentOnlineDescription}
            />
            <RadioGroupItem value="CASH" label={dict.paymentCashLabel} description={dict.paymentCashDescription} disabled />
            <RadioGroupItem value="CARD" label={dict.paymentCardLabel} description={dict.paymentCardDescription} disabled />
          </RadioGroup>
          <input type="hidden" value="ONLINE" {...register("paymentMethod")} />
```

with:

```tsx
          <Controller
            control={control}
            name="paymentMethod"
            render={({ field }) => (
              <RadioGroup name={field.name} value={field.value ?? "ONLINE"} onValueChange={field.onChange}>
                <RadioGroupItem value="ONLINE" label={dict.paymentOnlineLabel} description={dict.paymentOnlineDescription} />
                <RadioGroupItem value="CLICK" label={dict.paymentClickLabel} description={dict.paymentClickDescription} />
                <RadioGroupItem value="PAYNET" label={dict.paymentPaynetLabel} description={dict.paymentPaynetDescription} />
                <RadioGroupItem value="CASH" label={dict.paymentCashLabel} description={dict.paymentCashDescription} />
              </RadioGroup>
            )}
          />
          {checkoutFieldError(dict, errors.paymentMethod?.message) ? (
            <p role="alert" className="text-sm text-danger">
              {checkoutFieldError(dict, errors.paymentMethod?.message)}
            </p>
          ) : null}
```

Add `paymentMethod: "ONLINE"` stays as the `defaultValues` entry (unchanged from before — it just now drives a real control instead of a hidden input).

- [ ] **Step 2: Add the new dictionary keys**

`dict.checkout.paymentClickLabel`/`paymentClickDescription`/`paymentPaynetLabel`/`paymentPaynetDescription` in `dictionaries/en.json`, `ru.json`, `uz.json`, matching the existing `paymentOnlineLabel`/`paymentCashLabel` style. `paymentCardLabel`/`paymentCardDescription` are no longer read (CARD was never a real checkout option, only ever a disabled placeholder row) — leave the keys in the dictionary; removing unused keys is a separate cleanup this task does not need.

- [ ] **Step 3: Manual check**

Run: `npm run dev`, open `/checkout`, confirm all four payment rows are selectable (no `disabled` state left), and that submitting with each one reaches the right backend branch (Click/Paynet will show `checkoutUrl: null` until real credentials are configured — confirmed via the network tab, not a visible redirect).

- [ ] **Step 4: Verify the build**

Run: `npx tsc --noEmit && npm run lint && npm test && npm run build`
Expected: all exit 0 / all pass.

- [ ] **Step 5: Commit**

```bash
git add components/store/checkout-details-form.tsx
git commit -m "feat(checkout): enable Click, Paynet, and Cash as real payment method choices"
```

---

## Bosqich 5 — Quote request completion (root)

### Task 20: `CheckoutDetailsForm` — a fifth "So'rov yuborish" choice that skips payment

**Files:**
- Modify: `components/store/checkout-details-form.tsx`

**Interfaces:**
- Consumes: Task 5's `requestQuote` field on `checkoutRequestSchema`.
- Produces: the payment-method radio group gains a fifth, mutually-exclusive row. Choosing it sets `requestQuote: true` and clears `paymentMethod`; choosing any of the other four does the reverse. `CheckoutClient.placeOrder` (Task 21) reads `values.requestQuote` to pick the right success copy.

- [ ] **Step 1: Edit the component**

Replace the `Controller`-driven `RadioGroup` from Task 19 with a version that also coordinates `requestQuote`:

```tsx
          <RadioGroup
            name="paymentMethod"
            value={requestQuote ? "QUOTE" : (watchedPaymentMethod ?? "ONLINE")}
            onValueChange={(next) => {
              if (next === "QUOTE") {
                setValue("requestQuote", true, { shouldValidate: true });
                setValue("paymentMethod", undefined, { shouldValidate: true });
                return;
              }
              setValue("requestQuote", false, { shouldValidate: true });
              setValue("paymentMethod", next as "ONLINE" | "CASH" | "CLICK" | "PAYNET", { shouldValidate: true });
            }}
          >
            <RadioGroupItem value="ONLINE" label={dict.paymentOnlineLabel} description={dict.paymentOnlineDescription} />
            <RadioGroupItem value="CLICK" label={dict.paymentClickLabel} description={dict.paymentClickDescription} />
            <RadioGroupItem value="PAYNET" label={dict.paymentPaynetLabel} description={dict.paymentPaynetDescription} />
            <RadioGroupItem value="CASH" label={dict.paymentCashLabel} description={dict.paymentCashDescription} />
            <RadioGroupItem value="QUOTE" label={dict.paymentQuoteLabel} description={dict.paymentQuoteDescription} />
          </RadioGroup>
          {checkoutFieldError(dict, errors.paymentMethod?.message) ? (
            <p role="alert" className="text-sm text-danger">
              {checkoutFieldError(dict, errors.paymentMethod?.message)}
            </p>
          ) : null}
```

This replaces the `Controller` wrapper entirely (both `paymentMethod` and `requestQuote` are now driven by plain `setValue` calls from one radio group, since a `Controller` only coordinates a single field). Add the two watched values alongside the existing `pinLatitude`/`pinLongitude`/`pinAddressText` watches:

```tsx
  const watchedPaymentMethod = useWatch({ control, name: "paymentMethod" });
  const requestQuote = useWatch({ control, name: "requestQuote" });
```

Add `requestQuote: false` to `useForm`'s `defaultValues`.

The terms checkbox and submit button stay visible either way — a quote request still needs the shopper's consent and the same submit affordance; only the payment-specific `Payment` row is skipped server-side (Task 6).

- [ ] **Step 2: Add the new dictionary keys**

`dict.checkout.paymentQuoteLabel`/`paymentQuoteDescription` in all three dictionaries, same pattern as Task 19's new keys.

- [ ] **Step 3: Manual check**

Run: `npm run dev`, open `/checkout`, choose "So'rov yuborish", submit, and confirm the request succeeds with no redirect to a payment gateway (Task 21 makes the success screen read correctly).

- [ ] **Step 4: Verify the build**

Run: `npx tsc --noEmit && npm run lint && npm test && npm run build`
Expected: all exit 0 / all pass.

- [ ] **Step 5: Commit**

```bash
git add components/store/checkout-details-form.tsx
git commit -m "feat(checkout): add a payment-free quote-request option"
```

---

### Task 21: `checkout-client.tsx` — quote/cash-specific success copy

**Files:**
- Modify: `components/store/checkout-client.tsx`

**Interfaces:**
- Consumes: `values.requestQuote` from `CheckoutDetailsForm`'s `onSubmit` payload (already flowing through `placeOrder`'s `values: CheckoutRequestInput` parameter — no new prop needed).
- Produces: the existing success `Card` shows a distinct message for a quote request ("so'rovingiz qabul qilindi, tez orada bog'lanamiz" in spirit) versus a normal paid/cash order, instead of always showing `dict.successPendingText`.

- [ ] **Step 1: Edit the component**

Add a `wasQuote` state alongside the existing `orderNumber` state:

```tsx
  const [wasQuote, setWasQuote] = useState(false);
```

In `placeOrder`, set it right before the try block resolves successfully — after `cart.clear()` and the `checkoutUrl` early-return, right where `setOrderNumber`/`setStatus("success")` are called:

```tsx
      cart.clear();

      if (checkoutUrl) {
        redirectTo(checkoutUrl);
        return;
      }

      setWasQuote(values.requestQuote === true);
      setOrderNumber(getOrderNumber(order));
      setStatus("success");
```

In the success-state JSX, replace the single `<p>` with a branch on `wasQuote`:

```tsx
          <p className="mt-2 max-w-md type-body text-muted">
            {wasQuote
              ? dict.successQuoteText
              : orderNumber
                ? dict.successPendingText.replace("{orderNumber}", orderNumber)
                : dict.successPendingText.replace("#{orderNumber} ", "")}
          </p>
```

- [ ] **Step 2: Add the dictionary key**

`dict.checkout.successQuoteText` in all three dictionaries — e.g. uz: `"So'rovingiz qabul qilindi. Tez orada operatorlarimiz siz bilan bog'lanadi."`

- [ ] **Step 3: Manual check**

Run: `npm run dev`, submit a quote request and confirm the quote-specific message renders; submit a cash order and confirm the normal order-number message still renders (cash orders are not quotes — `wasQuote` stays `false` for them).

- [ ] **Step 4: Verify the build**

Run: `npx tsc --noEmit && npm run lint && npm test && npm run build`
Expected: all exit 0 / all pass.

- [ ] **Step 5: Commit**

```bash
git add components/store/checkout-client.tsx
git commit -m "feat(checkout): show quote-specific copy on the success screen"
```

---

## Bosqich 6 — Seller panel visibility

### Task 22: `OrdersService.findAll` — a seller's own list also shows self-checkout orders

**Files:**
- Modify: `backend/src/orders/orders.service.ts`
- Modify: `backend/src/orders/orders.service.spec.ts` (create if it does not already exist — check first)

**Interfaces:**
- Consumes: `getOrCreateHouseSeller` (`backend/src/checkout/house-seller.ts`, unchanged — a plain function, not a DI provider, so importing it across modules needs no module wiring).
- Produces: `findAll`'s `SELLER`-role filter matches `{ sellerId: { in: [actor.sellerId, houseSellerId] } }` instead of a bare `actor.sellerId` — every self-checkout order (Payme, Click, Paynet, Cash, and pending quotes, all created under the internal house-seller account per `house-seller.ts`) becomes visible to every seller, not just to whichever `MANAGER_UP` role currently sees the unfiltered list. This is the fix Global Constraints flags: today no `SELLER`-role account can see a self-checkout order at all.

- [ ] **Step 1: Check for an existing spec file**

Run: `ls backend/src/orders/orders.service.spec.ts 2>&1 || echo "missing"`

- [ ] **Step 2: Write the failing test**

If the file exists, add this `describe` block; if not, create it with this content (adjust the mock shape to match any existing file's conventions if one is found — the shape below follows `checkout.service.spec.ts`'s `makePrisma` pattern):

```ts
import { OrdersService } from './orders.service';
import { InventoryService } from '../inventory/inventory.service';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '../../generated/prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';

jest.mock('../checkout/house-seller', () => ({
  getOrCreateHouseSeller: jest.fn().mockResolvedValue({ id: 'house-1' }),
}));

function makeDeps() {
  const findMany = jest.fn().mockResolvedValue([]);
  const count = jest.fn().mockResolvedValue(0);
  const prisma = {
    order: { findMany, count },
    $transaction: jest.fn((ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
  } as unknown as PrismaService;
  const inventory = {} as InventoryService;
  return { prisma, inventory, findMany };
}

describe('OrdersService.findAll', () => {
  it("includes both the seller's own orders and the house-seller's self-checkout orders for a SELLER actor", async () => {
    const { prisma, inventory, findMany } = makeDeps();
    const service = new OrdersService(prisma, inventory);
    const actor: AuthenticatedUser = { id: 'u1', phone: '998901234567', role: Role.SELLER, sellerId: 'seller-1' };

    await service.findAll(actor, {});

    const where = findMany.mock.calls[0][0].where;
    expect(where.sellerId).toEqual({ in: ['seller-1', 'house-1'] });
  });

  it('leaves the filter untouched for a MANAGER_UP actor (unfiltered list, unchanged behavior)', async () => {
    const { prisma, inventory, findMany } = makeDeps();
    const service = new OrdersService(prisma, inventory);
    const actor: AuthenticatedUser = { id: 'u1', phone: '998901234567', role: Role.DIRECTOR, sellerId: null };

    await service.findAll(actor, {});

    expect(findMany.mock.calls[0][0].where.sellerId).toBeUndefined();
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `cd backend && npx jest src/orders/orders.service.spec.ts`
Expected: FAIL — `where.sellerId` is currently a bare string, not `{ in: [...] }`.

- [ ] **Step 4: Implement**

In `backend/src/orders/orders.service.ts`, add the import:

```ts
import { getOrCreateHouseSeller } from '../checkout/house-seller';
```

Replace the `findAll` method's actor-scoping block:

```ts
    const where: Prisma.OrderWhereInput = {};
    if (actor.role === Role.SELLER) {
      if (!actor.sellerId)
        throw new ForbiddenException('This account has no seller profile');
      where.sellerId = actor.sellerId;
    }
```

with:

```ts
    const where: Prisma.OrderWhereInput = {};
    if (actor.role === Role.SELLER) {
      if (!actor.sellerId)
        throw new ForbiddenException('This account has no seller profile');
      const houseSeller = await getOrCreateHouseSeller(this.prisma);
      where.sellerId = { in: [actor.sellerId, houseSeller.id] };
    }
```

- [ ] **Step 5: Run it to verify it passes**

Run: `cd backend && npx jest src/orders/orders.service.spec.ts`
Expected: PASS.

- [ ] **Step 6: Verify the build**

Run: `cd backend && npx tsc --noEmit && npm run lint && npx jest`
Expected: all exit 0 / all pass.

- [ ] **Step 7: Commit**

```bash
git add backend/src/orders/orders.service.ts backend/src/orders/orders.service.spec.ts
git commit -m "fix(backend): let every seller see self-checkout orders, not just an unfiltered manager view"
```

---

### Task 23: `lib/api/seller-panel/types.ts` + `order-status-labels.ts` — `PENDING_REVIEW`, `CLICK`/`PAYNET`, nullable warehouse

**Files:**
- Modify: `lib/api/seller-panel/types.ts`
- Modify: `lib/seller/order-status-labels.ts`

**Interfaces:**
- Produces: `OrderStatus` gains `"PENDING_REVIEW"`; `ORDER_STATUS_TRANSITIONS` gains a `PENDING_REVIEW: ["NEW", "CANCELLED"]` entry; `PaymentMethod` gains `"CLICK" | "PAYNET"`; `Order.warehouseId: string | null` and `Order.warehouse: OrderWarehouse | null` (both were non-null before, which does not match `backend/`'s actual nullable `Order.warehouseId` for self-checkout orders — a pre-existing type/reality mismatch this task also fixes, load-bearing for Task 25). `ORDER_STATUS_LABEL`/`ORDER_STATUS_TONE` gain a `PENDING_REVIEW` entry.

- [ ] **Step 1: Edit `types.ts`**

Replace:

```ts
export type OrderStatus = "NEW" | "CONFIRMED" | "PREPARING" | "COMPLETED" | "CANCELLED";
export type OrderPaymentStatus = "UNPAID" | "PARTIAL" | "PAID";
export type PaymentMethod = "CASH" | "CARD" | "TRANSFER" | "ONLINE";
```

with:

```ts
export type OrderStatus = "PENDING_REVIEW" | "NEW" | "CONFIRMED" | "PREPARING" | "COMPLETED" | "CANCELLED";
export type OrderPaymentStatus = "UNPAID" | "PARTIAL" | "PAID";
export type PaymentMethod = "CASH" | "CARD" | "TRANSFER" | "ONLINE" | "CLICK" | "PAYNET";
```

Replace:

```ts
/** NEW -> CONFIRMED -> PREPARING -> COMPLETED, CANCELLED reachable up until COMPLETED. Mirrors backend/src/orders/order-status-transitions.ts. */
export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  NEW: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PREPARING", "CANCELLED"],
  PREPARING: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};
```

with:

```ts
/**
 * PENDING_REVIEW -> NEW | CANCELLED is the quote-request lifecycle; NEW ->
 * CONFIRMED -> PREPARING -> COMPLETED is the normal one, CANCELLED reachable
 * up until COMPLETED. Mirrors backend/src/orders/order-status-transitions.ts.
 */
export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING_REVIEW: ["NEW", "CANCELLED"],
  NEW: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PREPARING", "CANCELLED"],
  PREPARING: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};
```

Replace the `Order` interface's `warehouseId`/`warehouse` fields:

```ts
  warehouseId: string;
  warehouse: OrderWarehouse;
```

with:

```ts
  /** Null for a self-checkout order until a staff member resolves one — see house-seller.ts's doc-comment. */
  warehouseId: string | null;
  warehouse: OrderWarehouse | null;
```

- [ ] **Step 2: Run the existing types test**

Run: `npx vitest run lib/api/seller-panel/types.test.ts`
Expected: PASS (this file only tests pure helpers like `canTransitionOrderStatus` — confirm no case in it hardcodes the old `OrderStatus`/`PaymentMethod` unions in a way that now fails; if one does, extend it the same way Task 2's `order-status-transitions.spec.ts` was extended).

- [ ] **Step 3: Edit `order-status-labels.ts`**

Replace the full contents of `lib/seller/order-status-labels.ts`:

```ts
import type { OrderStatus } from "@/lib/api/seller-panel/types";

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING_REVIEW: "So'rov",
  NEW: "Yangi",
  CONFIRMED: "Tasdiqlangan",
  PREPARING: "Tayyorlanmoqda",
  COMPLETED: "Bajarildi",
  CANCELLED: "Bekor qilindi",
};

export const ORDER_STATUS_TONE: Record<OrderStatus, "neutral" | "accent" | "success" | "danger" | "info"> = {
  PENDING_REVIEW: "accent",
  NEW: "neutral",
  CONFIRMED: "info",
  PREPARING: "accent",
  COMPLETED: "success",
  CANCELLED: "danger",
};
```

- [ ] **Step 4: Verify the build**

Run: `npx tsc --noEmit && npm run lint && npm test && npm run build`
Expected: all exit 0 / all pass. TypeScript will surface every place that reads `order.warehouse.name` without a null check (at least `app/seller/(panel)/orders/[id]/page.tsx`) — Task 25 fixes it; if `tsc` finds others, note them for that task too.

- [ ] **Step 5: Commit**

```bash
git add lib/api/seller-panel/types.ts lib/seller/order-status-labels.ts
git commit -m "feat(seller-panel): add PENDING_REVIEW/Click/Paynet types, fix warehouse's nullability"
```

---

### Task 24: Seller-panel payment actions — mark a cash order paid, approve/decline a quote

**Files:**
- Create: `lib/api/seller-panel/payments.ts`
- Create: `hooks/seller/mutations/use-mark-cash-paid.ts`
- Create: `hooks/seller/mutations/use-approve-quote.ts`

**Interfaces:**
- Consumes: `sellerApiRequest` (`lib/api/seller-panel/client.ts`, unchanged); `useSellerMutation`/`sellerKeys` (unchanged); the already-existing `POST /payments` (`backend/src/payments/payments.controller.ts`, unchanged — `CreatePaymentDto` already accepts `method: 'CASH'` once Task 1's Prisma enum change lands, since `CreatePaymentDto.method` is `@IsEnum(PaymentMethod)` and `CASH` was already a member even before this plan) and `PATCH /seller/orders/:id/status` (unchanged, already used by `useUpdateOrderStatus`).
- Produces: `markCashPaid(orderId, amount)`; `useMarkCashPaid()`; `useApproveQuote()` (a thin wrapper over the existing `updateOrderStatus(id, 'NEW')`, named for what a seller is doing rather than the raw status transition — `useUpdateOrderStatus` already covers decline via `'CANCELLED'`, so no separate decline hook is needed).

- [ ] **Step 1: Implement `payments.ts`**

Create `lib/api/seller-panel/payments.ts`:

```ts
import { sellerApiRequest } from "./client";
import type { Payment } from "./types";

export interface CreatePaymentInput {
  orderId: string;
  amount: number;
  method: "CASH" | "CARD" | "TRANSFER" | "ONLINE" | "CLICK" | "PAYNET";
}

export function createPayment(input: CreatePaymentInput): Promise<Payment> {
  return sellerApiRequest<Payment>("/payments", { method: "POST", body: input });
}
```

- [ ] **Step 2: Implement `use-mark-cash-paid.ts`**

Create `hooks/seller/mutations/use-mark-cash-paid.ts`:

```ts
"use client";

import { sellerKeys } from "../keys";
import { useSellerMutation } from "../use-seller-mutation";
import { createPayment } from "@/lib/api/seller-panel/payments";
import type { Payment } from "@/lib/api/seller-panel/types";

/** Records a cash payment for an order already carrying a PENDING cash Payment row from checkout — see CheckoutService.createOrder's CASH branch. */
export function useMarkCashPaid() {
  return useSellerMutation<{ orderId: string; amount: number }, Payment>({
    run: ({ orderId, amount }) => createPayment({ orderId, amount, method: "CASH" }),
    invalidates: [sellerKeys.orders.all, sellerKeys.dashboard.all],
    success: "To'lov qabul qilindi deb belgilandi",
    failure: "To'lovni belgilab bo'lmadi",
  });
}
```

- [ ] **Step 3: Implement `use-approve-quote.ts`**

Create `hooks/seller/mutations/use-approve-quote.ts`:

```ts
"use client";

import { sellerKeys } from "../keys";
import { useSellerMutation } from "../use-seller-mutation";
import { updateOrderStatus } from "@/lib/api/seller-panel/orders";
import type { Order } from "@/lib/api/seller-panel/types";

/** Moves a PENDING_REVIEW quote request to NEW — the same PATCH /seller/orders/:id/status endpoint useUpdateOrderStatus already calls, named for the seller-facing action rather than the raw transition. Declining reuses the existing useCancelOrder hook (CANCELLED is already a legal PENDING_REVIEW transition — see order-status-transitions.ts). */
export function useApproveQuote() {
  return useSellerMutation<{ id: string }, Order>({
    run: ({ id }) => updateOrderStatus(id, "NEW"),
    invalidates: [sellerKeys.orders.all, sellerKeys.dashboard.all],
    success: "So'rov tasdiqlandi",
    failure: "So'rovni tasdiqlab bo'lmadi",
  });
}
```

- [ ] **Step 4: Verify the build**

Run: `npx tsc --noEmit && npm run lint && npm test && npm run build`
Expected: all exit 0 / all pass. No unit test for these three files — they are thin wrappers over already-tested primitives (`sellerApiRequest`, `useSellerMutation`), the same convention every other file under `hooks/seller/mutations/*` already follows (confirm via `ls hooks/seller/mutations/*.test.ts` — none exist).

- [ ] **Step 5: Commit**

```bash
git add lib/api/seller-panel/payments.ts hooks/seller/mutations/use-mark-cash-paid.ts hooks/seller/mutations/use-approve-quote.ts
git commit -m "feat(seller-panel): add mark-cash-paid and approve-quote actions"
```

---

### Task 25: Seller order detail page — null-safe warehouse, quote approve/decline, cash mark-paid; orders list "So'rov" tab

**Files:**
- Modify: `app/seller/(panel)/orders/[id]/page.tsx`
- Modify: `components/seller/order-status.tsx`
- Modify: `app/seller/(panel)/orders/page.tsx`

**Interfaces:**
- Consumes: Task 24's `useMarkCashPaid`/`useApproveQuote`; Task 22's fixed `findAll` visibility; Task 23's nullable `warehouse` type.
- Produces: the order detail page no longer crashes on a self-checkout order; a `PENDING_REVIEW` order shows approve/decline buttons instead of the linear stepper; a `CASH`-paid, still-`UNPAID` order shows a "Naqd pul qabul qilindi" button; the orders list gains a "So'rov" status tab.

- [ ] **Step 1: Fix the warehouse crash**

In `app/seller/(panel)/orders/[id]/page.tsx`, replace:

```tsx
        <div className="rounded-md border border-border bg-surface p-4">
          <p className="seller-eyebrow mb-2">Ombor</p>
          <p className="text-sm text-foreground">{order.warehouse.name}</p>
        </div>
```

with:

```tsx
        <div className="rounded-md border border-border bg-surface p-4">
          <p className="seller-eyebrow mb-2">Ombor</p>
          <p className="text-sm text-foreground">{order.warehouse?.name ?? "Hali tayinlanmagan"}</p>
        </div>
```

- [ ] **Step 2: Add the cash "mark as paid" action**

In the same file, add the import and render a button when relevant. Add:

```tsx
import { useMarkCashPaid } from "@/hooks/seller/mutations/use-mark-cash-paid";
```

Inside `SellerOrderDetailPage`, add the hook call alongside the existing `useOrder`:

```tsx
  const markCashPaid = useMarkCashPaid();
```

Right after the `<OrderStatusStepper order={order} />` block, add:

```tsx
      {order.paymentStatus === "UNPAID" && order.payments.some((payment) => payment.method === "CASH") ? (
        <div className="rounded-md border border-border bg-surface p-4">
          <Button
            size="sm"
            loading={markCashPaid.isPending}
            onClick={() => markCashPaid.mutate({ orderId: order.id, amount: Number(order.total) })}
          >
            Naqd pul qabul qilindi
          </Button>
        </div>
      ) : null}
```

Add `import { Button } from "@/components/seller/ui/button";` if not already imported.

- [ ] **Step 3: Add `PENDING_REVIEW` approve/decline to the stepper**

In `components/seller/order-status.tsx`, add the import:

```tsx
import { useApproveQuote } from "@/hooks/seller/mutations/use-approve-quote";
```

Add a branch right after the existing `if (order.status === "CANCELLED") { ... }` early return:

```tsx
  const approveQuote = useApproveQuote();

  if (order.status === "PENDING_REVIEW") {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 rounded-md border border-accent bg-accent-subtle px-4 py-3 text-sm text-foreground">
          Bu — narx/mavjudlikni tasdiqlash kutilayotgan so'rov
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" loading={approveQuote.isPending} onClick={() => approveQuote.mutate({ id: order.id })}>
            Tasdiqlash
          </Button>
          <Button
            variant="danger"
            size="sm"
            loading={cancelOrder.isPending}
            onClick={() => cancelOrder.mutate({ id: order.id })}
          >
            Rad etish
          </Button>
        </div>
      </div>
    );
  }
```

(`cancelOrder` is already declared earlier in the same function via the existing `const cancelOrder = useCancelOrder();` line — this new branch just needs to sit after both `updateStatus`/`cancelOrder` are declared and before the existing `CANCELLED` check, or after it; either position works since the conditions are mutually exclusive. Place it immediately after the `CANCELLED` early return for readability.)

- [ ] **Step 4: Add the "So'rov" tab to the orders list**

In `app/seller/(panel)/orders/page.tsx`, add a tab to `STATUS_TABS`:

```tsx
const STATUS_TABS: { value: OrderStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "Barchasi" },
  { value: "PENDING_REVIEW", label: ORDER_STATUS_LABEL.PENDING_REVIEW },
  { value: "NEW", label: ORDER_STATUS_LABEL.NEW },
  { value: "CONFIRMED", label: ORDER_STATUS_LABEL.CONFIRMED },
  { value: "PREPARING", label: ORDER_STATUS_LABEL.PREPARING },
  { value: "COMPLETED", label: ORDER_STATUS_LABEL.COMPLETED },
  { value: "CANCELLED", label: ORDER_STATUS_LABEL.CANCELLED },
];
```

- [ ] **Step 5: Manual check**

Run: `npm run dev`. Sign in to the seller panel as a real SELLER-role account. Place a quote request, a cash order, and a Payme order from the storefront (a different browser/private window, signed in as a customer). Confirm all three now appear in `/seller/orders` (including via the new "So'rov" tab for the quote), the detail page no longer crashes, "Tasdiqlash"/"Rad etish" work on the quote, and "Naqd pul qabul qilindi" moves the cash order's payment status to PAID.

- [ ] **Step 6: Verify the build**

Run: `npx tsc --noEmit && npm run lint && npm test && npm run build`
Expected: all exit 0 / all pass.

- [ ] **Step 7: Commit**

```bash
git add app/seller/\(panel\)/orders components/seller/order-status.tsx
git commit -m "feat(seller-panel): make self-checkout orders visible and actionable — quote approve/decline, cash mark-paid, warehouse null-safety"
```

---

## Self-Review Notes

- **Spec coverage:** Auth gate (Bosqich 2, Tasks 9-11) ✓. B2B field removal (Task 9) ✓. Yandex Maps (Bosqich 3) ✓. Three order/payment types — Quote (Tasks 6, 20-21, 25), Online/Click/Paynet (Tasks 6, 16-19), Cash (Tasks 6, 24-25) ✓. `/account/orders` real list (Task 8) ✓. Director/seller panel integration — scoped to seller panel only, with the reasoning recorded in Global Constraints and repeated in this plan's own summary to the user, since director-panel integration would be the scope-creep architecture change CLAUDE.md's autonomous-decision rule requires flagging rather than deciding silently.
- **Env vars documented:** `YANDEX_MAPS_API_KEY` (Task 14, as `NEXT_PUBLIC_YANDEX_MAPS_API_KEY` — must be public for a browser-loaded Maps JS API key), `CLICK_MERCHANT_ID`/`CLICK_SERVICE_ID`/`CLICK_SECRET_KEY` (Task 16), `PAYNET_MERCHANT_ID`/`PAYNET_SECRET_KEY` (Task 17) — every gateway module follows the same "blank env var -> null checkoutUrl" pattern Payme already established, confirmed task-by-task above.
- **TDD convention:** every backend service change has a Jest spec written and run red before the implementation (Tasks 2-7, 15-18, 22); DTO conditional-validation changes get the narrow class-validator spec exception the prior plan already established (Task 4); root composite/Radix-driven components stay untested per the existing convention, confirmed explicitly in each such task (Tasks 9, 10, 13) rather than assumed silently.
