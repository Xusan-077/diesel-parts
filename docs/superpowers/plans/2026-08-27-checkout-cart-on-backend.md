# Checkout Cart on Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the server-side shopping cart onto `backend/` (the NestJS app that already powers `/seller/*` and is the project's intended single source of truth), reachable from a phone-verified storefront visitor through the same internal-service HMAC bridge `backend/`'s Reviews module already uses — and, unlike that module, actually wire Next.js to call it end-to-end.

**Architecture:** `backend/` gains a `Cart`/`CartItem` model and a `CartModule` with customer-facing endpoints guarded by the existing `InternalServiceGuard` (proves the call came from Next.js's own server holding `INTERNAL_SERVICE_SECRET`, carrying an OTP-verified phone — no separate customer auth system in `backend/`, exactly the pattern `ReviewsController`'s `@UseGuards(InternalServiceGuard)` routes already use). Next.js's `/api/v1/cart*` routes stop touching `@/lib/db`/Prisma and become a thin proxy that calls `backend/` via a new helper mirroring `lib/api/internal-backend.ts`. The Cart/CartItem/Payment/Address models and `/api/v1/cart*` routes added directly on root's own Prisma schema earlier this session are removed as part of this plan — they were built before this architecture decision and are now superseded, not a second system to keep in parallel.

**Tech Stack:** NestJS 11, Prisma ORM 7 (`prisma-client` generator, `@prisma/adapter-pg`), class-validator DTOs — for `backend/`. Next.js 16 App Router, Zod, `server-only` — for the root app's proxy layer. Vitest for root; Jest for `backend/`.

**Spec:** Reconciles the original cart/checkout spec with the codebase's actual (and, per `docs/superpowers/plans/2026-08-23-backend-consolidation.md`, intended-but-incomplete) two-backend architecture. Confirmed with the user via AskUserQuestion this session: build forward on `backend/`, not root's own database — the earlier root-schema cart work (commits `4bbb8c3` through `679cc1f`) is explicitly superseded and removed here rather than kept as a second live path.

## Global Constraints

- `backend/`'s existing module pattern, copied exactly (see `backend/src/reviews/*` as the closest precedent — a mix of public and `InternalServiceGuard`-gated routes on one controller): `<domain>.module.ts` registers controller + service; `<domain>.controller.ts` is thin, guards per-route; `<domain>.service.ts` holds logic, injects `PrismaService`, throws Nest exceptions (`NotFoundException`, `BadRequestException`); DTOs are `class-validator` classes under `dto/`.
- The cart is never trusted for price or product existence — `backend/`'s services already snapshot price from `Product` at order-creation time (see `OrdersService.create`'s `lineItems` mapping); the cart itself stores only `productId`/`quantity`, never a price, matching that rule from day one.
- Money fields stay `Prisma.Decimal` inside `backend/`; only the Next.js proxy boundary converts to `number` in its JSON response, exactly as `lib/api/order-repository.ts` already did for the (now-removed) root schema.
- This plan is **not done** until a real request from a Next.js route reaches `backend/`'s database and back — run `backend/`'s dev server locally and hit the new routes through Next.js's proxy with `curl`/`fetch` as part of verification, not just mocked unit tests on each side.
- Run `cd backend && npx tsc --noEmit && npm run lint && npm test` and, at the root, `npx tsc --noEmit && npm run lint && npm test && npm run build` after every task that touches that project. A task is not done until both sides are clean where applicable.
- Do not touch `app/(seller-auth)/`, `app/seller/**`, `components/seller/**`, `hooks/seller/**`, `lib/seller/**`, `lib/api/seller-panel/**`, `lib/store/seller-auth-store.ts` — the consolidation plan's own boundary, still valid, and orthogonal to this work.

---

## File Structure

| File | Responsibility |
|---|---|
| `backend/prisma/schema.prisma` | New `Cart`/`CartItem` models. |
| `backend/src/carts/carts.module.ts`, `carts.controller.ts`, `carts.service.ts` | The cart domain: `InternalServiceGuard`-gated read/add/set/remove/clear, plus a merge-on-login endpoint. |
| `backend/src/carts/dto/set-cart-item.dto.ts`, `dto/merge-cart.dto.ts` | Request bodies. |
| `backend/src/carts/carts.service.spec.ts` | Unit tests (Jest, `PrismaService` mocked) mirroring the style of `backend/src/reviews/*.spec.ts` (check that file's mocking pattern before writing this one — do not invent a different one). |
| `lib/api/internal-backend.ts` | Extended with a `callBackendCart` (or generalized) function carrying the phone-HMAC headers `InternalServiceGuard` expects (`x-verified-phone`, `x-service-timestamp`, `x-service-signature`), distinct from the existing director-only `x-service-timestamp`/`x-service-signature`-only signer used for AI calls. |
| `app/api/v1/cart/route.ts`, `items/route.ts`, `items/[productId]/route.ts` | Rewritten to call `backend/` through the new helper instead of `@/lib/api/cart-repository`. |
| `app/api/auth/verify-code/route.ts` | Rewritten to call `backend/`'s merge endpoint instead of `@/lib/api/cart-repository`'s `mergeGuestCart`. |
| Removed: `lib/api/cart-repository.ts`, `lib/store/cart.ts`'s `mergeCartItems` stays (still used — see below) | The root-Prisma cart repository is deleted; `mergeCartItems` is pure and framework-agnostic, so it moves to being `backend/`'s merge logic too (ported, not shared as a package — the two apps don't share code today, see `common/phone.ts` already being a duplicate-by-design of `lib/auth/phone.ts`). |
| Removed: root schema's `Cart`/`CartItem`/`Payment`/`Address` models and their migrations | Superseded by this plan; see Task 1. |

---

### Task 1: Remove the superseded root-schema cart/payment work

**Files:**
- Modify: `prisma/schema.prisma` (remove `Cart`, `CartItem`, `Payment`, `Address` models; remove `Order.channel`, `paymentMethod`, `paymentStatus`, `deliveryMethod`, `deliveryFee`, `addressId`, `address`, `payments` fields; revert `Customer.addresses`, `Product.cartItems`; revert `OrderStatus` to its pre-this-session values `DRAFT | PENDING | CONFIRMED | COMPLETED | CANCELLED`)
- Modify: `lib/api/order-status.ts`, `lib/api/order-status.test.ts` (revert to the pre-session transition table)
- Modify: `lib/api/seller-scope.ts`, `lib/api/seller-scope.test.ts` (revert `orderReadScope`/`orderWriteScope` to the flat `{ sellerId }` form)
- Modify: `lib/i18n/panel-dictionary.ts`, `components/director/order-status-badge.tsx`, `lib/admin/customer-timeline.ts`, `lib/admin/customer-timeline.test.ts` (revert the exhaustive-map additions for the now-removed statuses)
- Delete: `lib/api/cart-repository.ts`
- Delete: `app/api/v1/cart/route.ts`, `route.test.ts`, `items/route.ts`, `route.test.ts`, `items/[productId]/route.ts`, `route.test.ts`
- Modify: `app/api/auth/verify-code/route.ts` (drop the `mergeGuestCart` call and `cart` response field for now — Task 5 reintroduces it against `backend/`); delete `app/api/auth/verify-code/route.test.ts`'s cart-merge assertions (or the whole file if nothing else is left to test — check first)
- Modify: `lib/schemas.ts` (remove `cartSetItemSchema`, `cartMergeSchema`, `verifyCodeWithCartSchema`)
- Delete migration: `prisma/migrations/20260827122749_checkout_cart_foundation/`, `prisma/migrations/20260827123500_payment_transaction_idempotency/`

**Interfaces:** N/A — this task only removes code; nothing new is produced for later tasks to consume.

- [ ] **Step 1: Revert the schema**

Open `prisma/schema.prisma`. Remove the `OrderChannel`, `PaymentMethod`, `PaymentStatus`, `DeliveryMethod` enums added this session. Restore `OrderStatus` to:

```prisma
enum OrderStatus {
  DRAFT
  PENDING
  CONFIRMED
  COMPLETED
  CANCELLED
}
```

Remove the `Payment`, `Address`, `Cart`, `CartItem` models entirely. In `Order`, remove the `channel`, `paymentMethod`, `paymentStatus`, `deliveryMethod`, `deliveryFee`, `addressId`, `address`, `payments` fields and the `@@index([channel, status])` line. In `Customer`, remove `addresses Address[]`. In `Product`, remove `cartItems CartItem[]`.

- [ ] **Step 2: Generate the down-migration**

Run: `npx prisma migrate dev --name revert_checkout_cart_foundation`

Expected: Prisma detects the schema now matches the pre-session shape and generates a migration that drops the added tables/columns/enum values it can drop cleanly. Enum value removal in Postgres cannot be done via `ALTER TYPE ... DROP VALUE` — if Prisma's diff can't express the `OrderStatus` narrowing as a clean migration (this is a known Postgres limitation, the same reason the *addition* of these values needed the multi-statement `ALTER TYPE` in the original migration), it will likely require recreating the enum. Follow whatever Prisma proposes; if it refuses non-interactively the way `migrate dev` did earlier this session, write the migration file by hand (drop tables/columns, then `CREATE TYPE "OrderStatus_new" AS ENUM (...)`, `ALTER TABLE "Order" ALTER COLUMN status TYPE "OrderStatus_new" USING (status::text::"OrderStatus_new")`, `DROP TYPE "OrderStatus"`, `ALTER TYPE "OrderStatus_new" RENAME TO "OrderStatus"` — the standard Postgres enum-narrowing pattern) and apply with `npx prisma migrate deploy`, exactly as this session's own `payment_transaction_idempotency` migration was hand-written and deployed.

- [ ] **Step 3: Confirm the client regenerates cleanly**

Run: `npm run db:generate`
Expected: exits 0; `prisma/generated/prisma/models/Cart.ts`, `Payment.ts`, `Address.ts`, `CartItem.ts` no longer exist.

- [ ] **Step 4: Delete the superseded application code**

Delete `lib/api/cart-repository.ts`, `app/api/v1/cart/route.ts`, `app/api/v1/cart/route.test.ts`, `app/api/v1/cart/items/route.ts`, `app/api/v1/cart/items/route.test.ts`, `app/api/v1/cart/items/[productId]/route.ts`, `app/api/v1/cart/items/[productId]/route.test.ts`. Remove the now-empty `app/api/v1/cart/` directory tree if nothing remains in it.

- [ ] **Step 5: Revert `verify-code`**

In `app/api/auth/verify-code/route.ts`, remove the `mergeGuestCart` import and call, and the `cart` field on the success response — restore it to exactly the shape it had before this session (`{ success: true }`, no `cart`). In `lib/schemas.ts`, remove `verifyCodeWithCartSchema` and revert the route to importing `verifyCodeSchema` directly. Update `app/api/auth/verify-code/route.test.ts` to drop the `mergeGuestCart` mock and the two cart-related test cases, keeping the "invalid code" case; if that leaves fewer than a meaningful test file, it's fine to keep the trimmed file rather than delete it — it now documents the route's actual (simpler) behavior.

- [ ] **Step 6: Revert the exhaustive-map fixups**

In `lib/i18n/panel-dictionary.ts`, `components/director/order-status-badge.tsx`, `lib/admin/customer-timeline.ts`, remove the entries added for `PAYMENT_PENDING`, `PAYMENT_FAILED`, `PAID`, `PROCESSING`, `READY_FOR_SHIPMENT`, `SHIPPED`, `DELIVERED`, `REFUNDED` — back to exactly the five original `OrderStatus` values. In `lib/admin/customer-timeline.ts`'s `summariseValue`, remove the `&& order.status !== "REFUNDED"` clause (there is no `REFUNDED` status anymore). In `lib/admin/customer-timeline.test.ts`, remove the "ignores refunded orders too" test case added this session.

- [ ] **Step 7: Revert `order-status.ts` and its test**

Restore `lib/api/order-status.ts`'s `TRANSITIONS` map to:

```ts
const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  DRAFT: ["PENDING", "CANCELLED"],
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};
```

In `lib/api/order-status.test.ts`, remove the `describe("the online payment/fulfillment path", ...)` block and restore the `"walks a draft forward one step at a time"` assertion to its original two-and-three-element form (`["CONFIRMED", "CANCELLED"]` for `PENDING`, `["COMPLETED", "CANCELLED"]` for `CONFIRMED`).

- [ ] **Step 8: Revert `seller-scope.ts` and its test**

Restore `orderReadScope`/`orderWriteScope` in `lib/api/seller-scope.ts` to:

```ts
/** Orders are never pooled: one always belongs to the seller who raised it. */
export function orderReadScope(actor: ScopeActor): Prisma.OrderWhereInput {
  return isDirector(actor) ? {} : { sellerId: actor.id };
}

export function orderWriteScope(actor: ScopeActor): Prisma.OrderWhereInput {
  return orderReadScope(actor);
}
```

In `lib/api/seller-scope.test.ts`, restore the original `describe("order scopes", ...)` block (flat `{ sellerId }` expectations, no `OR`/`channel`).

- [ ] **Step 9: Verify everything still passes**

Run: `npm test`
Expected: PASS, same count as before this session's Plan 1 started (or fewer, accounting for deleted files) — no failures.

Run: `npx tsc --noEmit`
Expected: exits 0.

Run: `npm run build`
Expected: exits 0.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "revert: remove root-schema cart/payment work superseded by backend/ integration

This session's earlier commits (4bbb8c3..679cc1f) built the checkout
cart directly on this app's own Prisma schema before discovering
backend/ (NestJS) already has a more mature Order/Payment system and
an incomplete-but-documented plan to become the single source of
truth. Confirmed with the user: build forward on backend/ instead.
Reverting rather than leaving as a second, parallel cart system."
```

---

### Task 2: `Cart`/`CartItem` models in `backend/`

**Files:**
- Modify: `backend/prisma/schema.prisma`

**Interfaces:**
- Produces: `Cart` (`id`, `phone` unique, `items CartItem[]`, timestamps), `CartItem` (`id`, `cartId`, `productId`, `quantity`, `@@unique([cartId, productId])`) — same shape as the reverted root version, since the design (keyed by phone, no price stored) was sound; only its location was wrong.

- [ ] **Step 1: Add the models**

In `backend/prisma/schema.prisma`, add after the `Invoice` model:

```prisma
/// A phone-verified storefront visitor's cart. Keyed by phone rather than a
/// customer/user id — backend/ has no concept of a storefront visitor's
/// identity beyond what Next.js's OTP session asserts over the
/// InternalServiceGuard bridge (see CartsController), and a Customer row is
/// only created at checkout, not at cart time.
model Cart {
  id        String     @id @default(cuid())
  phone     String     @unique
  items     CartItem[]
  createdAt DateTime   @default(now()) @map("created_at")
  updatedAt DateTime   @updatedAt @map("updated_at")

  @@map("carts")
}

model CartItem {
  id        String   @id @default(cuid())
  cartId    String   @map("cart_id")
  cart      Cart     @relation(fields: [cartId], references: [id], onDelete: Cascade)
  productId String   @map("product_id")
  product   Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  quantity  Int

  @@unique([cartId, productId])
  @@map("cart_items")
}
```

In the `Product` model, add `cartItems CartItem[]` next to the existing `orderItems OrderItem[]` field.

- [ ] **Step 2: Migrate**

Run: `cd backend && npx prisma migrate dev --name add_cart`

Expected: applies against `backend/`'s own dev database (check `backend/.env`'s `DATABASE_URL` — this is a **separate** database from root's, confirm before running so this doesn't accidentally target the wrong Postgres instance). If the environment is non-interactive and refuses the way root's did earlier this session, use the same `migrate dev --create-only` fallback: hand-inspect the SQL it would generate is not possible non-interactively either (as discovered this session), so instead write the migration directory and SQL by hand (`CREATE TABLE carts (...)`, `CREATE TABLE cart_items (...)`, indexes, foreign keys — mirror the exact DDL Prisma would emit for this schema, matching the `snake_case`/`@map` naming already used throughout this file) and apply with `npx prisma migrate deploy`.

- [ ] **Step 3: Regenerate the client and verify**

Run: `cd backend && npx prisma generate && npx tsc --noEmit`
Expected: both exit 0.

- [ ] **Step 4: Commit**

```bash
git add backend/prisma
git commit -m "feat(backend): add Cart/CartItem models"
```

---

### Task 3: `CartsService` — pure merge logic + Prisma operations

**Files:**
- Create: `backend/src/carts/cart-merge.ts`
- Create: `backend/src/carts/cart-merge.spec.ts`
- Create: `backend/src/carts/carts.service.ts`
- Create: `backend/src/carts/carts.service.spec.ts`

**Interfaces:**
- Produces: `mergeCartItems(serverItems: CartItemRow[], guestItems: CartItemRow[]): CartItemRow[]` (pure, ported from root's now-deleted `lib/store/cart.ts` — same logic, ported rather than shared since the two apps don't share a package today). `CartItemRow = { productId: string; quantity: number }`. `CartsService.getCart(phone)`, `.setItem(phone, productId, quantity)`, `.removeItem(phone, productId)`, `.clear(phone)`, `.mergeGuest(phone, guestItems)` — all return `{ items: CartItemRow[] }`. Task 4's controller calls these directly.

- [ ] **Step 1: Write the failing test for the pure merge**

Create `backend/src/carts/cart-merge.spec.ts`:

```ts
import { mergeCartItems, MAX_QUANTITY } from './cart-merge';

describe('mergeCartItems', () => {
  it('unions two carts with no overlap', () => {
    const merged = mergeCartItems(
      [{ productId: 'p1', quantity: 2 }],
      [{ productId: 'p2', quantity: 3 }],
    );
    expect(merged).toEqual([
      { productId: 'p1', quantity: 2 },
      { productId: 'p2', quantity: 3 },
    ]);
  });

  it('sums quantities for a product in both carts instead of duplicating the line', () => {
    const merged = mergeCartItems(
      [{ productId: 'p1', quantity: 2 }],
      [{ productId: 'p1', quantity: 3 }],
    );
    expect(merged).toEqual([{ productId: 'p1', quantity: 5 }]);
  });

  it('caps the summed quantity at the maximum', () => {
    const merged = mergeCartItems(
      [{ productId: 'p1', quantity: 90 }],
      [{ productId: 'p1', quantity: 90 }],
    );
    expect(merged).toEqual([{ productId: 'p1', quantity: MAX_QUANTITY }]);
  });

  it('returns the server cart unchanged when the guest cart is empty', () => {
    const server = [{ productId: 'p1', quantity: 2 }];
    expect(mergeCartItems(server, [])).toEqual(server);
  });

  it('never mutates either input', () => {
    const server = [{ productId: 'p1', quantity: 2 }];
    const guest = [{ productId: 'p1', quantity: 3 }];
    mergeCartItems(server, guest);
    expect(server).toEqual([{ productId: 'p1', quantity: 2 }]);
    expect(guest).toEqual([{ productId: 'p1', quantity: 3 }]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd backend && npx jest src/carts/cart-merge.spec.ts`
Expected: FAIL — `./cart-merge` module does not exist.

- [ ] **Step 3: Implement the pure merge**

Create `backend/src/carts/cart-merge.ts`:

```ts
export interface CartItemRow {
  productId: string;
  quantity: number;
}

export const MIN_QUANTITY = 1;
export const MAX_QUANTITY = 99;

function clampQuantity(quantity: number): number {
  if (!Number.isFinite(quantity)) return MIN_QUANTITY;
  return Math.min(MAX_QUANTITY, Math.max(MIN_QUANTITY, Math.trunc(quantity)));
}

function addItem(
  items: readonly CartItemRow[],
  productId: string,
  quantity: number,
): CartItemRow[] {
  const existing = items.find((item) => item.productId === productId);
  if (!existing) {
    return [...items, { productId, quantity: clampQuantity(quantity) }];
  }
  return items.map((item) =>
    item.productId === productId
      ? { ...item, quantity: clampQuantity(item.quantity + quantity) }
      : item,
  );
}

/**
 * Folds a guest's localStorage cart into the server cart on login.
 *
 * Ported from the (removed) root app's lib/store/cart.ts — same logic, same
 * tests, moved here because the cart itself now lives in backend/. The two
 * apps don't share a package today (see common/phone.ts's own doc-comment
 * for the precedent), so this is a deliberate port, not an import.
 */
export function mergeCartItems(
  serverItems: readonly CartItemRow[],
  guestItems: readonly CartItemRow[],
): CartItemRow[] {
  return guestItems.reduce(
    (merged, item) => addItem(merged, item.productId, item.quantity),
    [...serverItems] as CartItemRow[],
  );
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd backend && npx jest src/carts/cart-merge.spec.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing test for `CartsService`**

First, check `backend/src/reviews/reviews.service.spec.ts` (or whichever `backend/src/**/*.service.spec.ts` exists) for the exact `PrismaService` mocking convention this codebase uses — do not invent a different one. Using that same pattern, create `backend/src/carts/carts.service.spec.ts` with cases for: `getCart` returns `{ items: [] }` for a phone with no cart row; `setItem` creates a cart if none exists and upserts the line; `removeItem` is a no-op (returns current state) when the phone has no cart at all; `mergeGuest` with an empty guest list returns the current cart without writing; `mergeGuest` with items calls the underlying upsert for the merged result.

- [ ] **Step 6: Run it to verify it fails**

Run: `cd backend && npx jest src/carts/carts.service.spec.ts`
Expected: FAIL — `./carts.service` does not exist.

- [ ] **Step 7: Implement `CartsService`**

Create `backend/src/carts/carts.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { mergeCartItems, type CartItemRow } from './cart-merge';

export interface CartResult {
  items: CartItemRow[];
}

@Injectable()
export class CartsService {
  constructor(private readonly prisma: PrismaService) {}

  async getCart(phone: string): Promise<CartResult> {
    const cart = await this.prisma.cart.findUnique({
      where: { phone },
      select: { items: { select: { productId: true, quantity: true } } },
    });
    return { items: cart?.items ?? [] };
  }

  private async getOrCreateCartId(phone: string): Promise<string> {
    const cart = await this.prisma.cart.upsert({
      where: { phone },
      create: { phone },
      update: {},
      select: { id: true },
    });
    return cart.id;
  }

  async setItem(
    phone: string,
    productId: string,
    quantity: number,
  ): Promise<CartResult> {
    const cartId = await this.getOrCreateCartId(phone);
    await this.prisma.cartItem.upsert({
      where: { cartId_productId: { cartId, productId } },
      create: { cartId, productId, quantity },
      update: { quantity },
    });
    return this.getCart(phone);
  }

  async removeItem(phone: string, productId: string): Promise<CartResult> {
    const cart = await this.prisma.cart.findUnique({
      where: { phone },
      select: { id: true },
    });
    if (cart) {
      await this.prisma.cartItem.deleteMany({
        where: { cartId: cart.id, productId },
      });
    }
    return this.getCart(phone);
  }

  async clear(phone: string): Promise<void> {
    const cart = await this.prisma.cart.findUnique({
      where: { phone },
      select: { id: true },
    });
    if (cart) {
      await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    }
  }

  async mergeGuest(
    phone: string,
    guestItems: readonly CartItemRow[],
  ): Promise<CartResult> {
    if (guestItems.length === 0) return this.getCart(phone);

    const server = await this.getCart(phone);
    const merged = mergeCartItems(server.items, guestItems);
    const cartId = await this.getOrCreateCartId(phone);

    await this.prisma.$transaction(
      merged.map((item) =>
        this.prisma.cartItem.upsert({
          where: { cartId_productId: { cartId, productId: item.productId } },
          create: { cartId, productId: item.productId, quantity: item.quantity },
          update: { quantity: item.quantity },
        }),
      ),
    );

    return { items: merged };
  }
}
```

- [ ] **Step 8: Run it to verify it passes**

Run: `cd backend && npx jest src/carts`
Expected: PASS for both spec files.

- [ ] **Step 9: Commit**

```bash
git add backend/src/carts
git commit -m "feat(backend): add CartsService with pure merge logic"
```

---

### Task 4: `CartsController` + DTOs, guarded by `InternalServiceGuard`

**Files:**
- Create: `backend/src/carts/dto/set-cart-item.dto.ts`
- Create: `backend/src/carts/dto/merge-cart.dto.ts`
- Create: `backend/src/carts/carts.controller.ts`
- Create: `backend/src/carts/carts.module.ts`
- Modify: `backend/src/app.module.ts` (register `CartsModule`)

**Interfaces:**
- Consumes: `InternalServiceGuard`, `VerifiedPhone` (`@/common/guards/internal-service.guard`, `@/common/decorators/verified-phone.decorator`), `CartsService` (Task 3).
- Produces: `GET /carts` (returns `{ items }`), `DELETE /carts` (clears, `204`), `PUT /carts/items` (body `{ productId, quantity }`, returns `{ items }`), `DELETE /carts/items/:productId` (returns `{ items }`), `POST /carts/merge` (body `{ items: [{productId, quantity}] }`, returns `{ items }`) — every route `@UseGuards(InternalServiceGuard)`, phone read via `@VerifiedPhone()`, never from the body. Task 6's Next.js proxy calls these exact paths.

- [ ] **Step 1: DTOs**

Create `backend/src/carts/dto/set-cart-item.dto.ts`:

```ts
import { IsInt, IsString, Max, Min } from 'class-validator';

export class SetCartItemDto {
  @IsString()
  productId: string;

  @IsInt()
  @Min(1)
  @Max(99)
  quantity: number;
}
```

Create `backend/src/carts/dto/merge-cart.dto.ts`:

```ts
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, ValidateNested } from 'class-validator';
import { SetCartItemDto } from './set-cart-item.dto';

export class MergeCartDto {
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => SetCartItemDto)
  items: SetCartItemDto[];
}
```

- [ ] **Step 2: Controller**

Create `backend/src/carts/carts.controller.ts`:

```ts
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { CartsService } from './carts.service';
import { SetCartItemDto } from './dto/set-cart-item.dto';
import { MergeCartDto } from './dto/merge-cart.dto';
import { InternalServiceGuard } from '../common/guards/internal-service.guard';
import { VerifiedPhone } from '../common/decorators/verified-phone.decorator';

/**
 * A phone-verified storefront visitor's cart. Every route requires the
 * internal-service HMAC proving the call came from Next.js's own
 * server-side code carrying an OTP-verified phone — see
 * InternalServiceGuard's doc comment. There is no guest/anonymous cart
 * here; that stays client-side (localStorage) in Next.js until login.
 */
@Controller('carts')
@UseGuards(InternalServiceGuard)
export class CartsController {
  constructor(private readonly carts: CartsService) {}

  @Get()
  getCart(@VerifiedPhone() phone: string) {
    return this.carts.getCart(phone);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  async clear(@VerifiedPhone() phone: string) {
    await this.carts.clear(phone);
  }

  @Put('items')
  setItem(@VerifiedPhone() phone: string, @Body() dto: SetCartItemDto) {
    return this.carts.setItem(phone, dto.productId, dto.quantity);
  }

  @Delete('items/:productId')
  removeItem(
    @VerifiedPhone() phone: string,
    @Param('productId') productId: string,
  ) {
    return this.carts.removeItem(phone, productId);
  }

  @Post('merge')
  merge(@VerifiedPhone() phone: string, @Body() dto: MergeCartDto) {
    return this.carts.mergeGuest(phone, dto.items);
  }
}
```

- [ ] **Step 3: Module**

Create `backend/src/carts/carts.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { CartsController } from './carts.controller';
import { CartsService } from './carts.service';

@Module({
  controllers: [CartsController],
  providers: [CartsService],
})
export class CartsModule {}
```

- [ ] **Step 4: Register in `AppModule`**

In `backend/src/app.module.ts`, add `import { CartsModule } from './carts/carts.module';` and add `CartsModule` to the `imports` array (next to `ReviewsModule` is a reasonable spot, alphabetical-ish ordering already isn't strict here — match whatever loose grouping exists).

- [ ] **Step 5: Verify it compiles and boots**

Run: `cd backend && npx tsc --noEmit`
Expected: exits 0.

Run: `cd backend && npm run build`
Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add backend/src/carts backend/src/app.module.ts
git commit -m "feat(backend): add CartsController guarded by InternalServiceGuard"
```

---

### Task 5: Next.js proxy — `internal-backend.ts` phone-signing + `/api/v1/cart*` rewrite

**Files:**
- Modify: `lib/api/internal-backend.ts`
- Create: `app/api/v1/cart/route.ts`
- Create: `app/api/v1/cart/route.test.ts`
- Create: `app/api/v1/cart/items/route.ts`
- Create: `app/api/v1/cart/items/route.test.ts`
- Create: `app/api/v1/cart/items/[productId]/route.ts`
- Create: `app/api/v1/cart/items/[productId]/route.test.ts`
- Modify: `app/api/auth/verify-code/route.ts`
- Modify: `app/api/auth/verify-code/route.test.ts`

**Interfaces:**
- Consumes: `getSession` (`@/lib/auth/session`), the new `callBackendCart` helper.
- Produces: `callBackendCart<T>(phone: string, path: string, options): Promise<T>` in `lib/api/internal-backend.ts`, signing with the **phone-carrying** HMAC (`x-verified-phone`, `x-service-timestamp`, `x-service-signature` over `` `${phone}:${timestamp}` ``, matching `InternalServiceGuard`'s expected format exactly — this is a different signature shape from the existing `sign(timestamp)` used for the director-only AI calls, which signs `` `internal-request:${timestamp}` `` with no phone; do not conflate the two). Every Next.js `/api/v1/cart*` route becomes a thin translation layer with no business logic of its own.

- [ ] **Step 1: Extend `internal-backend.ts`**

Add to `lib/api/internal-backend.ts` (keep the existing `sign`/`callBackendInternal` for the AI routes untouched — this is a new, separate function, not a replacement):

```ts
function signWithPhone(phone: string, timestamp: string): string {
  const secret = process.env.INTERNAL_SERVICE_SECRET;
  if (!secret) {
    throw new Error("INTERNAL_SERVICE_SECRET is not set");
  }
  return createHmac("sha256", secret).update(`${phone}:${timestamp}`).digest("hex");
}

/**
 * Calls `backend/`'s phone-verified endpoints (currently just `carts/*`),
 * signing the way `InternalServiceGuard` expects: an HMAC over `phone:timestamp`,
 * not `internal-request:timestamp` — a different signature shape from
 * `callBackendInternal` above, matching the reviews module's existing
 * InternalServiceGuard-gated routes.
 */
export async function callBackendPhoneVerified<T>(
  phone: string,
  path: string,
  options: { method?: "GET" | "PUT" | "POST" | "DELETE"; body?: unknown } = {},
): Promise<T> {
  const base = process.env.NEXT_PUBLIC_API_URL;
  if (!base) {
    throw new Error("NEXT_PUBLIC_API_URL is not set");
  }

  const timestamp = String(Date.now());

  const response = await fetch(base + "/api/" + path, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      "x-verified-phone": phone,
      "x-service-timestamp": timestamp,
      "x-service-signature": signWithPhone(phone, timestamp),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new InternalBackendError(text || response.statusText, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
```

- [ ] **Step 2: Confirm it compiles**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 3: Write the failing route tests**

Create `app/api/v1/cart/route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();
vi.mock("@/lib/auth/session", () => ({ getSession: () => getSession() }));

const callBackendPhoneVerified = vi.fn();
vi.mock("@/lib/api/internal-backend", () => ({
  callBackendPhoneVerified: (...args: unknown[]) => callBackendPhoneVerified(...args),
}));

vi.mock("@/lib/auth/dal", () => ({ getStaffUser: vi.fn() }));

const { GET, DELETE } = await import("./route");

beforeEach(() => {
  getSession.mockReset();
  callBackendPhoneVerified.mockReset();
});

describe("GET /api/v1/cart", () => {
  it("answers 401 with no session", async () => {
    getSession.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    expect(callBackendPhoneVerified).not.toHaveBeenCalled();
  });

  it("proxies to backend/ carts and returns its items", async () => {
    getSession.mockResolvedValue({ phone: "998901234567" });
    callBackendPhoneVerified.mockResolvedValue({ items: [{ productId: "p1", quantity: 2 }] });

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      items: [{ productId: "p1", quantity: 2 }],
    });
    expect(callBackendPhoneVerified).toHaveBeenCalledWith("998901234567", "carts");
  });
});

describe("DELETE /api/v1/cart", () => {
  it("answers 401 with no session", async () => {
    getSession.mockResolvedValue(null);
    expect((await DELETE()).status).toBe(401);
  });

  it("proxies the clear", async () => {
    getSession.mockResolvedValue({ phone: "998901234567" });
    const response = await DELETE();
    expect(response.status).toBe(200);
    expect(callBackendPhoneVerified).toHaveBeenCalledWith("998901234567", "carts", {
      method: "DELETE",
    });
  });
});
```

Create `app/api/v1/cart/items/route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();
vi.mock("@/lib/auth/session", () => ({ getSession: () => getSession() }));

const callBackendPhoneVerified = vi.fn();
vi.mock("@/lib/api/internal-backend", () => ({
  callBackendPhoneVerified: (...args: unknown[]) => callBackendPhoneVerified(...args),
}));

vi.mock("@/lib/auth/dal", () => ({ getStaffUser: vi.fn() }));

const { PUT } = await import("./route");

function put(body: unknown): Request {
  return new Request("http://localhost/api/v1/cart/items", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  getSession.mockReset();
  callBackendPhoneVerified.mockReset();
  callBackendPhoneVerified.mockResolvedValue({ items: [{ productId: "p1", quantity: 2 }] });
});

describe("PUT /api/v1/cart/items", () => {
  it("answers 401 with no session", async () => {
    getSession.mockResolvedValue(null);
    expect((await PUT(put({ productId: "p1", quantity: 2 }))).status).toBe(401);
  });

  it("proxies the set and returns the updated cart", async () => {
    getSession.mockResolvedValue({ phone: "998901234567" });

    const response = await PUT(put({ productId: "p1", quantity: 2 }));

    expect(response.status).toBe(200);
    expect(callBackendPhoneVerified).toHaveBeenCalledWith("998901234567", "carts/items", {
      method: "PUT",
      body: { productId: "p1", quantity: 2 },
    });
    expect(await response.json()).toEqual({
      success: true,
      items: [{ productId: "p1", quantity: 2 }],
    });
  });

  it("answers 400 for a quantity below one", async () => {
    getSession.mockResolvedValue({ phone: "998901234567" });
    expect((await PUT(put({ productId: "p1", quantity: 0 }))).status).toBe(400);
  });

  it("answers 400 for a missing productId", async () => {
    getSession.mockResolvedValue({ phone: "998901234567" });
    expect((await PUT(put({ quantity: 2 }))).status).toBe(400);
  });
});
```

Create `app/api/v1/cart/items/[productId]/route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();
vi.mock("@/lib/auth/session", () => ({ getSession: () => getSession() }));

const callBackendPhoneVerified = vi.fn();
vi.mock("@/lib/api/internal-backend", () => ({
  callBackendPhoneVerified: (...args: unknown[]) => callBackendPhoneVerified(...args),
}));

vi.mock("@/lib/auth/dal", () => ({ getStaffUser: vi.fn() }));

const { DELETE } = await import("./route");

function params(productId: string) {
  return { params: Promise.resolve({ productId }) };
}

beforeEach(() => {
  getSession.mockReset();
  callBackendPhoneVerified.mockReset();
  callBackendPhoneVerified.mockResolvedValue({ items: [] });
});

describe("DELETE /api/v1/cart/items/:productId", () => {
  it("answers 401 with no session", async () => {
    getSession.mockResolvedValue(null);
    expect((await DELETE(new Request("http://localhost"), params("p1"))).status).toBe(401);
  });

  it("proxies the removal", async () => {
    getSession.mockResolvedValue({ phone: "998901234567" });
    const response = await DELETE(new Request("http://localhost"), params("p1"));
    expect(response.status).toBe(200);
    expect(callBackendPhoneVerified).toHaveBeenCalledWith("998901234567", "carts/items/p1", {
      method: "DELETE",
    });
  });
});
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `npx vitest run app/api/v1/cart`
Expected: FAIL — the route files under test do not exist.

- [ ] **Step 5: Implement the routes**

Create `app/api/v1/cart/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { callBackendPhoneVerified } from "@/lib/api/internal-backend";
import { apiError } from "@/lib/api/route-auth";

interface CartResult {
  items: { productId: string; quantity: number }[];
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return apiError(401, "Sign in to continue.");
  }

  const cart = await callBackendPhoneVerified<CartResult>(session.phone, "carts");
  return NextResponse.json({ success: true, items: cart.items });
}

export async function DELETE() {
  const session = await getSession();
  if (!session) {
    return apiError(401, "Sign in to continue.");
  }

  await callBackendPhoneVerified(session.phone, "carts", { method: "DELETE" });
  return NextResponse.json({ success: true });
}
```

Create `app/api/v1/cart/items/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { callBackendPhoneVerified } from "@/lib/api/internal-backend";
import { apiError, parseJsonBody } from "@/lib/api/route-auth";
import { cartSetItemSchema } from "@/lib/schemas";

interface CartResult {
  items: { productId: string; quantity: number }[];
}

export async function PUT(request: Request) {
  const session = await getSession();
  if (!session) {
    return apiError(401, "Sign in to continue.");
  }

  const body = await parseJsonBody(request, cartSetItemSchema);
  if (!body.ok) {
    return body.response;
  }

  const cart = await callBackendPhoneVerified<CartResult>(session.phone, "carts/items", {
    method: "PUT",
    body: body.data,
  });
  return NextResponse.json({ success: true, items: cart.items });
}
```

Create `app/api/v1/cart/items/[productId]/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { callBackendPhoneVerified } from "@/lib/api/internal-backend";
import { apiError } from "@/lib/api/route-auth";

interface CartResult {
  items: { productId: string; quantity: number }[];
}

interface RouteContext {
  params: Promise<{ productId: string }>;
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const session = await getSession();
  if (!session) {
    return apiError(401, "Sign in to continue.");
  }

  const { productId } = await params;
  const cart = await callBackendPhoneVerified<CartResult>(
    session.phone,
    `carts/items/${productId}`,
    { method: "DELETE" },
  );
  return NextResponse.json({ success: true, items: cart.items });
}
```

Re-add `cartSetItemSchema` to `lib/schemas.ts` (it was removed in Task 1's revert):

```ts
/** One line as the client posts it — no price, no name; backend/ owns those. */
export const cartSetItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(1).max(99),
});

export type CartSetItemInput = z.infer<typeof cartSetItemSchema>;
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run app/api/v1/cart`
Expected: PASS.

- [ ] **Step 7: Wire the merge into `verify-code`**

Re-add to `lib/schemas.ts` (also removed in Task 1's revert):

```ts
export const cartMergeSchema = z.object({
  items: z.array(cartSetItemSchema).max(200),
});

export type CartMergeInput = z.infer<typeof cartMergeSchema>;

export const verifyCodeWithCartSchema = verifyCodeSchema.extend({
  cart: cartMergeSchema.optional(),
});

export type VerifyCodeWithCartInput = z.infer<typeof verifyCodeWithCartSchema>;
```

Modify `app/api/auth/verify-code/route.ts`: replace the `verifyCodeSchema` import/usage with `verifyCodeWithCartSchema`, and after the `verifyCode(...)` success check, add:

```ts
  const cart = await callBackendPhoneVerified<{ items: { productId: string; quantity: number }[] }>(
    phone,
    "carts/merge",
    { method: "POST", body: { items: parsed.data.cart?.items ?? [] } },
  );
```

then include `cart` in the success `NextResponse.json({ success: true, cart })`, and add the `callBackendPhoneVerified` import from `@/lib/api/internal-backend`.

Restore the two cart-merge test cases in `app/api/auth/verify-code/route.test.ts` (removed in Task 1), this time mocking `@/lib/api/internal-backend`'s `callBackendPhoneVerified` instead of `@/lib/api/cart-repository`'s `mergeGuestCart`:

```ts
const callBackendPhoneVerified = vi.fn();
vi.mock("@/lib/api/internal-backend", () => ({
  callBackendPhoneVerified: (...args: unknown[]) => callBackendPhoneVerified(...args),
}));
```

with `callBackendPhoneVerified.mockResolvedValue({ items: [{ productId: "p1", quantity: 5 }] })` in `beforeEach`, and assertions of the form `expect(callBackendPhoneVerified).toHaveBeenCalledWith("998901234567", "carts/merge", { method: "POST", body: { items: [...] } })`.

- [ ] **Step 8: Run the full verify-code test**

Run: `npx vitest run app/api/auth/verify-code/route.test.ts`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add lib/api/internal-backend.ts lib/schemas.ts app/api/v1/cart app/api/auth/verify-code
git commit -m "feat(cart): proxy /api/v1/cart* through backend/'s CartsController"
```

---

### Task 6: End-to-end verification against a running `backend/`

This task has no code changes — it is the check that Task 5's Global Constraint ("not done until a real request reaches backend/'s database and back") is actually met, the way the Reviews/Inquiries modules apparently never were.

- [ ] **Step 1: Start `backend/` locally**

Run: `cd backend && npm run start:dev` (background/separate terminal — leave running for the rest of this task)
Expected: boots without error, listening on whatever port `backend/.env`/`main.ts` configures (check `main.ts` for the port and confirm it matches root's `NEXT_PUBLIC_API_URL`).

- [ ] **Step 2: Confirm `INTERNAL_SERVICE_SECRET` matches on both sides**

Run: `grep INTERNAL_SERVICE_SECRET .env.local backend/.env` (or the platform-appropriate equivalent) — both must be set to the exact same value. If either is empty, this whole plan is unverifiable until it's filled in; stop and report rather than guessing a value.

- [ ] **Step 3: Call `backend/`'s cart endpoint directly with a hand-signed request**

Using a short Node one-liner or `curl` with a manually computed HMAC (`node -e "console.log(require('crypto').createHmac('sha256', process.env.INTERNAL_SERVICE_SECRET).update('998900000000:' + Date.now()).digest('hex'))"` style), issue a `PUT http://localhost:<port>/api/carts/items` with a `{productId, quantity}` body for a real seeded product id (check `backend/prisma/seed.ts` or query for one) and the matching `x-verified-phone`/`x-service-timestamp`/`x-service-signature` headers.

Expected: `200` with `{ items: [...] }` reflecting the write. Then `GET /api/carts` with the same headers returns the same line — confirming the row actually persisted in `backend/`'s Postgres, not just that the handler ran.

- [ ] **Step 4: Call it through Next.js**

Start the root app's dev server (`npm run dev`) alongside `backend/`'s. Obtain a real session cookie by completing the OTP flow against a test phone (or reuse an existing dev session if one is already logged in). Issue `PUT http://localhost:3000/api/v1/cart/items` with that cookie and a `{productId, quantity}` body.

Expected: `200`, and a follow-up `GET http://localhost:3000/api/v1/cart` with the same cookie returns the line — proving the full chain (Next.js route → HMAC-signed call → `backend/` → Postgres → back) actually works, not just that each side's unit tests pass in isolation.

- [ ] **Step 5: Report the result plainly**

State which of Steps 1–4 passed and which didn't, with the actual response bodies/status codes observed — this is the evidence the Global Constraint asked for, not a restatement of intent.

---

## Self-Review Notes

- **Spec coverage:** This plan covers exactly what Plan 1 covered (server cart + guest merge), relocated to the correct architecture. Checkout order creation, payment providers (Payme/Click — still blocked on Click's signature formula per this session's research), checkout UI, and account/admin surfacing remain future plans, same as noted in the superseded Plan 1.
- **Placeholder scan:** no TBD/TODO; every step has real code or a concrete verification action.
- **Type consistency:** `CartItemRow { productId, quantity }` used identically in `backend/`'s `cart-merge.ts`, `carts.service.ts`, and the Next.js proxy's `CartResult` type — no translation layer needed when Plan 3 (checkout) builds on this.
