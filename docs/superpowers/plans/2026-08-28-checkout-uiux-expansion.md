# Checkout Customer/Delivery/Terms + UI Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `backend/`'s checkout endpoint to capture the fields a real order needs — customer name/contact, optional B2B company/tax id, pickup-vs-delivery with a structured address, and terms acceptance — then rebuild the storefront's `/checkout` page around those fields with a proper form, a mobile summary sheet, and a Payme payment-result page.

**Architecture:** Two phases. **Bosqich 1 (backend)** extends `CreateCheckoutDto`/`CheckoutService`/the `Customer` and `Order` Prisma models to accept and persist the new fields, adds a phone-scoped `GET /checkout/orders/:id` status endpoint the payment-result page polls, and wires an optional `returnBaseUrl` through to Payme's checkout link so a paying customer lands back on that status page instead of nowhere. The last task of Bosqich 1 is root-side plumbing (the Zod mirror of the DTO, a new proxy route) that Bosqich 2's form needs already in place. **Bosqich 2 (frontend)** rebuilds `components/store/checkout-client.tsx` around a new `CheckoutDetailsForm` (React Hook Form + Zod, matching `ProfileDetailsModal`'s established shape), extracts the order-summary block so a new mobile bottom sheet (modeled on `FilterDrawer`) and the existing desktop card can share it without duplicating markup, and adds `/checkout/status/[orderId]` — one page with three render states (processing/success/failed) rather than three separate routes, because Payme's redirect carries no documented, trustworthy success/failure signal of its own; the truth only ever comes from polling the new status endpoint, so a page that starts in "processing" and resolves via polling is the accurate design, not a guess about Payme's redirect contract.

Both shadcn/ui *and* this project's own hand-rolled `components/ui/*` primitives (`Card`, `FormField`, `Select`, `Checkbox`/`CheckboxField`, `RadioGroup`, `Textarea`, `Alert`, `Separator`) already exist and are what the storefront (as opposed to the director panel, which uses the real shadcn CLI output under `components/ui/shadcn/`) is built from — **no shadcn install step is needed**; every new piece of UI in this plan is built from the existing `components/ui/*` set, the same way `checkout-client.tsx`, `cart-client.tsx` and `profile-details-modal.tsx` already are.

No separate `CheckoutHeader` component: `app/(site)/checkout/page.tsx` already renders the page's `<h1>{dict.checkout.title}</h1>`/subtitle above `<CheckoutClient>` (untouched by this plan) — extracting that into its own component would be a pure rename with no behavior change, so it is left as-is rather than added as a task.

**Tech Stack:** NestJS 11, Prisma ORM 7, class-validator DTOs — `backend/`. Next.js 16 App Router, React Hook Form 7 + `@hookform/resolvers` + Zod 4, Radix Dialog + `motion` for the sheet — root. Jest (`backend/`) / Vitest + Testing Library (root).

**Spec:** User's instruction this turn, translated into two phases (see the message this plan answers). Payment methods stay ONLINE-only — cash/card/bank-transfer are explicitly out of scope and shown, at most, as disabled "coming soon" rows. `deliveryFee` stays hardcoded at `0` (see `checkout.service.ts`'s existing comment) — no promo/discount system is added. The customer is identified only by their OTP-verified phone; there is no separate login. Continues `docs/superpowers/plans/2026-08-27-checkout-order-payme.md`, which built the `Order`/`Payme` foundation this plan extends — every file path, test convention (service specs only, no controller specs), and `makePrisma` mock shape below matches that plan's precedent exactly.

## Global Constraints

- `whitelist: true, forbidNonWhitelisted: true` is set globally in `backend/src/main.ts`'s `ValidationPipe` — every new `CreateCheckoutDto` field **must** carry a `class-validator` decorator or the field is silently stripped before the service ever sees it.
- `Customer.phone` is free text and not unique (see the schema's own doc-comment) — every lookup goes through `extractNationalDigits`/`phoneTail` from `backend/src/common/phone.ts`, never a SQL `equals`. This applies to the new `CheckoutService.getOrderStatus` ownership check exactly as it already applies to `CustomersService.findOrCreateByPhone`.
- No controller spec files exist anywhere in this codebase (confirmed this session, same finding the prior plan recorded) — services get Jest specs, controllers stay untested directly. The one exception this plan makes is `create-checkout.dto.spec.ts` (Task 3): the DTO's `@ValidateIf`-driven conditional validation is real branching logic with no other test surface (NestJS's `ValidationPipe` runs before the controller method body, so a service spec cannot exercise it), so it gets a small `class-validator`-level spec using `plainToInstance`/`validate` directly — a narrow, deliberate addition to the convention, not a new blanket rule.
- Root has an existing convention of **no component test** for a composite store client component wired to `useCart`/`useResolvedProducts`/axios (`cart-client.tsx` and the current `checkout-client.tsx` both have none) — verified instead via `npm run dev` in the browser. This plan keeps that convention for `CheckoutClient` itself (Task 10) and `CheckoutSummarySheet` (Task 11, matching `FilterDrawer`, which also has no test), but every new piece of *pure* logic this plan introduces — the Zod schema, the error-code mapper, the self-contained `CheckoutDetailsForm`, `resolvePhase` — gets a real Vitest + Testing Library spec, because those pieces have no dependency on network/store wiring and dropping their tests would just be dropping coverage for no reason.
- Money leaving this system for Payme stays exactly as the prior plan built it: `deliveryFee` is always `0`, computed server-side, never accepted from a caller. Nothing in this plan changes that.
- Run `cd backend && npx tsc --noEmit && npm run lint && npx jest` after every backend-touching task, and at the root `npx tsc --noEmit && npm run lint && npm test && npm run build` after every root-touching task.
- Do not touch `app/(seller-auth)/`, `app/seller/**`, `components/seller/**`, `hooks/seller/**`, `lib/seller/**`, `lib/api/seller-panel/**`, `lib/store/seller-auth-store.ts`, or the director panel's `components/ui/shadcn/*`/`components/director/*`.
- Before final styling on any Bosqich 2 task, consult the `frontend-design` skill — the user asked for this explicitly. This plan's JSX is functionally complete but keep the skill's guidance (spacing, the orange `#F05A28`/`#FF6B2C` accent, dark-minimalist tone) in mind while implementing rather than treating the snippets below as final pixels.

---

## File Structure

| File | Responsibility |
|---|---|
| `backend/prisma/schema.prisma` | New `DeliveryMethod` enum; `Order` gains `deliveryMethod`/`deliveryCity`/`deliveryDistrict`/`deliveryStreet`/`deliveryNotes`; `Customer` gains `taxId`. |
| `backend/src/customers/customers.service.ts` | `findOrCreateByPhone` takes a details object (`name`/`email`/`company`/`taxId`) instead of a bare `name` string; non-destructive backfill on an existing match. |
| `backend/src/checkout/dto/create-checkout.dto.ts` | New fields: `firstName`, `lastName`, `email?`, `companyName?`, `taxId?`, `deliveryMethod`, `city?`/`district?`/`street?` (required when `deliveryMethod === 'DELIVERY'`), `deliveryNotes?`, `termsAccepted`, `returnBaseUrl?`. |
| `backend/src/checkout/checkout.service.ts` | `createOrder` wires the new fields into `Customer`/`Order`; new `getOrderStatus(phone, orderId)` for the payment-result page; Payme `returnUrl` built from `dto.returnBaseUrl`. |
| `backend/src/checkout/checkout.controller.ts` | New `GET orders/:id` route. |
| `lib/schemas.ts` (root) | `checkoutRequestSchema` extended to mirror the DTO exactly, as the Zod resolver `CheckoutDetailsForm` uses directly. |
| `app/api/v1/checkout/route.ts` | Adds `returnBaseUrl: process.env.NEXT_PUBLIC_SITE_URL` before forwarding to `backend/` — no other change (the schema import already carries the new fields through). |
| `app/api/v1/checkout/orders/[orderId]/route.ts` (new) | Proxies `GET` order-status polling. |
| `dictionaries/en.json`, `ru.json`, `uz.json` | ~30 new `checkout.*` keys. |
| `lib/store/checkout-error-text.ts` (new) | Zod error-code → dictionary sentence, same split as `lib/account/error-text.ts`. |
| `components/store/checkout-details-form.tsx` (new) | Customer info, delivery method + conditional address, order note, payment section, terms checkbox — self-contained `<form>`, submitted remotely. |
| `components/store/checkout-order-summary.tsx` (new) | The line-count/total block, extracted so the desktop card and the mobile sheet render the same numbers from one place. |
| `components/store/checkout-client.tsx` | Rewritten to compose `CheckoutDetailsForm` + `CheckoutOrderSummary`, prefill name from the existing local `Profile` store, send the full validated payload. |
| `components/store/checkout-summary-sheet.tsx` (new) | Mobile-only sticky bottom bar + bottom sheet, modeled on `components/product/filter-drawer.tsx`. |
| `components/store/checkout-status-client.tsx` (new) | Polls the new status endpoint; renders processing/success/failed. |
| `app/(site)/checkout/status/[orderId]/page.tsx` (new) | Server wrapper for the status page. |

---

## Bosqich 1 — Backend (`backend/`)

### Task 1: Prisma schema — delivery fields and `Customer.taxId`

**Files:**
- Modify: `backend/prisma/schema.prisma`

**Interfaces:**
- Produces: `DeliveryMethod` enum (`PICKUP`/`DELIVERY`); `Order.deliveryMethod` (default `PICKUP`), `Order.deliveryCity`/`deliveryDistrict`/`deliveryStreet`/`deliveryNotes` (all nullable); `Customer.taxId` (nullable). Task 4's `CheckoutService` and Task 3's `CreateCheckoutDto` are the consumers.

- [ ] **Step 1: Add the enum**

In `backend/prisma/schema.prisma`, immediately after the existing `enum PaymentStatus { ... }` block, add:

```prisma
enum DeliveryMethod {
  PICKUP
  DELIVERY
}
```

- [ ] **Step 2: Extend `Customer`**

Modify the `Customer` model — insert `taxId` right after `company` (every other line, including the two existing doc-comments on the model and on `phone`, is untouched):

```prisma
  company          String?
  /// INN — the Uzbek taxpayer id, for a B2B checkout's invoice. Free text,
  /// not format-checked: it varies by entity type and this project has no
  /// authoritative check-digit table today.
  taxId            String?  @map("tax_id")
  telegram         String?
```

- [ ] **Step 3: Extend `Order`**

Modify the `Order` model — insert the five new fields right after `deliveryFee` and before `discountRequestedPercent`:

```prisma
  deliveryFee              Decimal            @default(0) @map("delivery_fee") @db.Decimal(14, 2)
  /// Self-checkout only: PICKUP needs no address; DELIVERY requires
  /// city/district/street, enforced in CreateCheckoutDto (not at the DB
  /// level, so a CRM-raised order — created through OrdersService.create,
  /// not CheckoutService — is unaffected and simply keeps the PICKUP
  /// default with every address column null).
  deliveryMethod           DeliveryMethod     @default(PICKUP) @map("delivery_method")
  deliveryCity             String?            @map("delivery_city")
  deliveryDistrict         String?            @map("delivery_district")
  deliveryStreet           String?            @map("delivery_street")
  /// Free-text delivery guidance (entrance, floor, landmark) — distinct
  /// from `notes`, which is the order's general comment.
  deliveryNotes            String?            @map("delivery_notes")
  /// Percent the seller asked for (CRM flow). Within their User.discountLimit
  /// it applies immediately; above it, a DiscountRequest gates approval.
  discountRequestedPercent Decimal            @default(0) @map("discount_requested_percent") @db.Decimal(5, 2)
```

(Only `deliveryFee` gains the five new lines after it — everything from `discountRequestedPercent` on down, and every other field in `Order`, stays exactly as it was.)

- [ ] **Step 4: Migrate**

Run: `cd backend && npx prisma migrate dev --name checkout_customer_delivery_fields`
Expected: applies cleanly against your local dev database (confirm `backend/.env`'s `DATABASE_URL` is your local/dev database, never production — see that file's own warning banner). Purely additive (new nullable columns + one new enum-typed column with a default), so this should not require the interactive confirmation an enum *narrowing* needs.

- [ ] **Step 5: Regenerate and verify**

Run: `cd backend && npx prisma generate && npx tsc --noEmit`
Expected: both exit 0.

- [ ] **Step 6: Commit**

```bash
git add backend/prisma
git commit -m "feat(backend): add Order delivery fields and Customer.taxId for checkout"
```

---

### Task 2: `CustomersService.findOrCreateByPhone` — details object, non-destructive backfill

**Files:**
- Modify: `backend/src/customers/customers.service.ts`
- Modify: `backend/src/customers/customers.service.spec.ts`

**Interfaces:**
- Produces: `findOrCreateByPhone(phone: string, details?: { name?: string; email?: string; company?: string; taxId?: string }): Promise<Customer>`. Task 4's `CheckoutService` is the only consumer (confirmed via grep this session — no other call site exists).

- [ ] **Step 1: Rewrite the failing/changed tests**

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
  it('creates a new customer with every detail given', async () => {
    const create = jest.fn().mockResolvedValue({
      id: 'cus-1',
      phone: '998901234567',
      name: 'Aziz Karimov',
    });
    const prisma = makePrisma({
      customer: { findMany: jest.fn().mockResolvedValue([]), create },
    });
    const service = new CustomersService(prisma);

    const result = await service.findOrCreateByPhone('998901234567', {
      name: 'Aziz Karimov',
      email: 'aziz@example.com',
      company: 'Aziz LLC',
      taxId: '123456789',
    });

    expect(create).toHaveBeenCalledWith({
      data: {
        phone: '998901234567',
        name: 'Aziz Karimov',
        email: 'aziz@example.com',
        company: 'Aziz LLC',
        taxId: '123456789',
      },
    });
    expect(result).toEqual({
      id: 'cus-1',
      phone: '998901234567',
      name: 'Aziz Karimov',
    });
  });

  it('defaults the name to "Checkout" when none is given for a new customer', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'cus-2' });
    const prisma = makePrisma({
      customer: { findMany: jest.fn().mockResolvedValue([]), create },
    });
    const service = new CustomersService(prisma);

    await service.findOrCreateByPhone('998901234567');

    expect(create).toHaveBeenCalledWith({
      data: {
        phone: '998901234567',
        name: 'Checkout',
        email: undefined,
        company: undefined,
        taxId: undefined,
      },
    });
  });

  it('reuses an existing customer matched on canonical digits, and touches nothing when nothing changed', async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        id: 'cus-1',
        phone: '+998 90 123-45-67',
        name: 'Existing',
        email: 'e@x.com',
        company: 'X',
        taxId: '1',
      },
    ]);
    const update = jest.fn();
    const prisma = makePrisma({ customer: { findMany, update } });
    const service = new CustomersService(prisma);

    const result = await service.findOrCreateByPhone('998901234567', {
      name: 'Existing',
      email: 'e@x.com',
      company: 'X',
      taxId: '1',
    });

    expect(update).not.toHaveBeenCalled();
    expect(result.id).toBe('cus-1');
  });

  it('overwrites the name on an existing customer when it differs', async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        id: 'cus-1',
        phone: '998901234567',
        name: 'Checkout',
        email: null,
        company: null,
        taxId: null,
      },
    ]);
    const update = jest.fn().mockResolvedValue({ id: 'cus-1', name: 'Aziz Karimov' });
    const prisma = makePrisma({ customer: { findMany, update } });
    const service = new CustomersService(prisma);

    await service.findOrCreateByPhone('998901234567', { name: 'Aziz Karimov' });

    expect(update).toHaveBeenCalledWith({
      where: { id: 'cus-1' },
      data: { name: 'Aziz Karimov' },
    });
  });

  it('backfills email/company/taxId only when the existing column is null', async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        id: 'cus-1',
        phone: '998901234567',
        name: 'Aziz',
        email: null,
        company: 'Old LLC',
        taxId: null,
      },
    ]);
    const update = jest.fn().mockResolvedValue({ id: 'cus-1' });
    const prisma = makePrisma({ customer: { findMany, update } });
    const service = new CustomersService(prisma);

    await service.findOrCreateByPhone('998901234567', {
      name: 'Aziz',
      email: 'aziz@example.com',
      company: 'New LLC',
      taxId: '999',
    });

    expect(update).toHaveBeenCalledWith({
      where: { id: 'cus-1' },
      data: { name: 'Aziz', email: 'aziz@example.com', taxId: '999' },
    });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd backend && npx jest src/customers/customers.service.spec.ts`
Expected: FAIL — the current implementation's second parameter is a bare `name?: string`, not a details object, so every call site above sends the wrong shape and every assertion on `.create`/`.update`'s exact `data` mismatches.

- [ ] **Step 3: Implement**

In `backend/src/customers/customers.service.ts`, replace the existing `findOrCreateByPhone` method with:

```ts
  /**
   * A checkout customer identified only by an OTP-verified phone — no
   * Customer row exists yet unless they have ordered before. Matched on
   * canonical digits, same scan pattern the (removed) root app used:
   * Customer.phone is free text (a seller may have typed it with different
   * formatting), so no SQL `equals` can find it — the `contains` prefilter
   * below narrows to roughly one row in a hundred before the exact
   * comparison runs in JS.
   *
   * For an existing match: `name` overwrites whenever the checkout's name
   * differs from what is on file (checkout now always collects a real name
   * — see CreateCheckoutDto — so it is the most up-to-date value available).
   * `email`/`company`/`taxId` only backfill a currently-null column, so a
   * repeat checkout can never clobber data a seller already curated on the
   * CRM side.
   */
  async findOrCreateByPhone(
    phone: string,
    details?: { name?: string; email?: string; company?: string; taxId?: string },
  ) {
    const national = extractNationalDigits(phone);
    const candidates = await this.prisma.customer.findMany({
      where: { phone: { contains: phoneTail(national) } },
      take: 1000,
    });
    const existing = candidates.find(
      (candidate) => extractNationalDigits(candidate.phone) === national,
    );

    if (existing) {
      const patch: Record<string, string> = {};
      if (details?.name && details.name !== existing.name) {
        patch.name = details.name;
      }
      if (details?.email && !existing.email) {
        patch.email = details.email;
      }
      if (details?.company && !existing.company) {
        patch.company = details.company;
      }
      if (details?.taxId && !existing.taxId) {
        patch.taxId = details.taxId;
      }

      if (Object.keys(patch).length === 0) {
        return existing;
      }
      return this.prisma.customer.update({ where: { id: existing.id }, data: patch });
    }

    return this.prisma.customer.create({
      data: {
        phone,
        name: details?.name ?? 'Checkout',
        email: details?.email,
        company: details?.company,
        taxId: details?.taxId,
      },
    });
  }
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd backend && npx jest src/customers/customers.service.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/customers
git commit -m "feat(backend): extend CustomersService.findOrCreateByPhone for checkout's customer/company fields"
```

---

### Task 3: `CreateCheckoutDto` — customer, delivery, terms fields

**Files:**
- Modify: `backend/src/checkout/dto/create-checkout.dto.ts`
- Create: `backend/src/checkout/dto/create-checkout.dto.spec.ts`

**Interfaces:**
- Produces: `CreateCheckoutDto` gains `firstName: string`, `lastName: string`, `email?: string`, `companyName?: string`, `taxId?: string`, `deliveryMethod: 'PICKUP' | 'DELIVERY'`, `city?: string`, `district?: string`, `street?: string` (all three required exactly when `deliveryMethod === 'DELIVERY'`), `deliveryNotes?: string`, `termsAccepted: boolean` (must be `true`). `notes`/`paymentMethod` are unchanged. Task 4's `CheckoutService` and Task 6's `returnBaseUrl` addition both consume this.

- [ ] **Step 1: Write the failing DTO spec**

Create `backend/src/checkout/dto/create-checkout.dto.spec.ts`:

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

describe('CreateCheckoutDto validation', () => {
  it('accepts a minimal pickup order', async () => {
    const dto = plainToInstance(CreateCheckoutDto, basePayload);
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('requires city, district, and street once deliveryMethod is DELIVERY', async () => {
    const dto = plainToInstance(CreateCheckoutDto, {
      ...basePayload,
      deliveryMethod: 'DELIVERY',
    });
    const errors = await validate(dto);
    const fields = errors.map((error) => error.property).sort();
    expect(fields).toEqual(['city', 'district', 'street']);
  });

  it('passes once DELIVERY carries a full address', async () => {
    const dto = plainToInstance(CreateCheckoutDto, {
      ...basePayload,
      deliveryMethod: 'DELIVERY',
      city: 'Toshkent',
      district: 'Chilonzor',
      street: 'Bunyodkor 12',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('does not require an address for PICKUP even if deliveryMethod flips back', async () => {
    const dto = plainToInstance(CreateCheckoutDto, { ...basePayload, deliveryMethod: 'PICKUP' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects termsAccepted: false', async () => {
    const dto = plainToInstance(CreateCheckoutDto, { ...basePayload, termsAccepted: false });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'termsAccepted')).toBe(true);
  });

  it('rejects a malformed email when one is provided', async () => {
    const dto = plainToInstance(CreateCheckoutDto, { ...basePayload, email: 'not-an-email' });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'email')).toBe(true);
  });

  it('accepts an order with no email at all', async () => {
    const dto = plainToInstance(CreateCheckoutDto, basePayload);
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'email')).toBe(false);
  });

  it('rejects an empty firstName', async () => {
    const dto = plainToInstance(CreateCheckoutDto, { ...basePayload, firstName: '' });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'firstName')).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd backend && npx jest src/checkout/dto/create-checkout.dto.spec.ts`
Expected: FAIL — none of the new fields exist on the DTO yet, so every case that depends on them either throws or asserts against behavior that isn't there (e.g. `firstName`/`lastName`/`deliveryMethod`/`termsAccepted` are simply absent).

- [ ] **Step 3: Implement**

Replace the full contents of `backend/src/checkout/dto/create-checkout.dto.ts`:

```ts
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

/** True exactly when the DTO under validation chose home delivery. */
function isDelivery(dto: CreateCheckoutDto): boolean {
  return dto.deliveryMethod === 'DELIVERY';
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

  @IsOptional()
  @IsEmail()
  email?: string;

  /** B2B-only, both optional — a self-checkout order is a retail sale by default. */
  @IsOptional()
  @IsString()
  @MaxLength(160)
  companyName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  taxId?: string;

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

  /** Entrance/floor/landmark guidance — distinct from `notes` below. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  deliveryNotes?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  /** Must be literally `true` — `IsIn([true])` is how class-validator spells
   *  "this exact value or fail" (see the DTO spec's `termsAccepted: false` case). */
  @IsIn([true])
  termsAccepted: boolean;

  /**
   * Only ONLINE is handled today. Accepting the field (rather than assuming
   * it) means BANK_TRANSFER/QUOTE reaching this endpoint fail loudly with a
   * clear 400 instead of silently creating an order with no way to pay it —
   * those two paths are their own future plan.
   */
  @IsIn(['ONLINE'])
  paymentMethod: 'ONLINE';

  /**
   * The storefront's own origin (`NEXT_PUBLIC_SITE_URL`), sent by the Next.js
   * proxy route rather than typed by hand — see checkout.service.ts's
   * `returnUrl` construction. `require_tld: false` so `http://localhost:3000`
   * validates in local dev.
   */
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
git commit -m "feat(backend): extend CreateCheckoutDto with customer, delivery, and terms fields"
```

---

### Task 4: `CheckoutService.createOrder` — wire the new fields

**Files:**
- Modify: `backend/src/checkout/checkout.service.ts`
- Modify: `backend/src/checkout/checkout.service.spec.ts`

**Interfaces:**
- Consumes: Task 2's `CustomersService.findOrCreateByPhone(phone, details)`, Task 3's extended `CreateCheckoutDto`.
- Produces: `Order.create`'s `data` now includes `deliveryMethod`/`deliveryCity`/`deliveryDistrict`/`deliveryStreet`/`deliveryNotes`; `Customer` is resolved with the checkout's name/email/company/taxId. `getOrderStatus`/`returnBaseUrl` are **not** in this task — see Tasks 5 and 6.

- [ ] **Step 1: Update the failing test**

In `backend/src/checkout/checkout.service.spec.ts`, change the payload every `createOrder` call sends (both the empty-cart case and the two others) from `{ paymentMethod: 'ONLINE' }` to a full payload, and add assertions on the new `Order.create` fields and the `findOrCreateByPhone` call shape. Replace the full file:

```ts
import { BadRequestException } from '@nestjs/common';
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
  const customersService = {
    findOrCreateByPhone,
  } as unknown as CustomersService;

  const reserveOrderNumber = jest.fn().mockResolvedValue('DP-1001');
  const ordersService = { reserveOrderNumber } as unknown as OrdersService;

  const productFindMany = jest.fn();
  const orderCreate = jest.fn();
  const orderFindUnique = jest.fn();
  const paymentCreate = jest.fn();
  const prisma = {
    product: { findMany: productFindMany },
    order: { create: orderCreate, findUnique: orderFindUnique },
    user: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ id: 'u1', seller: { id: 'house-1' } }),
    },
    payment: { create: paymentCreate },
    $transaction: jest.fn((fn: (tx: unknown) => unknown) => fn(prisma)),
  } as unknown as PrismaService;

  return {
    cartsService,
    customersService,
    ordersService,
    prisma,
    getCart,
    clear,
    findOrCreateByPhone,
    productFindMany,
    orderCreate,
    orderFindUnique,
  };
}

describe('CheckoutService.createOrder', () => {
  it('rejects an empty cart', async () => {
    const { cartsService, customersService, ordersService, prisma, getCart } =
      makeDeps();
    getCart.mockResolvedValue({ items: [] });
    const service = new CheckoutService(
      prisma,
      cartsService,
      customersService,
      ordersService,
    );

    await expect(service.createOrder('998901234567', baseDto())).rejects.toThrow(
      BadRequestException,
    );
  });

  it('builds a PICKUP order, snapshotting price/sku/name, and resolves the customer by name/email/company/taxId', async () => {
    const {
      cartsService,
      customersService,
      ordersService,
      prisma,
      getCart,
      clear,
      findOrCreateByPhone,
      productFindMany,
      orderCreate,
    } = makeDeps();
    getCart.mockResolvedValue({
      items: [{ productId: 'p1', quantity: 2 }],
    });
    productFindMany.mockResolvedValue([
      {
        id: 'p1',
        sku: 'SKU-1',
        nameEn: 'Filter',
        isActive: true,
        price: new Prisma.Decimal(100),
      },
    ]);
    orderCreate.mockResolvedValue({
      id: 'ord-1',
      orderNumber: 'DP-1001',
      total: new Prisma.Decimal(200),
    });

    const service = new CheckoutService(
      prisma,
      cartsService,
      customersService,
      ordersService,
    );
    const result = await service.createOrder(
      '998901234567',
      baseDto({ email: 'aziz@example.com', companyName: 'Aziz LLC', taxId: '123' }),
    );

    expect(findOrCreateByPhone).toHaveBeenCalledWith('998901234567', {
      name: 'Aziz Karimov',
      email: 'aziz@example.com',
      company: 'Aziz LLC',
      taxId: '123',
    });

    const callArgs = orderCreate.mock.calls[0][0];
    expect(callArgs.data.orderNumber).toBe('DP-1001');
    expect(callArgs.data.customerId).toBe('cus-1');
    expect(callArgs.data.sellerId).toBe('house-1');
    expect(callArgs.data.warehouseId).toBeNull();
    expect(callArgs.data.deliveryMethod).toBe('PICKUP');
    expect(callArgs.data.deliveryCity).toBeNull();
    expect(callArgs.data.deliveryDistrict).toBeNull();
    expect(callArgs.data.deliveryStreet).toBeNull();
    expect(callArgs.data.items.create).toHaveLength(1);
    expect(callArgs.data.items.create[0]).toMatchObject({
      productId: 'p1',
      productSku: 'SKU-1',
      productName: 'Filter',
      quantity: 2,
    });

    expect(clear).toHaveBeenCalledWith('998901234567');
    expect(result.order.id).toBe('ord-1');
  });

  it('stores the structured address for a DELIVERY order', async () => {
    const { cartsService, customersService, ordersService, prisma, getCart, productFindMany, orderCreate } =
      makeDeps();
    getCart.mockResolvedValue({ items: [{ productId: 'p1', quantity: 1 }] });
    productFindMany.mockResolvedValue([
      { id: 'p1', sku: 'SKU-1', nameEn: 'Filter', isActive: true, price: new Prisma.Decimal(100) },
    ]);
    orderCreate.mockResolvedValue({ id: 'ord-1', orderNumber: 'DP-1001', total: new Prisma.Decimal(100) });

    const service = new CheckoutService(prisma, cartsService, customersService, ordersService);
    await service.createOrder(
      '998901234567',
      baseDto({
        deliveryMethod: 'DELIVERY',
        city: 'Toshkent',
        district: 'Chilonzor',
        street: 'Bunyodkor 12',
        deliveryNotes: '3-qavat',
      }),
    );

    const callArgs = orderCreate.mock.calls[0][0];
    expect(callArgs.data.deliveryMethod).toBe('DELIVERY');
    expect(callArgs.data.deliveryCity).toBe('Toshkent');
    expect(callArgs.data.deliveryDistrict).toBe('Chilonzor');
    expect(callArgs.data.deliveryStreet).toBe('Bunyodkor 12');
    expect(callArgs.data.deliveryNotes).toBe('3-qavat');
  });

  it('rejects when a cart line references a retired or missing product', async () => {
    const { cartsService, customersService, ordersService, prisma, getCart, productFindMany } =
      makeDeps();
    getCart.mockResolvedValue({
      items: [{ productId: 'p1', quantity: 1 }],
    });
    productFindMany.mockResolvedValue([]);

    const service = new CheckoutService(
      prisma,
      cartsService,
      customersService,
      ordersService,
    );

    await expect(
      service.createOrder('998901234567', baseDto()),
    ).rejects.toThrow(BadRequestException);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd backend && npx jest src/checkout/checkout.service.spec.ts`
Expected: FAIL — `createOrder` still calls `findOrCreateByPhone(phone)` with no details, and `Order.create`'s `data` has no delivery fields.

- [ ] **Step 3: Implement**

In `backend/src/checkout/checkout.service.ts`, change the `createOrder` method body. Replace:

```ts
    const [customer, houseSeller, lines, orderNumber] = await Promise.all([
      this.customers.findOrCreateByPhone(phone),
      getOrCreateHouseSeller(this.prisma),
      this.buildLines(cart.items),
      this.orders.reserveOrderNumber(),
    ]);
```

with:

```ts
    const fullName = `${dto.firstName.trim()} ${dto.lastName.trim()}`.trim();

    const [customer, houseSeller, lines, orderNumber] = await Promise.all([
      this.customers.findOrCreateByPhone(phone, {
        name: fullName,
        email: dto.email,
        company: dto.companyName,
        taxId: dto.taxId,
      }),
      getOrCreateHouseSeller(this.prisma),
      this.buildLines(cart.items),
      this.orders.reserveOrderNumber(),
    ]);
```

and replace the `this.prisma.order.create({ data: { ... } })` call's `data` object:

```ts
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
        deliveryMethod: dto.deliveryMethod,
        deliveryCity: dto.deliveryMethod === 'DELIVERY' ? (dto.city ?? null) : null,
        deliveryDistrict: dto.deliveryMethod === 'DELIVERY' ? (dto.district ?? null) : null,
        deliveryStreet: dto.deliveryMethod === 'DELIVERY' ? (dto.street ?? null) : null,
        deliveryNotes: dto.deliveryNotes?.trim() || null,
        items: {
          create: lines.map(({ price, total: lineTotal, ...rest }) => ({
            ...rest,
            price,
            total: lineTotal,
          })),
        },
      },
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
git commit -m "feat(backend): wire checkout's customer/delivery fields into Customer and Order"
```

---

### Task 5: `CheckoutService.getOrderStatus` + `GET /checkout/orders/:id`

**Files:**
- Modify: `backend/src/checkout/checkout.service.ts`
- Modify: `backend/src/checkout/checkout.service.spec.ts`
- Modify: `backend/src/checkout/checkout.controller.ts`

**Interfaces:**
- Produces: `CheckoutService.getOrderStatus(phone: string, orderId: string): Promise<{ orderNumber: string; status: OrderStatus; paymentStatus: OrderPaymentStatus; latestPaymentStatus: PaymentStatus | null }>`, throwing `NotFoundException` for a missing order **or** one that does not belong to the calling phone (never distinguished in the response — a caller must not learn an order id exists for someone else). `GET /checkout/orders/:id`, guarded exactly like `POST /checkout` (`InternalServiceGuard` + `@VerifiedPhone()`). Task 12's `CheckoutStatusClient` (via Task 7's proxy route) is the consumer.

- [ ] **Step 1: Add the failing tests**

In `backend/src/checkout/checkout.service.spec.ts`, add `NotFoundException` to the existing `@nestjs/common` import and append this `describe` block at the end of the file (after the last existing one):

```ts
import { BadRequestException, NotFoundException } from '@nestjs/common';
```

```ts
describe('CheckoutService.getOrderStatus', () => {
  it("returns the caller's own order status, including the latest payment", async () => {
    const { cartsService, customersService, ordersService, prisma, orderFindUnique } = makeDeps();
    orderFindUnique.mockResolvedValue({
      orderNumber: 'DP-1001',
      status: 'NEW',
      paymentStatus: 'UNPAID',
      customer: { phone: '+998 90 123-45-67' },
      payments: [{ status: 'PENDING' }],
    });
    const service = new CheckoutService(prisma, cartsService, customersService, ordersService);

    const result = await service.getOrderStatus('998901234567', 'ord-1');

    expect(result).toEqual({
      orderNumber: 'DP-1001',
      status: 'NEW',
      paymentStatus: 'UNPAID',
      latestPaymentStatus: 'PENDING',
    });
  });

  it('answers null latestPaymentStatus when the order has no payment yet', async () => {
    const { cartsService, customersService, ordersService, prisma, orderFindUnique } = makeDeps();
    orderFindUnique.mockResolvedValue({
      orderNumber: 'DP-1001',
      status: 'DRAFT',
      paymentStatus: 'UNPAID',
      customer: { phone: '998901234567' },
      payments: [],
    });
    const service = new CheckoutService(prisma, cartsService, customersService, ordersService);

    const result = await service.getOrderStatus('998901234567', 'ord-1');

    expect(result.latestPaymentStatus).toBeNull();
  });

  it('throws NotFoundException for an order that does not exist', async () => {
    const { cartsService, customersService, ordersService, prisma, orderFindUnique } = makeDeps();
    orderFindUnique.mockResolvedValue(null);
    const service = new CheckoutService(prisma, cartsService, customersService, ordersService);

    await expect(service.getOrderStatus('998901234567', 'missing')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('throws NotFoundException when the order belongs to a different phone', async () => {
    const { cartsService, customersService, ordersService, prisma, orderFindUnique } = makeDeps();
    orderFindUnique.mockResolvedValue({
      orderNumber: 'DP-1001',
      status: 'NEW',
      paymentStatus: 'UNPAID',
      customer: { phone: '998911111111' },
      payments: [],
    });
    const service = new CheckoutService(prisma, cartsService, customersService, ordersService);

    await expect(service.getOrderStatus('998901234567', 'ord-1')).rejects.toThrow(
      NotFoundException,
    );
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd backend && npx jest src/checkout/checkout.service.spec.ts`
Expected: FAIL — `getOrderStatus` does not exist yet.

- [ ] **Step 3: Implement**

In `backend/src/checkout/checkout.service.ts`, add to the imports:

```ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { extractNationalDigits } from '../common/phone';
```

and add this method to the `CheckoutService` class (after `createOrder`):

```ts
  /**
   * The payment-result page's polling target. Ownership is checked on
   * canonical phone digits — same rule as CustomersService.findOrCreateByPhone
   * — and a mismatch answers identically to a missing order, so a caller can
   * never learn that *some* order exists at an id that is not theirs.
   */
  async getOrderStatus(phone: string, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
        payments: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
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
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd backend && npx jest src/checkout/checkout.service.spec.ts`
Expected: PASS.

- [ ] **Step 5: Add the controller route**

In `backend/src/checkout/checkout.controller.ts`, replace the full file:

```ts
import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
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

  @Get('orders/:id')
  getStatus(@VerifiedPhone() phone: string, @Param('id') id: string) {
    return this.checkout.getOrderStatus(phone, id);
  }
}
```

- [ ] **Step 6: Verify the build**

Run: `cd backend && npx tsc --noEmit && npm run lint && npx jest`
Expected: all exit 0 / all pass.

- [ ] **Step 7: Commit**

```bash
git add backend/src/checkout/checkout.service.ts backend/src/checkout/checkout.service.spec.ts backend/src/checkout/checkout.controller.ts
git commit -m "feat(backend): add GET /checkout/orders/:id for payment-result polling"
```

---

### Task 6: Payme `returnUrl` — `returnBaseUrl` wiring

**Files:**
- Modify: `backend/src/checkout/checkout.service.ts`
- Modify: `backend/src/checkout/checkout.service.spec.ts`
- Modify: `app/api/v1/checkout/route.ts` (root)

**Interfaces:**
- Consumes: Task 3's `CreateCheckoutDto.returnBaseUrl` (already validated as an optional URL); `buildPaymeCheckoutUrl`'s existing `returnUrl` parameter (`backend/src/payme/payme-money.ts`, unchanged — it already supports this).
- Produces: When `returnBaseUrl` is present, `checkoutUrl` carries `?c=<returnBaseUrl>/checkout/status/<orderId>` (base64-encoded, per `buildPaymeCheckoutUrl`'s existing format) so Payme sends the shopper back to Task 12's status page. Absent, behavior is byte-identical to before this task — no env var is required for this to work, matching the "blank Payme config breaks nothing" property the prior plan established.

- [ ] **Step 1: Add the failing test**

In `backend/src/checkout/checkout.service.spec.ts`, add this test inside the existing `describe('CheckoutService.createOrder', ...)` block (it needs `ConfigService`, so add the import at the top of the file: `import { ConfigService } from '@nestjs/config';`):

```ts
  it('builds a Payme checkoutUrl with a returnUrl when both PAYME_MERCHANT_ID and returnBaseUrl are present', async () => {
    const { cartsService, customersService, ordersService, prisma, getCart, productFindMany, orderCreate } =
      makeDeps();
    getCart.mockResolvedValue({ items: [{ productId: 'p1', quantity: 1 }] });
    productFindMany.mockResolvedValue([
      { id: 'p1', sku: 'SKU-1', nameEn: 'Filter', isActive: true, price: new Prisma.Decimal(100) },
    ]);
    orderCreate.mockResolvedValue({ id: 'ord-1', orderNumber: 'DP-1001', total: new Prisma.Decimal(100) });
    const config = { get: jest.fn().mockReturnValue('merchant-1') } as unknown as ConfigService;

    const service = new CheckoutService(prisma, cartsService, customersService, ordersService, config);
    const result = await service.createOrder(
      '998901234567',
      baseDto({ returnBaseUrl: 'https://www.diesel-parts.uz' }),
    );

    expect(result.checkoutUrl).not.toBeNull();
    const decoded = Buffer.from(result.checkoutUrl!.split('/').pop()!, 'base64').toString('utf-8');
    expect(decoded).toContain('c=https://www.diesel-parts.uz/checkout/status/ord-1');
  });

  it('still builds a checkoutUrl with no returnUrl segment when returnBaseUrl is absent', async () => {
    const { cartsService, customersService, ordersService, prisma, getCart, productFindMany, orderCreate } =
      makeDeps();
    getCart.mockResolvedValue({ items: [{ productId: 'p1', quantity: 1 }] });
    productFindMany.mockResolvedValue([
      { id: 'p1', sku: 'SKU-1', nameEn: 'Filter', isActive: true, price: new Prisma.Decimal(100) },
    ]);
    orderCreate.mockResolvedValue({ id: 'ord-1', orderNumber: 'DP-1001', total: new Prisma.Decimal(100) });
    const config = { get: jest.fn().mockReturnValue('merchant-1') } as unknown as ConfigService;

    const service = new CheckoutService(prisma, cartsService, customersService, ordersService, config);
    const result = await service.createOrder('998901234567', baseDto());

    const decoded = Buffer.from(result.checkoutUrl!.split('/').pop()!, 'base64').toString('utf-8');
    expect(decoded).not.toContain('c=');
  });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd backend && npx jest src/checkout/checkout.service.spec.ts`
Expected: FAIL — `createOrder` never passes `returnUrl` to `buildPaymeCheckoutUrl`, so the first new test's `decoded` string never contains `c=...`.

- [ ] **Step 3: Implement**

In `backend/src/checkout/checkout.service.ts`, replace the `if (merchantId) { ... }` block inside the `ONLINE` branch:

```ts
      const merchantId = this.config?.get<string>('PAYME_MERCHANT_ID');
      if (merchantId) {
        checkoutUrl = buildPaymeCheckoutUrl({
          merchantId,
          orderId: order.id,
          amountTiyin: toTiyin(total),
          returnUrl: dto.returnBaseUrl
            ? `${dto.returnBaseUrl}/checkout/status/${order.id}`
            : undefined,
        });
      }
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd backend && npx jest src/checkout/checkout.service.spec.ts`
Expected: PASS.

- [ ] **Step 5: Send `returnBaseUrl` from the root proxy route**

In `app/api/v1/checkout/route.ts`, change the `callBackendPhoneVerified` call:

```ts
  const result = await callBackendPhoneVerified<CheckoutResult>(session.phone, "checkout", {
    method: "POST",
    body: { ...body.data, returnBaseUrl: process.env.NEXT_PUBLIC_SITE_URL },
  });
```

(`checkoutRequestSchema` does not need a `returnBaseUrl` field — this value is set server-side from a trusted env var, not taken from the browser's own request body.)

- [ ] **Step 6: Verify both builds**

Run: `cd backend && npx tsc --noEmit && npm run lint && npx jest`
Run (root): `npx tsc --noEmit`
Expected: all exit 0 / all pass.

- [ ] **Step 7: Commit**

```bash
git add backend/src/checkout/checkout.service.ts backend/src/checkout/checkout.service.spec.ts app/api/v1/checkout/route.ts
git commit -m "feat(checkout): send shoppers back to a status page after paying via Payme"
```

---

### Task 7: Root plumbing — `checkoutRequestSchema` + order-status proxy route

**Files:**
- Modify: `lib/schemas.ts`
- Create: `app/api/v1/checkout/orders/[orderId]/route.ts`
- Create: `app/api/v1/checkout/orders/[orderId]/route.test.ts`

**Interfaces:**
- Produces: `checkoutRequestSchema` (Zod) mirroring Task 3's `CreateCheckoutDto` exactly — this is what Task 9's `CheckoutDetailsForm` uses as its `zodResolver`, so its shape must match field-for-field. `GET /api/v1/checkout/orders/[orderId]` proxying to Task 5's backend route.

- [ ] **Step 1: Extend the schema**

In `lib/schemas.ts`, replace the existing `checkoutRequestSchema` block (and its preceding comment):

```ts
export const checkoutDeliveryMethodSchema = z.enum(["PICKUP", "DELIVERY"]);

function optionalTrimmedString(max: number) {
  return z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().max(max, "tooLong").optional(),
  );
}

const optionalEmail = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().max(160, "tooLong").email("invalidEmail").optional(),
);

/**
 * Every failure message here is a *code* (`"required"`, `"tooLong"`, ...),
 * looked up by lib/store/checkout-error-text.ts — same split
 * profileDetailsSchema already uses, for the same reason: this form renders
 * in three languages and a Zod schema has no dictionary.
 *
 * `deliveryFee` is deliberately not a field here: backend/'s CheckoutService
 * always charges 0 for it (no client-supplied fee — see checkout.service.ts's
 * comment) until a real delivery-fee calculation exists to validate one against.
 * `returnBaseUrl` is deliberately not a field either — see route.ts, which
 * adds it server-side from NEXT_PUBLIC_SITE_URL rather than trusting it from
 * the browser's own request body.
 */
export const checkoutRequestSchema = z
  .object({
    firstName: z.string().trim().min(1, "required").max(60, "tooLong"),
    lastName: z.string().trim().min(1, "required").max(60, "tooLong"),
    email: optionalEmail,
    companyName: optionalTrimmedString(160),
    taxId: optionalTrimmedString(32),
    deliveryMethod: checkoutDeliveryMethodSchema,
    city: optionalTrimmedString(120),
    district: optionalTrimmedString(120),
    street: optionalTrimmedString(200),
    deliveryNotes: optionalTrimmedString(500),
    notes: z.string().max(2000).optional(),
    termsAccepted: z.boolean().refine((value) => value === true, "termsRequired"),
    paymentMethod: z.literal("ONLINE"),
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
  });

export type CheckoutRequestInput = z.infer<typeof checkoutRequestSchema>;
```

- [ ] **Step 2: Verify the schema compiles and existing callers still typecheck**

Run: `npx tsc --noEmit`
Expected: exits 0 — `app/api/v1/checkout/route.ts` (Task 6) already imports `checkoutRequestSchema` and forwards `body.data` untouched, so no other change is needed there for this shape to flow through.

- [ ] **Step 3: Write the failing proxy route test**

Create `app/api/v1/checkout/orders/[orderId]/route.test.ts`, matching the sibling `app/api/v1/cart/items/[productId]/route.test.ts`'s exact convention: `vi.mock` the two dependencies first, then a dynamic `await import("./route")` (not a static top-level import) so the mocks are guaranteed registered before the route module loads:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();
vi.mock("@/lib/auth/session", () => ({ getSession: () => getSession() }));

const callBackendPhoneVerified = vi.fn();
vi.mock("@/lib/api/internal-backend", () => ({
  callBackendPhoneVerified: (...args: unknown[]) => callBackendPhoneVerified(...args),
}));

const { GET } = await import("./route");

function params(orderId: string) {
  return { params: Promise.resolve({ orderId }) };
}

beforeEach(() => {
  getSession.mockReset();
  callBackendPhoneVerified.mockReset();
});

describe("GET /api/v1/checkout/orders/:orderId", () => {
  it("answers 401 with no session", async () => {
    getSession.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost"), params("ord-1"));

    expect(response.status).toBe(401);
    expect(callBackendPhoneVerified).not.toHaveBeenCalled();
  });

  it("proxies to backend/ with the session's verified phone", async () => {
    getSession.mockResolvedValue({ phone: "998901234567" });
    callBackendPhoneVerified.mockResolvedValue({
      orderNumber: "DP-1001",
      status: "NEW",
      paymentStatus: "UNPAID",
      latestPaymentStatus: "PENDING",
    });

    const response = await GET(new Request("http://localhost"), params("ord-1"));
    const body = await response.json();

    expect(callBackendPhoneVerified).toHaveBeenCalledWith("998901234567", "checkout/orders/ord-1");
    expect(body).toEqual({
      success: true,
      orderNumber: "DP-1001",
      status: "NEW",
      paymentStatus: "UNPAID",
      latestPaymentStatus: "PENDING",
    });
  });
});
```

- [ ] **Step 4: Run it to verify it fails**

Run: `npx vitest run app/api/v1/checkout/orders/[orderId]/route.test.ts`
Expected: FAIL — the route file does not exist.

- [ ] **Step 5: Implement the route**

Create `app/api/v1/checkout/orders/[orderId]/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { callBackendPhoneVerified } from "@/lib/api/internal-backend";
import { apiError } from "@/lib/api/route-auth";

interface CheckoutOrderStatus {
  orderNumber: string;
  status: string;
  paymentStatus: string;
  latestPaymentStatus: string | null;
}

/** Polled by CheckoutStatusClient after a Payme redirect — see that
 *  component for why this is a poll rather than a one-shot read. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const session = await getSession();
  if (!session) {
    return apiError(401, "Sign in to continue.");
  }

  const { orderId } = await params;
  const result = await callBackendPhoneVerified<CheckoutOrderStatus>(
    session.phone,
    `checkout/orders/${orderId}`,
  );

  return NextResponse.json({ success: true, ...result });
}
```

- [ ] **Step 6: Run it to verify it passes**

Run: `npx vitest run app/api/v1/checkout/orders/[orderId]/route.test.ts`
Expected: PASS.

- [ ] **Step 7: Verify the full root build**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: all exit 0 / all pass.

- [ ] **Step 8: Commit**

```bash
git add lib/schemas.ts "app/api/v1/checkout/orders"
git commit -m "feat(checkout): extend checkoutRequestSchema and add order-status proxy route"
```

---

## Bosqich 2 — Frontend UI (root)

### Task 8: Dictionaries + error-code mapper

**Files:**
- Modify: `dictionaries/en.json`, `dictionaries/ru.json`, `dictionaries/uz.json`
- Create: `lib/store/checkout-error-text.ts`
- Create: `lib/store/checkout-error-text.test.ts`

**Interfaces:**
- Produces: ~30 new keys under each dictionary's existing `"checkout"` object (nothing existing is renamed or removed). `checkoutFieldError(dict: Dictionary["checkout"], code: string | undefined): string | null`. Tasks 9–12 are the consumers.

- [ ] **Step 1: Add the dictionary keys**

In `dictionaries/uz.json`, inside the existing `"checkout": { ... }` object, add these keys right after `"errorSync"` (keep the existing keys exactly as they are; this only appends):

```json
    "errorSync": "Savatni tayyorlashda xatolik yuz berdi. Sahifani yangilab, qaytadan urinib ko'ring.",
    "customerTitle": "Mijoz ma'lumotlari",
    "firstNameLabel": "Ism",
    "lastNameLabel": "Familiya",
    "emailLabel": "Email (ixtiyoriy)",
    "companyNameLabel": "Kompaniya nomi",
    "companyOptionalHint": "Yuridik shaxslar uchun, ixtiyoriy",
    "taxIdLabel": "STIR (INN)",
    "deliveryTitle": "Yetkazib berish usuli",
    "deliveryPickupLabel": "O'zi olib ketish",
    "deliveryPickupDescription": "Do'kondan bepul olib ketish",
    "deliveryDeliveryLabel": "Yetkazib berish",
    "deliveryDeliveryDescription": "Ko'rsatgan manzilingizga yetkazib beramiz",
    "cityLabel": "Shahar",
    "districtLabel": "Tuman",
    "streetLabel": "Ko'cha, uy",
    "deliveryNotesLabel": "Manzil bo'yicha izoh (ixtiyoriy)",
    "paymentCashLabel": "Naqd pul",
    "paymentCashDescription": "Tez orada",
    "paymentCardLabel": "Plastik karta",
    "paymentCardDescription": "Tez orada",
    "termsLabel": "Men xarid shartlariga roziman",
    "mobileSummaryLabel": "Buyurtma tarkibi",
    "mobileSummaryClose": "Yopish",
    "errorRequired": "Bu maydonni to'ldiring",
    "errorTooLong": "Juda uzun",
    "errorInvalidEmail": "Email manzili noto'g'ri",
    "errorTermsRequired": "Davom etish uchun shartlarga rozilik bildiring",
    "statusProcessingTitle": "To'lov tekshirilmoqda",
    "statusProcessingText": "Payme'dan javobni kutyapmiz, bu bir necha soniya vaqt olishi mumkin.",
    "statusSuccessTitle": "To'lov qabul qilindi",
    "statusSuccessText": "Buyurtma #{orderNumber} uchun to'lov muvaffaqiyatli amalga oshirildi.",
    "statusFailedTitle": "To'lov amalga oshmadi",
    "statusFailedText": "To'lovni yakunlab bo'lmadi. Buyurtmalarim bo'limidan qayta urinib ko'rishingiz mumkin."
```

In `dictionaries/ru.json`, the equivalent block:

```json
    "errorSync": "Не удалось подготовить корзину. Обновите страницу и попробуйте снова.",
    "customerTitle": "Данные клиента",
    "firstNameLabel": "Имя",
    "lastNameLabel": "Фамилия",
    "emailLabel": "Email (необязательно)",
    "companyNameLabel": "Название компании",
    "companyOptionalHint": "Для юридических лиц, необязательно",
    "taxIdLabel": "ИНН",
    "deliveryTitle": "Способ доставки",
    "deliveryPickupLabel": "Самовывоз",
    "deliveryPickupDescription": "Бесплатно, забрать из магазина",
    "deliveryDeliveryLabel": "Доставка",
    "deliveryDeliveryDescription": "Доставим по указанному адресу",
    "cityLabel": "Город",
    "districtLabel": "Район",
    "streetLabel": "Улица, дом",
    "deliveryNotesLabel": "Комментарий к адресу (необязательно)",
    "paymentCashLabel": "Наличными",
    "paymentCashDescription": "Скоро",
    "paymentCardLabel": "Банковской картой",
    "paymentCardDescription": "Скоро",
    "termsLabel": "Я согласен с условиями покупки",
    "mobileSummaryLabel": "Состав заказа",
    "mobileSummaryClose": "Закрыть",
    "errorRequired": "Заполните это поле",
    "errorTooLong": "Слишком длинно",
    "errorInvalidEmail": "Некорректный email",
    "errorTermsRequired": "Подтвердите согласие с условиями, чтобы продолжить",
    "statusProcessingTitle": "Проверяем оплату",
    "statusProcessingText": "Ждём ответ от Payme, это может занять несколько секунд.",
    "statusSuccessTitle": "Оплата прошла успешно",
    "statusSuccessText": "Оплата заказа #{orderNumber} прошла успешно.",
    "statusFailedTitle": "Оплата не прошла",
    "statusFailedText": "Не удалось завершить оплату. Вы можете попробовать снова в разделе «Мои заказы»."
```

In `dictionaries/en.json`, the equivalent block:

```json
    "errorSync": "We couldn't prepare your cart. Refresh the page and try again.",
    "customerTitle": "Customer details",
    "firstNameLabel": "First name",
    "lastNameLabel": "Last name",
    "emailLabel": "Email (optional)",
    "companyNameLabel": "Company name",
    "companyOptionalHint": "For business orders, optional",
    "taxIdLabel": "Tax ID (INN)",
    "deliveryTitle": "Delivery method",
    "deliveryPickupLabel": "Pickup",
    "deliveryPickupDescription": "Free, collect from the store",
    "deliveryDeliveryLabel": "Delivery",
    "deliveryDeliveryDescription": "We'll deliver to the address you provide",
    "cityLabel": "City",
    "districtLabel": "District",
    "streetLabel": "Street, building",
    "deliveryNotesLabel": "Address note (optional)",
    "paymentCashLabel": "Cash",
    "paymentCashDescription": "Coming soon",
    "paymentCardLabel": "Card",
    "paymentCardDescription": "Coming soon",
    "termsLabel": "I agree to the terms of purchase",
    "mobileSummaryLabel": "Order summary",
    "mobileSummaryClose": "Close",
    "errorRequired": "This field is required",
    "errorTooLong": "Too long",
    "errorInvalidEmail": "Enter a valid email",
    "errorTermsRequired": "Accept the terms to continue",
    "statusProcessingTitle": "Checking your payment",
    "statusProcessingText": "Waiting for Payme to confirm — this can take a few seconds.",
    "statusSuccessTitle": "Payment received",
    "statusSuccessText": "Payment for order #{orderNumber} was successful.",
    "statusFailedTitle": "Payment failed",
    "statusFailedText": "We couldn't complete the payment. You can try again from My orders."
```

- [ ] **Step 2: Verify key parity**

Run: `npx vitest run lib/i18n/dictionaries.test.ts`
Expected: PASS — this project's existing `"uz, ru, and en dictionaries have identical key structure"` test is the parity check; if it fails, a key was added to one file but not the others (or the wording accidentally kept `{orderNumber}` out of one translation).

- [ ] **Step 3: Write the failing mapper test**

Create `lib/store/checkout-error-text.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { checkoutFieldError } from "./checkout-error-text";
import uz from "@/dictionaries/uz.json";

const dict = uz.checkout;

describe("checkoutFieldError", () => {
  it("returns null when there is no code", () => {
    expect(checkoutFieldError(dict, undefined)).toBeNull();
  });

  it("maps a known code to its sentence", () => {
    expect(checkoutFieldError(dict, "termsRequired")).toBe(dict.errorTermsRequired);
    expect(checkoutFieldError(dict, "invalidEmail")).toBe(dict.errorInvalidEmail);
    expect(checkoutFieldError(dict, "tooLong")).toBe(dict.errorTooLong);
    expect(checkoutFieldError(dict, "required")).toBe(dict.errorRequired);
  });

  it("falls back to the required wording for an unrecognised code", () => {
    expect(checkoutFieldError(dict, "somethingNew")).toBe(dict.errorRequired);
  });
});
```

- [ ] **Step 4: Run it to verify it fails**

Run: `npx vitest run lib/store/checkout-error-text.test.ts`
Expected: FAIL — the module does not exist.

- [ ] **Step 5: Implement**

Create `lib/store/checkout-error-text.ts`:

```ts
import type { Dictionary } from "@/lib/i18n/dictionaries";

type CheckoutDict = Dictionary["checkout"];

/**
 * checkoutRequestSchema (lib/schemas.ts) fails with a code, not a sentence —
 * same split as lib/account/error-text.ts's accountFieldError, for the same
 * reason: this form renders in three languages and Zod has no dictionary.
 */
const MESSAGE_KEY = {
  required: "errorRequired",
  tooLong: "errorTooLong",
  invalidEmail: "errorInvalidEmail",
  termsRequired: "errorTermsRequired",
} as const satisfies Record<string, keyof CheckoutDict>;

export type CheckoutErrorCode = keyof typeof MESSAGE_KEY;

/**
 * `null` when the field is fine. An unrecognised code falls back to the
 * generic "required" wording rather than leaking a raw code onto the screen.
 */
export function checkoutFieldError(dict: CheckoutDict, code: string | undefined): string | null {
  if (code === undefined || code.length === 0) {
    return null;
  }
  const key = MESSAGE_KEY[code as CheckoutErrorCode] ?? "errorRequired";
  return dict[key];
}
```

- [ ] **Step 6: Run it to verify it passes**

Run: `npx vitest run lib/store/checkout-error-text.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add dictionaries lib/store/checkout-error-text.ts lib/store/checkout-error-text.test.ts
git commit -m "feat(checkout): add dictionary keys and error-code mapper for the new checkout fields"
```

---

### Task 9: `CheckoutDetailsForm` component

**Files:**
- Create: `components/store/checkout-details-form.tsx`
- Create: `components/store/checkout-details-form.test.tsx`

**Interfaces:**
- Consumes: Task 7's `checkoutRequestSchema`/`CheckoutRequestInput`, Task 8's `checkoutFieldError`, the existing `Profile` type (`lib/account/profile.ts`).
- Produces: `CheckoutDetailsForm({ formId, dict, profile, onSubmit }): JSX.Element` — a `<form id={formId}>` with no submit button of its own, matching `ProfileDetailsModal`'s remote-submit shape (`<Button type="submit" form={formId}>` lives outside it). Task 10's `CheckoutClient` is the consumer.

- [ ] **Step 1: Write the failing test**

Create `components/store/checkout-details-form.test.tsx`:

```tsx
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CheckoutDetailsForm } from "./checkout-details-form";
import { EMPTY_PROFILE } from "@/lib/account/profile";
import dictionary from "@/dictionaries/uz.json";

afterEach(cleanup);

const dict = dictionary.checkout;

function setup() {
  const onSubmit = vi.fn();
  render(
    <CheckoutDetailsForm formId="checkout-form" dict={dict} profile={EMPTY_PROFILE} onSubmit={onSubmit} />,
  );
  return { onSubmit };
}

function submitForm() {
  const form = document.getElementById("checkout-form") as HTMLFormElement;
  fireEvent.submit(form);
}

describe("CheckoutDetailsForm", () => {
  it("blocks submit and shows required errors when the customer fields are empty", async () => {
    const { onSubmit } = setup();

    submitForm();

    expect(await screen.findAllByText(dict.errorRequired)).not.toHaveLength(0);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("reveals address fields only after DELIVERY is chosen", async () => {
    const user = userEvent.setup();
    setup();

    expect(screen.queryByLabelText(dict.cityLabel)).not.toBeInTheDocument();

    await user.click(screen.getByText(dict.deliveryDeliveryLabel));

    expect(screen.getByLabelText(dict.cityLabel)).toBeInTheDocument();
  });

  it("requires city/district/street once DELIVERY is chosen", async () => {
    const user = userEvent.setup();
    const { onSubmit } = setup();

    await user.type(screen.getByLabelText(dict.firstNameLabel), "Aziz");
    await user.type(screen.getByLabelText(dict.lastNameLabel), "Karimov");
    await user.click(screen.getByText(dict.deliveryDeliveryLabel));
    await user.click(screen.getByLabelText(dict.termsLabel));

    submitForm();

    expect(await screen.findAllByText(dict.errorRequired)).not.toHaveLength(0);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits a complete pickup order", async () => {
    const user = userEvent.setup();
    const { onSubmit } = setup();

    await user.type(screen.getByLabelText(dict.firstNameLabel), "Aziz");
    await user.type(screen.getByLabelText(dict.lastNameLabel), "Karimov");
    await user.click(screen.getByLabelText(dict.termsLabel));

    submitForm();

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      firstName: "Aziz",
      lastName: "Karimov",
      deliveryMethod: "PICKUP",
      termsAccepted: true,
      paymentMethod: "ONLINE",
    });
  });

  it("blocks submit until the terms checkbox is accepted", async () => {
    const user = userEvent.setup();
    const { onSubmit } = setup();

    await user.type(screen.getByLabelText(dict.firstNameLabel), "Aziz");
    await user.type(screen.getByLabelText(dict.lastNameLabel), "Karimov");

    submitForm();

    expect(await screen.findByText(dict.errorTermsRequired)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run components/store/checkout-details-form.test.tsx`
Expected: FAIL — the module does not exist.

- [ ] **Step 3: Implement**

Create `components/store/checkout-details-form.tsx`:

```tsx
"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { checkoutRequestSchema, type CheckoutRequestInput } from "@/lib/schemas";
import { checkoutFieldError } from "@/lib/store/checkout-error-text";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Profile } from "@/lib/account/profile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { CheckboxField } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export interface CheckoutDetailsFormProps {
  formId: string;
  dict: Dictionary["checkout"];
  profile: Profile;
  onSubmit: (values: CheckoutRequestInput) => void;
}

/**
 * The customer/delivery/terms half of checkout — a self-contained form with
 * its own id, submitted from outside by whichever button (the desktop card
 * in CheckoutClient, or the mobile sheet in CheckoutSummarySheet) carries
 * `form={formId}`. Same remote-submit shape ProfileDetailsModal already uses.
 */
export function CheckoutDetailsForm({ formId, dict, profile, onSubmit }: CheckoutDetailsFormProps) {
  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<CheckoutRequestInput>({
    resolver: zodResolver(checkoutRequestSchema),
    defaultValues: {
      firstName: profile.firstName,
      lastName: profile.lastName,
      deliveryMethod: "PICKUP",
      termsAccepted: false,
      paymentMethod: "ONLINE",
    },
  });

  const isDelivery = watch("deliveryMethod") === "DELIVERY";

  return (
    <form id={formId} onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
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
          <FormField label={dict.emailLabel} error={checkoutFieldError(dict, errors.email?.message)}>
            <Input type="email" autoComplete="email" {...register("email")} />
          </FormField>
          <FormField label={dict.companyNameLabel} hint={dict.companyOptionalHint}>
            <Input autoComplete="organization" {...register("companyName")} />
          </FormField>
          <FormField label={dict.taxIdLabel}>
            <Input {...register("taxId")} />
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{dict.deliveryTitle}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <Controller
            control={control}
            name="deliveryMethod"
            render={({ field }) => (
              <RadioGroup name={field.name} value={field.value} onValueChange={field.onChange}>
                <RadioGroupItem
                  value="PICKUP"
                  label={dict.deliveryPickupLabel}
                  description={dict.deliveryPickupDescription}
                />
                <RadioGroupItem
                  value="DELIVERY"
                  label={dict.deliveryDeliveryLabel}
                  description={dict.deliveryDeliveryDescription}
                />
              </RadioGroup>
            )}
          />

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
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <FormField label={dict.notesLabel} multiline>
            <Textarea placeholder={dict.notesPlaceholder} maxLength={2000} rows={3} {...register("notes")} />
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{dict.paymentTitle}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
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

          <CheckboxField
            label={dict.termsLabel}
            error={checkoutFieldError(dict, errors.termsAccepted?.message)}
            {...register("termsAccepted")}
          />
        </CardContent>
      </Card>
    </form>
  );
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run components/store/checkout-details-form.test.tsx`
Expected: PASS.

- [ ] **Step 5: Verify the build**

Run: `npx tsc --noEmit && npm run lint`
Expected: both exit 0.

- [ ] **Step 6: Commit**

```bash
git add components/store/checkout-details-form.tsx components/store/checkout-details-form.test.tsx
git commit -m "feat(checkout): add CheckoutDetailsForm — customer, delivery, and terms fields"
```

---

### Task 10: `CheckoutClient` rewrite

**Files:**
- Create: `components/store/checkout-order-summary.tsx`
- Modify: `components/store/checkout-client.tsx`

**Interfaces:**
- Consumes: Task 9's `CheckoutDetailsForm`, the existing `useProfile()` hook (`hooks/use-store.ts`) for name prefill.
- Produces: `CheckoutOrderSummary` — a pure presentational block, used here and by Task 11's `CheckoutSummarySheet`. `CheckoutClient` unchanged in its external contract (`{ lang, dict, cartDict }` props).

- [ ] **Step 1: Extract `CheckoutOrderSummary`**

Create `components/store/checkout-order-summary.tsx`:

```tsx
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export interface CheckoutOrderSummaryProps {
  cartDict: Dictionary["cart"];
  checkoutDict: Dictionary["checkout"];
  lineCount: number;
  unitCount: number;
  total: number;
  totalLabel: string | null;
  unpricedCount: number;
  errorMessage: string | null;
}

/** The line-count/total block, shared by the desktop card (CheckoutClient)
 *  and the mobile sheet (CheckoutSummarySheet) so the two can never drift
 *  into reporting different numbers. */
export function CheckoutOrderSummary({
  cartDict,
  checkoutDict,
  lineCount,
  unitCount,
  total,
  totalLabel,
  unpricedCount,
  errorMessage,
}: CheckoutOrderSummaryProps) {
  return (
    <>
      <dl className="space-y-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted">{cartDict.summaryLines}</dt>
          <dd className="tabular-nums text-foreground">{lineCount}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted">{cartDict.summaryUnits}</dt>
          <dd className="tabular-nums text-foreground">{unitCount}</dd>
        </div>
        <Separator className="my-1" />
        <div className="flex justify-between">
          <dt className="text-muted">{cartDict.summaryPrice}</dt>
          <dd className="font-medium text-foreground">
            {total > 0 ? totalLabel : cartDict.priceOnRequest}
          </dd>
        </div>
      </dl>

      {unpricedCount > 0 ? (
        <p className="mt-3 text-xs leading-relaxed text-accent-strong">
          {cartDict.unpricedNote.replace("{count}", String(unpricedCount))}
        </p>
      ) : null}

      {errorMessage ? (
        <Alert variant="danger" className="mt-4">
          <AlertTitle>{checkoutDict.errorGeneric}</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}
    </>
  );
}
```

- [ ] **Step 2: Rewrite `CheckoutClient`**

Replace the full contents of `components/store/checkout-client.tsx`:

```tsx
"use client";

import { useId, useState } from "react";
import Link from "next/link";
import axios from "axios";
import { toast } from "sonner";
import { PackageCheck } from "lucide-react";
import { StoreEmpty } from "@/components/store/store-empty";
import { useCart, useProfile } from "@/hooks/use-store";
import { formatPrice, sumPrices } from "@/lib/format-price";
import { cartLineCount, cartUnitCount } from "@/lib/store/cart";
import { useResolvedProducts } from "@/hooks/use-resolved-products";
import { usePruneMissing } from "@/hooks/use-prune-missing";
import { ResolvedProductsSkeleton } from "@/components/store/resolved-products-skeleton";
import { CheckoutDetailsForm } from "@/components/store/checkout-details-form";
import { CheckoutOrderSummary } from "@/components/store/checkout-order-summary";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import type { CheckoutRequestInput } from "@/lib/schemas";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface CheckoutClientProps {
  lang: Locale;
  dict: Dictionary["checkout"];
  cartDict: Dictionary["cart"];
}

type Status = "submitting" | "idle" | "success" | "error";

/** `order` is opaque here — the proxy route passes it through unparsed, and
 *  the one field this screen reads out of it is optional in the response. */
function getOrderNumber(order: Record<string, unknown>): string | null {
  return typeof order.orderNumber === "string" ? order.orderNumber : null;
}

/** A plain top-level function, not a hook: Payme's checkout lives on another
 *  origin, so this needs a full navigation rather than `next/navigation`. */
function redirectTo(url: string) {
  window.location.href = url;
}

function extractErrorMessage(error: unknown): string | null {
  if (!axios.isAxiosError(error)) {
    return null;
  }
  const data: unknown = error.response?.data;
  if (data === null || typeof data !== "object") {
    return null;
  }
  const record = data as Record<string, unknown>;
  const errors = record.errors;
  if (errors !== null && typeof errors === "object") {
    const root = (errors as Record<string, unknown>)._root;
    if (Array.isArray(root) && typeof root[0] === "string") {
      return root[0];
    }
  }
  return typeof record.message === "string" ? record.message : null;
}

/**
 * The local (Zustand/localStorage) cart and the server cart `backend/`'s
 * checkout reads from are two different stores that nothing keeps in sync
 * yet — so every line is pushed to `PUT /api/v1/cart/items` right before
 * `POST /api/v1/checkout`, once, at the moment it is actually needed rather
 * than on every cart edit.
 */
export function CheckoutClient({ lang, dict, cartDict }: CheckoutClientProps) {
  const cart = useCart();
  const { profile } = useProfile();
  const formId = useId();
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);

  const ids = cart.items.map((item) => item.productId);
  const { items: resolved, isLoading, isSuccess } = useResolvedProducts(ids, lang);
  usePruneMissing(ids, resolved, isSuccess, cart.remove);

  const byId = new Map(resolved.map((entry) => [entry.product.id, entry]));
  const lines = cart.items
    .map((item) => {
      const entry = byId.get(item.productId);
      return entry ? { ...entry, quantity: item.quantity } : null;
    })
    .filter((line): line is NonNullable<typeof line> => line !== null);

  const { total, unpriced } = sumPrices(
    lines.map((line) => ({ price: line.product.price, quantity: line.quantity })),
  );
  const unitCount = cartUnitCount(lines);
  const lineCount = cartLineCount(lines);
  const totalLabel = formatPrice(total, lang);

  async function placeOrder(values: CheckoutRequestInput) {
    if (lines.length === 0 || status === "submitting") {
      return;
    }

    setStatus("submitting");
    setErrorMessage(null);

    try {
      await Promise.all(
        lines.map((line) =>
          axios.put("/api/v1/cart/items", {
            productId: line.product.id,
            quantity: line.quantity,
          }),
        ),
      );

      const response = await axios.post("/api/v1/checkout", values);
      const { order, checkoutUrl } = response.data as {
        order: Record<string, unknown>;
        checkoutUrl: string | null;
      };

      cart.clear();

      if (checkoutUrl) {
        redirectTo(checkoutUrl);
        return;
      }

      setOrderNumber(getOrderNumber(order));
      setStatus("success");
    } catch (error) {
      const message = extractErrorMessage(error) ?? dict.errorGeneric;
      setErrorMessage(message);
      setStatus("error");
      toast.error(message);
    }
  }

  if (isLoading) {
    return <ResolvedProductsSkeleton count={cart.items.length} />;
  }

  if (status !== "success" && lines.length === 0) {
    return (
      <StoreEmpty
        icon={PackageCheck}
        message={dict.errorEmpty}
        ctaHref="/products"
        ctaLabel={cartDict.emptyCta}
      />
    );
  }

  if (status === "success") {
    return (
      <Card
        role="status"
        tabIndex={-1}
        ref={(el) => {
          el?.focus();
        }}
      >
        <CardContent className="flex flex-col items-center py-8 text-center">
          <PackageCheck aria-hidden className="size-10 text-success" strokeWidth={1.5} />
          <h2 className="type-section mt-4 text-foreground">{dict.successTitle}</h2>
          <p className="mt-2 max-w-md type-body text-muted">
            {orderNumber
              ? dict.successPendingText.replace("{orderNumber}", orderNumber)
              : dict.successPendingText.replace("#{orderNumber} ", "")}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-4">
            <Link href="/account/orders" className={buttonVariants({ variant: "outline" })}>
              {dict.viewOrders}
            </Link>
            <Link href="/products" className={buttonVariants({ variant: "ghost" })}>
              {dict.continueShopping}
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_20rem] lg:items-start">
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>{dict.itemsTitle}</CardTitle>
            <Link href="/cart" className="text-sm text-accent-strong hover:underline">
              {dict.editCart}
            </Link>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col">
              {lines.map(({ product, quantity }, index) => (
                <li key={product.id}>
                  {index > 0 ? <Separator className="my-3" /> : null}
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <span className="text-sm text-foreground">
                      {product.name[lang]} <span className="text-muted">({product.sku})</span>
                    </span>
                    <span className="tabular-nums text-sm text-muted">
                      {quantity} × {formatPrice(product.price, lang) ?? cartDict.priceOnRequest}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <CheckoutDetailsForm formId={formId} dict={dict} profile={profile} onSubmit={placeOrder} />
      </div>

      <aside className="lg:sticky lg:top-40">
        <Card>
          <CardHeader>
            <CardTitle>{cartDict.summaryTitle}</CardTitle>
          </CardHeader>

          <CardContent>
            <CheckoutOrderSummary
              cartDict={cartDict}
              checkoutDict={dict}
              lineCount={lineCount}
              unitCount={unitCount}
              total={total}
              totalLabel={totalLabel}
              unpricedCount={unpriced}
              errorMessage={status === "error" ? errorMessage : null}
            />

            <Button type="submit" form={formId} size="lg" className="mt-6 w-full" disabled={status === "submitting"}>
              {status === "submitting" ? dict.submitting : dict.submit}
            </Button>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
```

- [ ] **Step 3: Verify the build**

Run: `npx tsc --noEmit && npm run lint`
Expected: both exit 0.

- [ ] **Step 4: Manual verification (this codebase's existing convention — see Global Constraints — for a composite client component wired to `useCart`/`useResolvedProducts`/axios)**

Run: `npm run dev`, then in a browser with a phone-verified session and at least one item in the cart, open `/checkout` and confirm:
- Customer fields prefill from `/account`'s saved first/last name if one was set there (open `/account`, save a profile, then reload `/checkout`); otherwise they start empty.
- Submitting with empty required fields shows inline errors and makes no network request (check the Network tab).
- Choosing "Yetkazib berish" reveals city/district/street; choosing "O'zi olib ketish" hides them again.
- Filling every required field, accepting the terms checkbox, and submitting calls `PUT /api/v1/cart/items` then `POST /api/v1/checkout`, and lands on the success card (since `PAYME_MERCHANT_ID` is unset in local dev, `checkoutUrl` is `null` and the flow ends on the "order received" screen rather than redirecting).

- [ ] **Step 5: Commit**

```bash
git add components/store/checkout-order-summary.tsx components/store/checkout-client.tsx
git commit -m "feat(checkout): rebuild CheckoutClient around CheckoutDetailsForm"
```

---

### Task 11: Mobile summary sheet

**Files:**
- Create: `components/store/checkout-summary-sheet.tsx`
- Modify: `components/store/checkout-client.tsx`

**Interfaces:**
- Consumes: Task 10's `CheckoutOrderSummary`/`CheckoutOrderSummaryProps`.
- Produces: `CheckoutSummarySheet` — mobile-only (`lg:hidden`), self-contained (own `open` state), modeled directly on `components/product/filter-drawer.tsx`'s Radix Dialog + `motion` pattern (no shared extraction from `FilterDrawer` itself — it has no test today and touching it would be unrelated scope creep for this plan).

- [ ] **Step 1: Implement `CheckoutSummarySheet`**

Create `components/store/checkout-summary-sheet.tsx`:

```tsx
"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "motion/react";
import { ChevronUp, X } from "lucide-react";
import { MOTION } from "@/components/providers/motion-provider";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { CheckoutOrderSummary, type CheckoutOrderSummaryProps } from "@/components/store/checkout-order-summary";

export interface CheckoutSummarySheetProps extends CheckoutOrderSummaryProps {
  formId: string;
  submitting: boolean;
  submitLabel: string;
  submittingLabel: string;
}

/**
 * Mobile-only: a sticky bottom bar (total + Place Order, always reachable
 * without scrolling back up through the form) whose "view summary" row opens
 * the same line-count/total block the desktop aside shows, as a bottom
 * sheet. Hidden at `lg` and up, where the sticky aside card already does
 * this job — see CheckoutClient.
 *
 * Same Radix Dialog + motion pattern as components/product/filter-drawer.tsx,
 * kept as its own component rather than a shared extraction: FilterDrawer
 * has no test today, and this plan does not touch it.
 */
export function CheckoutSummarySheet({
  formId,
  submitting,
  submitLabel,
  submittingLabel,
  cartDict,
  checkoutDict,
  total,
  totalLabel,
  ...summaryProps
}: CheckoutSummarySheetProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="lg:hidden">
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface-elevated p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mb-3 flex w-full items-center justify-between text-sm text-foreground"
        >
          <span className="flex items-center gap-1 text-muted">
            <Icon icon={ChevronUp} size="sm" />
            {checkoutDict.mobileSummaryLabel}
          </span>
          <span className="font-medium tabular-nums">
            {total > 0 ? totalLabel : cartDict.priceOnRequest}
          </span>
        </button>
        <Button type="submit" form={formId} size="lg" className="w-full" disabled={submitting}>
          {submitting ? submittingLabel : submitLabel}
        </Button>
      </div>

      {/* Spacer so the fixed bar never covers the form's last field. */}
      <div aria-hidden className="h-32" />

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal forceMount>
          <AnimatePresence>
            {open ? (
              <Dialog.Overlay asChild forceMount key="overlay">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={MOTION.fade}
                  className="fixed inset-0 z-100 bg-black/60"
                />
              </Dialog.Overlay>
            ) : null}
          </AnimatePresence>

          <AnimatePresence>
            {open ? (
              <Dialog.Content asChild forceMount key="sheet" aria-describedby={undefined}>
                <motion.div
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  exit={{ y: "100%" }}
                  transition={MOTION.drawer}
                  className="fixed inset-x-0 bottom-0 z-100 flex max-h-[85dvh] flex-col rounded-t-lg border-t border-border bg-surface-elevated text-foreground shadow-xl"
                >
                  <div className="flex shrink-0 justify-center pt-2" aria-hidden>
                    <span className="h-1 w-9 rounded-full bg-border-strong" />
                  </div>
                  <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
                    <Dialog.Title className="text-lg font-semibold">
                      {checkoutDict.mobileSummaryLabel}
                    </Dialog.Title>
                    <Dialog.Close
                      aria-label={checkoutDict.mobileSummaryClose}
                      className="flex h-10 w-10 items-center justify-center rounded-md transition-colors hover:bg-surface-hover"
                    >
                      <Icon icon={X} size="lg" />
                    </Dialog.Close>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
                    <CheckoutOrderSummary
                      cartDict={cartDict}
                      checkoutDict={checkoutDict}
                      total={total}
                      totalLabel={totalLabel}
                      {...summaryProps}
                    />
                  </div>
                </motion.div>
              </Dialog.Content>
            ) : null}
          </AnimatePresence>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
```

- [ ] **Step 2: Wire it into `CheckoutClient`**

In `components/store/checkout-client.tsx`:

Add the import:

```tsx
import { CheckoutSummarySheet } from "@/components/store/checkout-summary-sheet";
```

Change the `<aside className="lg:sticky lg:top-40">` line to hide it on mobile (the sheet below takes over there):

```tsx
      <aside className="hidden lg:sticky lg:top-40 lg:block">
```

Add `<CheckoutSummarySheet>` as a sibling of `<aside>` (after it, still inside the outermost `<div className="grid gap-8 lg:grid-cols-[1fr_20rem] lg:items-start">`):

```tsx
      <CheckoutSummarySheet
        formId={formId}
        submitting={status === "submitting"}
        submitLabel={dict.submit}
        submittingLabel={dict.submitting}
        cartDict={cartDict}
        checkoutDict={dict}
        lineCount={lineCount}
        unitCount={unitCount}
        total={total}
        totalLabel={totalLabel}
        unpricedCount={unpriced}
        errorMessage={status === "error" ? errorMessage : null}
      />
```

- [ ] **Step 3: Verify the build**

Run: `npx tsc --noEmit && npm run lint`
Expected: both exit 0.

- [ ] **Step 4: Manual verification (same existing-convention rationale as Task 10 — `FilterDrawer`, this component's own model, has no test either)**

Run: `npm run dev`, open `/checkout` in a browser at a mobile viewport width (devtools device toolbar, e.g. 390px):
- The sticky bottom bar is visible with the running total and a "Buyurtma berish" button; the desktop aside card is not shown.
- Tapping the bar's "Buyurtma tarkibi" row opens the bottom sheet showing the same line count/unit count/total as the bar.
- The bar's submit button places the order exactly like the desktop card's button does (same `form={formId}`).
- Widening the viewport past the `lg` breakpoint hides the bar/sheet and shows the desktop aside card instead.

- [ ] **Step 5: Commit**

```bash
git add components/store/checkout-summary-sheet.tsx components/store/checkout-client.tsx
git commit -m "feat(checkout): add mobile sticky summary bar and bottom sheet"
```

---

### Task 12: Payment status page

**Files:**
- Create: `components/store/checkout-status-client.tsx`
- Create: `components/store/checkout-status-client.test.tsx`
- Create: `app/(site)/checkout/status/[orderId]/page.tsx`

**Interfaces:**
- Consumes: Task 7's `GET /api/v1/checkout/orders/[orderId]` proxy route.
- Produces: `resolvePhase(data): "processing" | "success" | "failed"` (exported, pure — see Global Constraints on why this gets a direct test). `CheckoutStatusClient({ orderId, dict })`.

- [ ] **Step 1: Write the failing test**

Create `components/store/checkout-status-client.test.tsx`:

```tsx
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { CheckoutStatusClient, resolvePhase } from "./checkout-status-client";
import dictionary from "@/dictionaries/uz.json";

const get = vi.fn();
vi.mock("axios", () => ({
  default: { get: (...args: unknown[]) => get(...args) },
}));

afterEach(cleanup);

const dict = dictionary.checkout;

describe("resolvePhase", () => {
  it("reports success once the order is fully PAID", () => {
    expect(
      resolvePhase({ orderNumber: "DP-1", paymentStatus: "PAID", latestPaymentStatus: null }),
    ).toBe("success");
  });

  it("reports success as soon as the latest payment COMPLETED, even before the aggregate catches up", () => {
    expect(
      resolvePhase({ orderNumber: "DP-1", paymentStatus: "UNPAID", latestPaymentStatus: "COMPLETED" }),
    ).toBe("success");
  });

  it("reports failed when the latest payment FAILED", () => {
    expect(
      resolvePhase({ orderNumber: "DP-1", paymentStatus: "UNPAID", latestPaymentStatus: "FAILED" }),
    ).toBe("failed");
  });

  it("reports failed when the latest payment was REFUNDED", () => {
    expect(
      resolvePhase({ orderNumber: "DP-1", paymentStatus: "UNPAID", latestPaymentStatus: "REFUNDED" }),
    ).toBe("failed");
  });

  it("reports processing while the latest payment is still PENDING or absent", () => {
    expect(
      resolvePhase({ orderNumber: "DP-1", paymentStatus: "UNPAID", latestPaymentStatus: "PENDING" }),
    ).toBe("processing");
    expect(
      resolvePhase({ orderNumber: "DP-1", paymentStatus: "UNPAID", latestPaymentStatus: null }),
    ).toBe("processing");
  });
});

describe("CheckoutStatusClient", () => {
  it("shows the success screen once the poll reports a completed payment", async () => {
    get.mockResolvedValue({
      data: { success: true, orderNumber: "DP-1001", paymentStatus: "PAID", latestPaymentStatus: "COMPLETED" },
    });

    render(<CheckoutStatusClient orderId="ord-1" dict={dict} />);

    expect(await screen.findByText(dict.statusSuccessTitle)).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith("/api/v1/checkout/orders/ord-1");
  });

  it("shows the failed screen when the request errors", async () => {
    get.mockRejectedValue(new Error("network"));

    render(<CheckoutStatusClient orderId="ord-1" dict={dict} />);

    expect(await screen.findByText(dict.statusFailedTitle)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run components/store/checkout-status-client.test.tsx`
Expected: FAIL — the module does not exist.

- [ ] **Step 3: Implement**

Create `components/store/checkout-status-client.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import axios from "axios";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import type { Dictionary } from "@/lib/i18n/dictionaries";

type Phase = "processing" | "success" | "failed";

interface OrderStatusResponse {
  orderNumber: string;
  paymentStatus: "UNPAID" | "PARTIAL" | "PAID";
  latestPaymentStatus: "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED" | null;
}

const POLL_INTERVAL_MS = 3000;
const MAX_POLLS = 20; // ~1 minute of polling before settling on "processing"

/**
 * Payme's redirect back to this page carries no documented, trustworthy
 * success/failure signal of its own — the only source of truth is this
 * poll against backend/'s own Payment record, set exclusively by Payme's
 * webhook (see CheckoutService.getOrderStatus's doc comment).
 */
export function resolvePhase(data: OrderStatusResponse): Phase {
  if (data.paymentStatus === "PAID" || data.latestPaymentStatus === "COMPLETED") {
    return "success";
  }
  if (data.latestPaymentStatus === "FAILED" || data.latestPaymentStatus === "REFUNDED") {
    return "failed";
  }
  return "processing";
}

export function CheckoutStatusClient({ orderId, dict }: { orderId: string; dict: Dictionary["checkout"] }) {
  const [phase, setPhase] = useState<Phase>("processing");
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const pollsRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      try {
        const { data } = await axios.get<{ success: true } & OrderStatusResponse>(
          `/api/v1/checkout/orders/${orderId}`,
        );
        if (cancelled) return;

        setOrderNumber(data.orderNumber);
        const next = resolvePhase(data);
        setPhase(next);

        pollsRef.current += 1;
        if (next === "processing" && pollsRef.current < MAX_POLLS) {
          timer = setTimeout(poll, POLL_INTERVAL_MS);
        }
      } catch {
        if (!cancelled) setPhase("failed");
      }
    }

    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [orderId]);

  const content = {
    processing: {
      icon: Clock,
      iconClassName: "text-muted animate-pulse",
      title: dict.statusProcessingTitle,
      text: dict.statusProcessingText,
    },
    success: {
      icon: CheckCircle2,
      iconClassName: "text-success",
      title: dict.statusSuccessTitle,
      text: orderNumber
        ? dict.statusSuccessText.replace("{orderNumber}", orderNumber)
        : dict.statusSuccessText.replace("#{orderNumber} ", ""),
    },
    failed: {
      icon: XCircle,
      iconClassName: "text-danger",
      title: dict.statusFailedTitle,
      text: dict.statusFailedText,
    },
  }[phase];

  return (
    <Card role="status">
      <CardContent className="flex flex-col items-center py-10 text-center">
        <Icon icon={content.icon} size="xl" className={content.iconClassName} strokeWidth={1.5} />
        <h1 className="type-section mt-4 text-foreground">{content.title}</h1>
        <p className="mt-2 max-w-md type-body text-muted">{content.text}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-4">
          <Link href="/account/orders" className={buttonVariants({ variant: "outline" })}>
            {dict.viewOrders}
          </Link>
          <Link href="/products" className={buttonVariants({ variant: "ghost" })}>
            {dict.continueShopping}
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run components/store/checkout-status-client.test.tsx`
Expected: PASS.

- [ ] **Step 5: Add the page**

Create `app/(site)/checkout/status/[orderId]/page.tsx`:

```tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { CheckoutStatusClient } from "@/components/store/checkout-status-client";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/server-locale";
import { Container } from "@/components/ui/container";

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLocale();
  const dict = getDictionary(lang);
  return {
    title: `${dict.checkout.statusProcessingTitle} — ${dict.meta.siteName}`,
    robots: { index: false, follow: false },
  };
}

export default async function CheckoutStatusPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const lang = await getLocale();
  const dict = getDictionary(lang);

  // Same guard /checkout itself uses: no session, no order to check.
  const session = await getSession();
  if (!session) {
    redirect("/");
  }

  const { orderId } = await params;

  return (
    <Container as="main" size="prose" className="pb-24 pt-12">
      <CheckoutStatusClient orderId={orderId} dict={dict.checkout} />
    </Container>
  );
}
```

- [ ] **Step 6: Verify the build**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: all exit 0 / all pass.

- [ ] **Step 7: Manual verification**

Run: `npm run dev`, sign in with a phone-verified session, place a pickup order from `/checkout` to obtain a real order id (visible via `npx prisma studio` in `backend/`, or by temporarily logging `order.id` in `checkout-client.tsx`'s `placeOrder`), then visit `/checkout/status/<that id>` and confirm the page loads showing "To'lov tekshirilmoqda" (processing) — expected in local dev, since `PAYME_MERCHANT_ID` is unset and no webhook will ever mark the payment `COMPLETED`. Visiting `/checkout/status/does-not-exist` while signed in should not throw an unhandled error in the browser console (the underlying `GET` 404s; the page still renders — see Task 7's note that this route does not special-case backend errors, matching the existing `carts/items/[productId]` proxy's convention).

- [ ] **Step 8: Commit**

```bash
git add components/store/checkout-status-client.tsx components/store/checkout-status-client.test.tsx "app/(site)/checkout/status"
git commit -m "feat(checkout): add the Payme payment-result page"
```

---

### Task 13: Final verification pass

**Files:** None (verification only).

- [ ] **Step 1: Full backend verification**

Run: `cd backend && npx tsc --noEmit && npm run lint && npx jest`
Expected: all exit 0 / all pass.

- [ ] **Step 2: Full root verification**

Run: `npx tsc --noEmit && npm run lint && npm test && npm run build`
Expected: all exit 0 / all pass, including the `npm run build` production build (catches anything a dev-only run would not, e.g. a stray server/client boundary issue in the new status page).

- [ ] **Step 3: End-to-end manual QA in the browser**

Run: `npm run dev` (and `cd backend && npm run start:dev` if not already running). With a phone-verified session and items in the cart:

1. `/checkout` — customer fields prefill from any saved `/account` profile; PICKUP is the default delivery method.
2. Switch to DELIVERY — city/district/street appear and become required; switch back to PICKUP — they disappear and are no longer required.
3. Try to submit without accepting the terms checkbox — blocked, with the terms error visible.
4. Complete a PICKUP order — lands on the success card with an order number (no Payme redirect locally, since `PAYME_MERCHANT_ID` is unset).
5. At a mobile viewport, repeat step 4 using the sticky bottom bar's button instead of scrolling to a card.
6. Visit `/checkout/status/<the order id from step 4>` — shows the processing state (expected locally, no webhook will ever fire without real Payme credentials).
7. Run `npx vitest run lib/i18n/dictionaries.test.ts` once more standalone to double-check the three dictionaries never drifted apart while hand-editing them across Task 8.

- [ ] **Step 4: Report**

No commit for this task — it is the closing verification. Summarize in the final message: what changed, why the `returnBaseUrl`/customer-backfill/one-status-page design choices were made (per this plan's Architecture section), and that all four verification commands (backend tsc/lint/jest, root tsc/lint/test/build) are clean.
