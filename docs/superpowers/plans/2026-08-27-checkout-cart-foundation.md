# Checkout Cart & Order Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the schema and build the server-side cart so a logged-in (phone-verified) shopper's cart lives in Postgres, a guest's cart merges into it on login, and the `Order` model can represent a self-checkout purchase alongside the existing seller-raised one — without breaking the seller/discount/audit pipeline that already exists.

**Architecture:** This is the first of several plans covering the full checkout system (schema/cart → checkout order creation + payment → checkout UI → account/admin surfacing). It only touches the backend: Prisma schema, pure logic (order-status transitions, seller-scope, cart merge), a `cart-repository`, and `/api/v1/cart*` routes. No new UI. The existing seller-driven `Order` flow (`DRAFT → PENDING → CONFIRMED → COMPLETED`) is left completely intact; this plan only *adds* enum values, fields and transition edges for a second, `ONLINE`-channel path through the same table, plus new `Payment`, `Address`, `Cart` and `CartItem` models.

**Tech Stack:** Next.js 16 App Router, Prisma 7 (`prisma-client` generator, `@prisma/adapter-pg`), Zod 4, Vitest 4, existing `lib/auth` phone/session system (JWT cookie keyed by canonical phone, e.g. `"998901234567"`).

**Spec:** The original prompt is a generic e-commerce spec (Cart/CartItem/Order/Payment/Quote models, `/api/v1/...` routes, guest+server cart with login-merge). It was reconciled against the actual codebase, which is a B2B seller-driven sales system (`Order` raised by staff for a CRM `Customer`, `Inquiry` as the lead/quote pipeline, no customer login beyond an OTP session used for reviews). Reconciliation decisions, confirmed by the user:
1. Extend the existing `Order` model rather than create a parallel one.
2. Customer auth = the existing phone/OTP session (`lib/auth/session.ts`), not a new email+password system.
3. "Request a Quote" in checkout reuses the existing `Inquiry` pipeline (source `QUOTE_FORM`) — no new `Quote` model.
4. Payment providers: Payme and Click (the two dominant gateways in Uzbekistan), architected behind a provider interface with real webhook handling; this plan does not implement the providers themselves (that's Plan 2) but the schema anticipates them (`Payment.provider`, `Payment.transactionId`).

## Global Constraints

- Every function stays under ~30 lines; split helpers rather than growing one.
- No new abstraction beyond what a task needs (YAGNI) — follow the existing repository/route/schema layering exactly as `order-repository.ts` / `orders/route.ts` / `lib/schemas.ts` already do it.
- `unitPrice`/product pricing is always snapshotted server-side, never trusted from the client — same rule `buildLines()` in `lib/api/order-repository.ts:271` already enforces; the cart never stores a price.
- Money fields are `Decimal(14, 2)`; use `roundMoney` from `lib/api/order-money.ts` wherever a total is computed.
- Every new repository/route follows the existing test style: pure logic gets a real unit test (`describe`/`it`, Vitest), routes get a test that mocks the repository (see `app/api/v1/orders/route.test.ts`). Repository files that only wrap Prisma calls are not directly unit-tested against a live DB anywhere in this codebase — don't start now.
- Run `npm test`, `npm run lint`, and `npm run build` after every task; all three must be clean before moving to the next task.

---

## File Structure

| File | Responsibility |
|---|---|
| `prisma/schema.prisma` | New enums (`OrderChannel`, `PaymentMethod`, `PaymentStatus`, `DeliveryMethod`), new `Payment`/`Address`/`Cart`/`CartItem` models, new fields on `Order`/`Customer`/`Product`. |
| `lib/api/order-status.ts` | Extended `TRANSITIONS` map for the online payment/fulfillment path. |
| `lib/api/order-status.test.ts` | New test cases for the online path; existing staff-path tests untouched. |
| `lib/api/seller-scope.ts` | `orderReadScope`/`orderWriteScope` widened so any staff member (not just the owning seller) can see/manage `ONLINE`-channel orders — mirrors the existing "unclaimed pool" pattern used for `Customer`/`Inquiry`. |
| `lib/api/seller-scope.test.ts` | Updated/added cases for the new order scope behavior. |
| `lib/store/cart.ts` | New pure `mergeCartItems()` function. |
| `lib/store/cart.test.ts` | New test cases for the merge. |
| `lib/api/cart-repository.ts` | New file. Server-side cart CRUD, keyed by canonical phone. |
| `lib/schemas.ts` | New Zod schemas: `cartSetItemSchema`, `cartItemParamSchema`. |
| `app/api/v1/cart/route.ts` | New file. `GET` (read cart, merging in a guest cart if provided) and `DELETE` (clear). |
| `app/api/v1/cart/items/route.ts` | New file. `POST` — add/top-up a line. |
| `app/api/v1/cart/items/[productId]/route.ts` | New file. `PATCH` (set quantity), `DELETE` (remove line). |
| `app/api/v1/cart/route.test.ts`, `app/api/v1/cart/items/route.test.ts`, `app/api/v1/cart/items/[productId]/route.test.ts` | Route tests, repository mocked. |
| `app/api/auth/verify-code/route.ts` | Modified: after a successful code, merges any guest cart items the client sent into the server cart for that phone. |
| `app/api/auth/verify-code/route.test.ts` | New file (none exists today) covering the merge-on-login behavior. |

---

### Task 1: Schema — enums, models, and `Order`/`Customer`/`Product` fields

**Files:**
- Modify: `prisma/schema.prisma`
- Migration: generated by `prisma migrate dev` (do not hand-write the SQL)

**Interfaces:**
- Produces: `OrderChannel` (`STAFF`, `ONLINE`), `PaymentMethod` (`ONLINE`, `BANK_TRANSFER`), `PaymentStatus` (`PENDING`, `SUCCESS`, `FAILED`, `PENDING_VERIFICATION`), `DeliveryMethod` (`STANDARD`, `EXPRESS`, `PICKUP`) enums; `Payment`, `Address`, `Cart`, `CartItem` models; new `Order` fields `channel`, `paymentMethod`, `paymentStatus`, `deliveryMethod`, `deliveryFee`, `addressId`, `payments`; new `Customer.addresses`; new `Product.cartItems`. Every later task in this plan and in Plan 2 relies on these exact names.

- [ ] **Step 1: Add the new enums**

In `prisma/schema.prisma`, right after the existing `enum DiscountStatus { ... }` block (around line 221), add:

```prisma
enum OrderChannel {
  STAFF
  ONLINE
}

enum PaymentMethod {
  ONLINE
  BANK_TRANSFER
}

enum PaymentStatus {
  PENDING
  SUCCESS
  FAILED
  PENDING_VERIFICATION
}

enum DeliveryMethod {
  STANDARD
  EXPRESS
  PICKUP
}
```

Extend the existing `OrderStatus` enum (around line 209) to add the online payment/fulfillment states, keeping every existing value in place and in order:

```prisma
enum OrderStatus {
  DRAFT
  PENDING
  PAYMENT_PENDING
  PAYMENT_FAILED
  PAID
  CONFIRMED
  PROCESSING
  READY_FOR_SHIPMENT
  SHIPPED
  DELIVERED
  COMPLETED
  CANCELLED
  REFUNDED
}
```

- [ ] **Step 2: Add fields to `Order`**

In the `Order` model, add (after the existing `inquiry` relation line, before `items`):

```prisma
  channel                  OrderChannel      @default(STAFF)
  paymentMethod            PaymentMethod?
  paymentStatus            PaymentStatus?
  deliveryMethod           DeliveryMethod?
  /// Added on top of totalAmount at checkout time; never folded into it, so
  /// totalAmount keeps meaning exactly what the discount math already expects.
  deliveryFee              Decimal           @default(0) @db.Decimal(14, 2)
  addressId                String?
  address                  Address?          @relation(fields: [addressId], references: [id], onDelete: SetNull)
  payments                 Payment[]
```

Add an index for filtering the online-order queue:

```prisma
  @@index([channel, status])
```

- [ ] **Step 3: Add the `Payment` model**

Add after the `DiscountRequest` model:

```prisma
/// A payment attempt against an order. An order may have more than one row
/// here — a failed card attempt followed by a retry, for instance — so the
/// order's own paymentStatus (the current answer) is distinct from a payment
/// row's status (that attempt's answer).
model Payment {
  id            String        @id @default(cuid())
  orderId       String
  order         Order         @relation(fields: [orderId], references: [id], onDelete: Cascade)
  method        PaymentMethod
  amount        Decimal       @db.Decimal(14, 2)
  status        PaymentStatus @default(PENDING)
  /// "payme" | "click", null for a bank transfer.
  provider      String?
  /// The provider's own id for this attempt. Only the provider's webhook may
  /// ever move a payment to SUCCESS — see lib/api/payment-webhook.ts in the
  /// next plan.
  transactionId String?
  /// Bank-transfer receipt upload (Vercel Blob URL), null for online payments.
  receiptUrl    String?
  paidAt        DateTime?
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt

  @@index([orderId])
  @@index([status])
  @@index([provider, transactionId])
}
```

- [ ] **Step 4: Add the `Address` model, and `Customer.addresses`**

Add after `Payment`:

```prisma
model Address {
  id         String   @id @default(cuid())
  customerId String
  customer   Customer @relation(fields: [customerId], references: [id], onDelete: Cascade)
  /// Optional nickname ("Home", "Warehouse #2"); not required by checkout.
  label      String?
  country    String
  region     String
  city       String
  line       String
  postalCode String?
  isDefault  Boolean  @default(false)
  createdAt  DateTime @default(now())
  orders     Order[]

  @@index([customerId])
}
```

In the `Customer` model, add `addresses Address[]` next to the existing `orders Order[]` field.

- [ ] **Step 5: Add `Cart`/`CartItem`, and `Product.cartItems`**

Add after `Address`:

```prisma
/// A logged-in shopper's cart, one row per phone. There is no customer login
/// beyond the OTP session (lib/auth/session.ts) today, so phone — the same
/// identity a session already carries — is the only key available; it is not
/// linked to Customer because a Customer row is only created at checkout.
model Cart {
  id        String     @id @default(cuid())
  phone     String     @unique
  items     CartItem[]
  createdAt DateTime   @default(now())
  updatedAt DateTime   @updatedAt
}

model CartItem {
  id        String   @id @default(cuid())
  cartId    String
  cart      Cart     @relation(fields: [cartId], references: [id], onDelete: Cascade)
  productId String
  product   Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  quantity  Int

  @@unique([cartId, productId])
}
```

In the `Product` model, add `cartItems CartItem[]` next to the existing `orderItems OrderItem[]` field.

- [ ] **Step 6: Generate and apply the migration**

Run: `npm run db:migrate -- --name checkout_cart_foundation`

Expected: Prisma prints the new SQL file under `prisma/migrations/`, applies it to the dev database from `DATABASE_URL` in `.env.local`, and regenerates the client (via the `postinstall`/migrate hook). If it fails because the dev database is unreachable, stop and report the exact error rather than hand-writing SQL around it.

- [ ] **Step 7: Confirm the generated client compiles**

Run: `npm run db:generate`
Expected: exits 0, and `prisma/generated/prisma/models/Cart.ts`, `Payment.ts`, `Address.ts`, `CartItem.ts` exist.

- [ ] **Step 8: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(db): add Cart/CartItem/Payment/Address models and extend Order for self-checkout"
```

---

### Task 2: Extend the `OrderStatus` transition table for the online path

**Files:**
- Modify: `lib/api/order-status.ts`
- Test: `lib/api/order-status.test.ts`

**Interfaces:**
- Consumes: `OrderStatus` enum from `@/prisma/generated/prisma/enums` (extended in Task 1).
- Produces: same exports as today — `allowedTransitions`, `canTransition`, `isTerminal`, `isEditable` — now covering the full enum. Plan 2's checkout/payment-webhook code transitions orders through this table exclusively, the same way `order-repository.ts` already does.

- [ ] **Step 1: Write the failing tests**

Add to `lib/api/order-status.test.ts`, inside the existing `describe("allowedTransitions", ...)` block area (new `describe` blocks, appended at the end of the file):

```ts
describe("the online payment/fulfillment path", () => {
  it("starts a paid checkout at PENDING, same as a staff order", () => {
    expect(canTransition("PENDING", "PAYMENT_PENDING")).toBe(true);
  });

  it("moves a payment attempt to PAID or PAYMENT_FAILED", () => {
    expect(canTransition("PAYMENT_PENDING", "PAID")).toBe(true);
    expect(canTransition("PAYMENT_PENDING", "PAYMENT_FAILED")).toBe(true);
  });

  it("lets a failed payment retry or give up", () => {
    expect(canTransition("PAYMENT_FAILED", "PAYMENT_PENDING")).toBe(true);
    expect(canTransition("PAYMENT_FAILED", "CANCELLED")).toBe(true);
  });

  it("walks a paid order through fulfillment one step at a time", () => {
    expect(canTransition("PAID", "CONFIRMED")).toBe(true);
    expect(canTransition("CONFIRMED", "PROCESSING")).toBe(true);
    expect(canTransition("PROCESSING", "READY_FOR_SHIPMENT")).toBe(true);
    expect(canTransition("READY_FOR_SHIPMENT", "SHIPPED")).toBe(true);
    expect(canTransition("SHIPPED", "DELIVERED")).toBe(true);
  });

  it("refuses to skip a fulfillment step", () => {
    expect(canTransition("PAID", "SHIPPED")).toBe(false);
    expect(canTransition("CONFIRMED", "DELIVERED")).toBe(false);
  });

  it("allows a refund from PAID or DELIVERED, and nothing from REFUNDED", () => {
    expect(canTransition("PAID", "REFUNDED")).toBe(true);
    expect(canTransition("DELIVERED", "REFUNDED")).toBe(true);
    expect(allowedTransitions("REFUNDED")).toEqual([]);
    expect(isTerminal("REFUNDED")).toBe(true);
  });

  it("keeps the fulfillment stages editable-frozen, same as CONFIRMED today", () => {
    expect(isEditable("PAYMENT_PENDING")).toBe(false);
    expect(isEditable("PAID")).toBe(false);
    expect(isEditable("SHIPPED")).toBe(false);
  });

  it("leaves the original staff path exactly as it was", () => {
    expect(allowedTransitions("DRAFT")).toEqual(["PENDING", "CANCELLED"]);
    expect(canTransition("DRAFT", "PAYMENT_PENDING")).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run lib/api/order-status.test.ts`
Expected: FAIL — `PAYMENT_PENDING` etc. are not yet valid transition targets (the `TRANSITIONS` map has no entries for them).

- [ ] **Step 3: Implement the extended transition table**

Replace the `TRANSITIONS` map in `lib/api/order-status.ts`:

```ts
const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  DRAFT: ["PENDING", "CANCELLED"],
  // PENDING is shared by both paths: a staff order moves straight to
  // CONFIRMED; a checkout order steps into PAYMENT_PENDING instead.
  PENDING: ["CONFIRMED", "PAYMENT_PENDING", "CANCELLED"],
  PAYMENT_PENDING: ["PAID", "PAYMENT_FAILED"],
  PAYMENT_FAILED: ["PAYMENT_PENDING", "CANCELLED"],
  PAID: ["CONFIRMED", "REFUNDED"],
  CONFIRMED: ["PROCESSING", "COMPLETED", "CANCELLED"],
  PROCESSING: ["READY_FOR_SHIPMENT", "CANCELLED"],
  READY_FOR_SHIPMENT: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: ["REFUNDED"],
  COMPLETED: [],
  CANCELLED: [],
  REFUNDED: [],
};

/** Statuses from which an order may still be edited rather than only moved. */
const EDITABLE: readonly OrderStatus[] = ["DRAFT", "PENDING"];
```

(`EDITABLE` is unchanged — leaving it here only so the next step's diff is obvious; do not duplicate the declaration.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run lib/api/order-status.test.ts`
Expected: PASS, including every pre-existing test in the file (staff path unchanged).

- [ ] **Step 5: Commit**

```bash
git add lib/api/order-status.ts lib/api/order-status.test.ts
git commit -m "feat(orders): extend status transitions for the online payment/fulfillment path"
```

---

### Task 3: Widen order visibility for the `ONLINE` channel

**Files:**
- Modify: `lib/api/seller-scope.ts`
- Test: `lib/api/seller-scope.test.ts`

**Interfaces:**
- Consumes: `ScopeActor` (unchanged).
- Produces: `orderReadScope`/`orderWriteScope` now return an `OR` filter for a non-director actor instead of a flat `{ sellerId }` filter. `order-repository.ts`'s `listOrders`/`getOrder`/`updateOrder`/`requestOrderDiscount` already call these functions and need no changes — they consume whatever `Prisma.OrderWhereInput` comes back.

- [ ] **Step 1: Write the failing test**

In `lib/api/seller-scope.test.ts`, replace the `describe("order scopes", ...)` block:

```ts
describe("order scopes", () => {
  it("shows a seller their own orders plus every ONLINE-channel order", () => {
    // A self-checkout order has no seller relationship to hand it to, so it
    // reads like the Customer/Inquiry pool: visible and workable by any
    // seller, not locked to whoever happens to own the sellerId column.
    expect(orderReadScope(seller)).toEqual({
      OR: [{ sellerId: "seller-1" }, { channel: "ONLINE" }],
    });
    expect(orderWriteScope(seller)).toEqual({
      OR: [{ sellerId: "seller-1" }, { channel: "ONLINE" }],
    });
  });

  it("shows a director every order", () => {
    expect(orderReadScope(director)).toEqual({});
    expect(orderWriteScope(director)).toEqual({});
  });

  it("reads and writes orders through the same filter", () => {
    expect(orderWriteScope(seller)).toEqual(orderReadScope(seller));
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/api/seller-scope.test.ts`
Expected: FAIL — `orderReadScope(seller)` still returns `{ sellerId: "seller-1" }`.

- [ ] **Step 3: Implement**

In `lib/api/seller-scope.ts`, replace:

```ts
/** Orders are never pooled: one always belongs to the seller who raised it. */
export function orderReadScope(actor: ScopeActor): Prisma.OrderWhereInput {
  return isDirector(actor) ? {} : { sellerId: actor.id };
}

export function orderWriteScope(actor: ScopeActor): Prisma.OrderWhereInput {
  return orderReadScope(actor);
}
```

with:

```ts
/**
 * A staff-raised order still belongs to the seller who raised it. A
 * self-checkout order (channel ONLINE) has no such relationship to start
 * with — it is assigned to a house account purely so sellerId stays required
 * — so it is pooled for every seller instead, the same way an unclaimed
 * Customer or Inquiry is.
 */
export function orderReadScope(actor: ScopeActor): Prisma.OrderWhereInput {
  return isDirector(actor) ? {} : { OR: [{ sellerId: actor.id }, { channel: "ONLINE" }] };
}

export function orderWriteScope(actor: ScopeActor): Prisma.OrderWhereInput {
  return orderReadScope(actor);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/api/seller-scope.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/api/seller-scope.ts lib/api/seller-scope.test.ts
git commit -m "feat(orders): pool ONLINE-channel orders across every seller, like Customer/Inquiry"
```

---

### Task 4: Pure cart-merge logic

**Files:**
- Modify: `lib/store/cart.ts`
- Test: `lib/store/cart.test.ts`

**Interfaces:**
- Consumes: `CartItem` (`{ productId: string; quantity: number }`), `addToCart` (both already in this file).
- Produces: `mergeCartItems(serverItems, guestItems): CartItem[]`. Task 8 (the verify-code route) is the only caller in this plan; Task 7's cart routes and the checkout UI in a later plan also use it.

- [ ] **Step 1: Write the failing test**

Append to `lib/store/cart.test.ts`:

```ts
import { mergeCartItems } from "./cart";
```

(add to the existing import block at the top instead of a second `import` line)

```ts
describe("mergeCartItems", () => {
  it("unions two carts with no overlap", () => {
    const merged = mergeCartItems(
      [{ productId: "p1", quantity: 2 }],
      [{ productId: "p2", quantity: 3 }]
    );
    expect(merged).toEqual([
      { productId: "p1", quantity: 2 },
      { productId: "p2", quantity: 3 },
    ]);
  });

  it("sums quantities for a product in both carts instead of duplicating the line", () => {
    const merged = mergeCartItems(
      [{ productId: "p1", quantity: 2 }],
      [{ productId: "p1", quantity: 3 }]
    );
    expect(merged).toEqual([{ productId: "p1", quantity: 5 }]);
  });

  it("caps the summed quantity at the maximum", () => {
    const merged = mergeCartItems(
      [{ productId: "p1", quantity: 90 }],
      [{ productId: "p1", quantity: 90 }]
    );
    expect(merged).toEqual([{ productId: "p1", quantity: MAX_QUANTITY }]);
  });

  it("returns the server cart unchanged when the guest cart is empty", () => {
    const server = [{ productId: "p1", quantity: 2 }];
    expect(mergeCartItems(server, [])).toEqual(server);
  });

  it("never mutates either input", () => {
    const server = [{ productId: "p1", quantity: 2 }];
    const guest = [{ productId: "p1", quantity: 3 }];
    mergeCartItems(server, guest);
    expect(server).toEqual([{ productId: "p1", quantity: 2 }]);
    expect(guest).toEqual([{ productId: "p1", quantity: 3 }]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/store/cart.test.ts`
Expected: FAIL — `mergeCartItems` is not exported.

- [ ] **Step 3: Implement**

Append to `lib/store/cart.ts`:

```ts
/**
 * Folds a guest's localStorage cart into the server cart on login.
 *
 * Built on addToCart rather than its own summing logic, so "how two lines of
 * the same part combine" has exactly one implementation — the one
 * addToCart's own tests already cover — instead of a second copy that could
 * drift from it.
 */
export function mergeCartItems(
  serverItems: readonly CartItem[],
  guestItems: readonly CartItem[]
): CartItem[] {
  return guestItems.reduce(
    (merged, item) => addToCart(merged, item.productId, item.quantity),
    [...serverItems]
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/store/cart.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/store/cart.ts lib/store/cart.test.ts
git commit -m "feat(cart): add pure mergeCartItems for guest-to-server cart merge on login"
```

---

### Task 5: Cart schemas

**Files:**
- Modify: `lib/schemas.ts`

**Interfaces:**
- Produces: `cartSetItemSchema` (`{ productId, quantity }`), `cartMergeSchema` (`{ items: [{productId, quantity}] }`) — the shape a guest cart is posted in on login/read. Consumed by Task 7's routes and Task 8.

- [ ] **Step 1: Add the schemas**

In `lib/schemas.ts`, near `quoteCartItemSchema` (around line 14), add:

```ts
/** One line as the client posts it — no price, no name; the server owns those. */
export const cartSetItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(1).max(99),
});

export type CartSetItemInput = z.infer<typeof cartSetItemSchema>;

/** A guest's localStorage cart, sent up to merge into the server cart. */
export const cartMergeSchema = z.object({
  items: z.array(cartSetItemSchema).max(200),
});

export type CartMergeInput = z.infer<typeof cartMergeSchema>;
```

There is no separate test file for `lib/schemas.ts` anywhere in the codebase (schemas are exercised through the route tests that use them) — this task has no test step of its own; Tasks 6–8 exercise these schemas.

- [ ] **Step 2: Confirm it compiles**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add lib/schemas.ts
git commit -m "feat(cart): add cart Zod schemas"
```

---

### Task 6: Cart repository

**Files:**
- Create: `lib/api/cart-repository.ts`

**Interfaces:**
- Consumes: `prisma` (`@/lib/db`), `mergeCartItems` (`@/lib/store/cart`).
- Produces: `getCart(phone): Promise<CartRow>`, `setCartItem(phone, productId, quantity): Promise<CartRow>`, `removeCartItem(phone, productId): Promise<CartRow>`, `clearCart(phone): Promise<void>`, `mergeGuestCart(phone, guestItems): Promise<CartRow>`, and the `CartRow`/`CartItemRow` types. Task 7's routes call these directly; no test file for this task per the Global Constraints note (repository files that only wrap Prisma aren't unit-tested against a live DB elsewhere in this codebase — Task 4 already covers the one piece of real logic here, the merge).

- [ ] **Step 1: Implement**

Create `lib/api/cart-repository.ts`:

```ts
import "server-only";
import { prisma } from "@/lib/db";
import { mergeCartItems } from "@/lib/store/cart";
import type { Prisma } from "@/prisma/generated/prisma/client";

/**
 * The server-side cart for a logged-in (phone-verified) shopper.
 *
 * Keyed by canonical phone rather than a userId — there is no shopper login
 * beyond the OTP session (lib/auth/session.ts), and a Customer CRM row is
 * only created at checkout, not at login. A guest's cart stays in
 * localStorage (lib/store/cart.ts) until they verify a code, at which point
 * mergeGuestCart folds it in here.
 */

export interface CartItemRow {
  productId: string;
  quantity: number;
}

export interface CartRow {
  items: CartItemRow[];
}

const ITEMS_SELECT = {
  items: { select: { productId: true, quantity: true } },
} satisfies Prisma.CartSelect;

function toRow(cart: { items: CartItemRow[] } | null): CartRow {
  return { items: cart?.items ?? [] };
}

export async function getCart(phone: string): Promise<CartRow> {
  const cart = await prisma.cart.findUnique({ where: { phone }, select: ITEMS_SELECT });
  return toRow(cart);
}

async function getOrCreateCartId(phone: string): Promise<string> {
  const cart = await prisma.cart.upsert({
    where: { phone },
    create: { phone },
    update: {},
    select: { id: true },
  });
  return cart.id;
}

/** Sets an absolute quantity for one line, adding it if it is not there yet. */
export async function setCartItem(
  phone: string,
  productId: string,
  quantity: number
): Promise<CartRow> {
  const cartId = await getOrCreateCartId(phone);

  await prisma.cartItem.upsert({
    where: { cartId_productId: { cartId, productId } },
    create: { cartId, productId, quantity },
    update: { quantity },
  });

  return getCart(phone);
}

export async function removeCartItem(phone: string, productId: string): Promise<CartRow> {
  const cart = await prisma.cart.findUnique({ where: { phone }, select: { id: true } });
  if (cart) {
    await prisma.cartItem.deleteMany({ where: { cartId: cart.id, productId } });
  }
  return getCart(phone);
}

export async function clearCart(phone: string): Promise<void> {
  const cart = await prisma.cart.findUnique({ where: { phone }, select: { id: true } });
  if (cart) {
    await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
  }
}

/**
 * Folds a guest cart into the server cart, once, right after login.
 *
 * The merge itself (how duplicate lines combine) is mergeCartItems — pure,
 * unit-tested, and shared with any other caller that ever needs it. This
 * function is only the read-merge-write around it.
 */
export async function mergeGuestCart(
  phone: string,
  guestItems: readonly CartItemRow[]
): Promise<CartRow> {
  if (guestItems.length === 0) {
    return getCart(phone);
  }

  const server = await getCart(phone);
  const merged = mergeCartItems(server.items, guestItems);
  const cartId = await getOrCreateCartId(phone);

  await prisma.$transaction(
    merged.map((item) =>
      prisma.cartItem.upsert({
        where: { cartId_productId: { cartId, productId: item.productId } },
        create: { cartId, productId: item.productId, quantity: item.quantity },
        update: { quantity: item.quantity },
      })
    )
  );

  return { items: merged };
}
```

- [ ] **Step 2: Confirm it compiles**

Run: `npx tsc --noEmit`
Expected: exits 0. (If the `cartId_productId` compound-unique field name Prisma generated differs — check `prisma/generated/prisma/models/CartItem.ts` for the exact generated name of the `@@unique([cartId, productId])` constraint — fix the two `where` clauses above to match; Prisma's default is `cartId_productId` but confirm rather than assume.)

- [ ] **Step 3: Commit**

```bash
git add lib/api/cart-repository.ts
git commit -m "feat(cart): add server-side cart repository"
```

---

### Task 7: Cart API routes

**Files:**
- Create: `app/api/v1/cart/route.ts`
- Create: `app/api/v1/cart/route.test.ts`
- Create: `app/api/v1/cart/items/route.ts`
- Create: `app/api/v1/cart/items/route.test.ts`
- Create: `app/api/v1/cart/items/[productId]/route.ts`
- Create: `app/api/v1/cart/items/[productId]/route.test.ts`

**Interfaces:**
- Consumes: `getSession` (`@/lib/auth/session`), `getCart`/`setCartItem`/`removeCartItem`/`clearCart` (`@/lib/api/cart-repository`), `cartSetItemSchema` (`@/lib/schemas`), `parseJsonBody`/`apiError` (`@/lib/api/route-auth`).
- Produces: `GET /api/v1/cart` → `{ success: true, items: CartItemRow[] }`; `DELETE /api/v1/cart` → `{ success: true }`; `POST /api/v1/cart/items` (body `{ productId, quantity }`) → `{ success: true, items }`; `PATCH /api/v1/cart/items/:productId` (body `{ quantity }`) → `{ success: true, items }`; `DELETE /api/v1/cart/items/:productId` → `{ success: true, items }`. Every route answers 401 for a caller with no session — there is no guest server cart, matching the confirmed design (guest cart stays client-only).

- [ ] **Step 1: Write the failing tests**

Create `app/api/v1/cart/route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();
vi.mock("@/lib/auth/session", () => ({ getSession: () => getSession() }));

const getCart = vi.fn();
const clearCart = vi.fn();
vi.mock("@/lib/api/cart-repository", () => ({
  getCart: (...args: unknown[]) => getCart(...args),
  clearCart: (...args: unknown[]) => clearCart(...args),
}));

const { GET, DELETE } = await import("./route");

beforeEach(() => {
  getSession.mockReset();
  getCart.mockReset();
  clearCart.mockReset();
});

describe("GET /api/v1/cart", () => {
  it("answers 401 with no session", async () => {
    getSession.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    expect(getCart).not.toHaveBeenCalled();
  });

  it("returns the caller's cart", async () => {
    getSession.mockResolvedValue({ phone: "998901234567" });
    getCart.mockResolvedValue({ items: [{ productId: "p1", quantity: 2 }] });

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      items: [{ productId: "p1", quantity: 2 }],
    });
    expect(getCart).toHaveBeenCalledWith("998901234567");
  });
});

describe("DELETE /api/v1/cart", () => {
  it("answers 401 with no session", async () => {
    getSession.mockResolvedValue(null);
    expect((await DELETE()).status).toBe(401);
    expect(clearCart).not.toHaveBeenCalled();
  });

  it("clears the cart", async () => {
    getSession.mockResolvedValue({ phone: "998901234567" });

    const response = await DELETE();

    expect(response.status).toBe(200);
    expect(clearCart).toHaveBeenCalledWith("998901234567");
  });
});
```

Create `app/api/v1/cart/items/route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();
vi.mock("@/lib/auth/session", () => ({ getSession: () => getSession() }));

const setCartItem = vi.fn();
vi.mock("@/lib/api/cart-repository", () => ({
  setCartItem: (...args: unknown[]) => setCartItem(...args),
}));

const { POST } = await import("./route");

function post(body: unknown): Request {
  return new Request("http://localhost/api/v1/cart/items", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  getSession.mockReset();
  setCartItem.mockReset();
  setCartItem.mockResolvedValue({ items: [{ productId: "p1", quantity: 2 }] });
});

describe("POST /api/v1/cart/items", () => {
  it("answers 401 with no session", async () => {
    getSession.mockResolvedValue(null);
    expect((await POST(post({ productId: "p1", quantity: 2 }))).status).toBe(401);
    expect(setCartItem).not.toHaveBeenCalled();
  });

  it("adds the line and returns the updated cart", async () => {
    getSession.mockResolvedValue({ phone: "998901234567" });

    const response = await POST(post({ productId: "p1", quantity: 2 }));

    expect(response.status).toBe(200);
    expect(setCartItem).toHaveBeenCalledWith("998901234567", "p1", 2);
    expect(await response.json()).toEqual({
      success: true,
      items: [{ productId: "p1", quantity: 2 }],
    });
  });

  it("answers 400 for a quantity below one", async () => {
    getSession.mockResolvedValue({ phone: "998901234567" });
    expect((await POST(post({ productId: "p1", quantity: 0 }))).status).toBe(400);
  });

  it("answers 400 for a missing productId", async () => {
    getSession.mockResolvedValue({ phone: "998901234567" });
    expect((await POST(post({ quantity: 2 }))).status).toBe(400);
  });
});
```

Create `app/api/v1/cart/items/[productId]/route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();
vi.mock("@/lib/auth/session", () => ({ getSession: () => getSession() }));

const setCartItem = vi.fn();
const removeCartItem = vi.fn();
vi.mock("@/lib/api/cart-repository", () => ({
  setCartItem: (...args: unknown[]) => setCartItem(...args),
  removeCartItem: (...args: unknown[]) => removeCartItem(...args),
}));

const { PATCH, DELETE } = await import("./route");

function patch(body: unknown): Request {
  return new Request("http://localhost/api/v1/cart/items/p1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function params(productId: string) {
  return { params: Promise.resolve({ productId }) };
}

beforeEach(() => {
  getSession.mockReset();
  setCartItem.mockReset();
  removeCartItem.mockReset();
  setCartItem.mockResolvedValue({ items: [] });
  removeCartItem.mockResolvedValue({ items: [] });
});

describe("PATCH /api/v1/cart/items/:productId", () => {
  it("answers 401 with no session", async () => {
    getSession.mockResolvedValue(null);
    expect((await PATCH(patch({ quantity: 3 }), params("p1"))).status).toBe(401);
  });

  it("sets the quantity", async () => {
    getSession.mockResolvedValue({ phone: "998901234567" });
    const response = await PATCH(patch({ quantity: 3 }), params("p1"));
    expect(response.status).toBe(200);
    expect(setCartItem).toHaveBeenCalledWith("998901234567", "p1", 3);
  });

  it("answers 400 for a quantity below one", async () => {
    getSession.mockResolvedValue({ phone: "998901234567" });
    expect((await PATCH(patch({ quantity: 0 }), params("p1"))).status).toBe(400);
  });
});

describe("DELETE /api/v1/cart/items/:productId", () => {
  it("answers 401 with no session", async () => {
    getSession.mockResolvedValue(null);
    expect((await DELETE(new Request("http://localhost"), params("p1"))).status).toBe(401);
  });

  it("removes the line", async () => {
    getSession.mockResolvedValue({ phone: "998901234567" });
    const response = await DELETE(new Request("http://localhost"), params("p1"));
    expect(response.status).toBe(200);
    expect(removeCartItem).toHaveBeenCalledWith("998901234567", "p1");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run app/api/v1/cart`
Expected: FAIL — the route files under test do not exist yet (import error).

- [ ] **Step 3: Implement the routes**

Create `app/api/v1/cart/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { clearCart, getCart } from "@/lib/api/cart-repository";
import { apiError } from "@/lib/api/route-auth";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return apiError(401, "Sign in to continue.");
  }

  const cart = await getCart(session.phone);
  return NextResponse.json({ success: true, items: cart.items });
}

export async function DELETE() {
  const session = await getSession();
  if (!session) {
    return apiError(401, "Sign in to continue.");
  }

  await clearCart(session.phone);
  return NextResponse.json({ success: true });
}
```

Create `app/api/v1/cart/items/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { setCartItem } from "@/lib/api/cart-repository";
import { apiError, parseJsonBody } from "@/lib/api/route-auth";
import { cartSetItemSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return apiError(401, "Sign in to continue.");
  }

  const body = await parseJsonBody(request, cartSetItemSchema);
  if (!body.ok) {
    return body.response;
  }

  const cart = await setCartItem(session.phone, body.data.productId, body.data.quantity);
  return NextResponse.json({ success: true, items: cart.items });
}
```

Create `app/api/v1/cart/items/[productId]/route.ts`:

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { removeCartItem, setCartItem } from "@/lib/api/cart-repository";
import { apiError, parseJsonBody } from "@/lib/api/route-auth";

const quantitySchema = z.object({ quantity: z.number().int().min(1).max(99) });

interface RouteContext {
  params: Promise<{ productId: string }>;
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const session = await getSession();
  if (!session) {
    return apiError(401, "Sign in to continue.");
  }

  const body = await parseJsonBody(request, quantitySchema);
  if (!body.ok) {
    return body.response;
  }

  const { productId } = await params;
  const cart = await setCartItem(session.phone, productId, body.data.quantity);
  return NextResponse.json({ success: true, items: cart.items });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const session = await getSession();
  if (!session) {
    return apiError(401, "Sign in to continue.");
  }

  const { productId } = await params;
  const cart = await removeCartItem(session.phone, productId);
  return NextResponse.json({ success: true, items: cart.items });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run app/api/v1/cart`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/v1/cart
git commit -m "feat(cart): add /api/v1/cart routes"
```

---

### Task 8: Merge the guest cart into the server cart on login

**Files:**
- Modify: `app/api/auth/verify-code/route.ts`
- Create: `app/api/auth/verify-code/route.test.ts`

**Interfaces:**
- Consumes: `mergeGuestCart` (`@/lib/api/cart-repository`), `cartMergeSchema` (`@/lib/schemas`, already accepts an optional-shaped body — see below).
- Produces: `verify-code`'s response now includes `cart: { items: CartItemRow[] }` — the merged cart the client should now treat as authoritative in place of its local one.

- [ ] **Step 1: Write the failing test**

There is no existing test file for this route. Create `app/api/auth/verify-code/route.test.ts` from scratch, following the mocking pattern used throughout this plan:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyCode = vi.fn();
vi.mock("@/lib/auth/otp-store", () => ({ verifyCode: (...args: unknown[]) => verifyCode(...args) }));

const createSessionToken = vi.fn();
vi.mock("@/lib/auth/session-token", () => ({
  createSessionToken: (...args: unknown[]) => createSessionToken(...args),
}));

const mergeGuestCart = vi.fn();
vi.mock("@/lib/api/cart-repository", () => ({
  mergeGuestCart: (...args: unknown[]) => mergeGuestCart(...args),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (name === "pending_phone" ? { value: "998901234567" } : undefined),
  }),
}));

const { POST } = await import("./route");

function post(body: unknown): Request {
  return new Request("http://localhost/api/auth/verify-code", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  verifyCode.mockReset();
  createSessionToken.mockReset();
  mergeGuestCart.mockReset();
  createSessionToken.mockResolvedValue("token");
  verifyCode.mockReturnValue({ ok: true });
  mergeGuestCart.mockResolvedValue({ items: [{ productId: "p1", quantity: 5 }] });
});

describe("POST /api/auth/verify-code", () => {
  it("merges the posted guest cart into the server cart and returns it", async () => {
    const response = await POST(
      post({ code: "123456", cart: { items: [{ productId: "p1", quantity: 3 }] } })
    );

    expect(response.status).toBe(200);
    expect(mergeGuestCart).toHaveBeenCalledWith("998901234567", [
      { productId: "p1", quantity: 3 },
    ]);
    expect(await response.json()).toEqual({
      success: true,
      cart: { items: [{ productId: "p1", quantity: 5 }] },
    });
  });

  it("merges an empty cart when the client sends none", async () => {
    await POST(post({ code: "123456" }));
    expect(mergeGuestCart).toHaveBeenCalledWith("998901234567", []);
  });

  it("does not merge when the code is invalid", async () => {
    verifyCode.mockReturnValue({ ok: false, reason: "invalid", attemptsLeft: 2 });

    const response = await POST(post({ code: "000000" }));

    expect(response.status).toBe(400);
    expect(mergeGuestCart).not.toHaveBeenCalled();
  });
});
```

Note: mocking `PENDING_PHONE_COOKIE`'s actual string value would couple this test to `lib/auth/cookie-names.ts`; the mock above assumes it resolves to `"pending_phone"`. Check `lib/auth/cookie-names.ts` before writing this test and use its real value instead of guessing.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run app/api/auth/verify-code/route.test.ts`
Expected: FAIL — the route does not yet read a `cart` field from the body or call `mergeGuestCart`.

- [ ] **Step 3: Implement**

In `lib/schemas.ts`, relax `cartMergeSchema` from Task 5 so it can sit inside another object as an optional field (it already can — `z.object({ items: [...] })` is fine to nest). Add a schema for the verify-code body that includes it:

```ts
export const verifyCodeWithCartSchema = verifyCodeSchema.extend({
  cart: cartMergeSchema.optional(),
});

export type VerifyCodeWithCartInput = z.infer<typeof verifyCodeWithCartSchema>;
```

(Add this next to the existing `verifyCodeSchema` definition — find it in `lib/schemas.ts` and place the extension immediately after it.)

Modify `app/api/auth/verify-code/route.ts`:

```ts
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { verifyCode } from "@/lib/auth/otp-store";
import {
  AUTH_HINT_COOKIE,
  PENDING_PHONE_COOKIE,
  SESSION_COOKIE,
  authHintCookieOptions,
  sessionCookieOptions,
} from "@/lib/auth/session";
import { createSessionToken } from "@/lib/auth/session-token";
import { mergeGuestCart } from "@/lib/api/cart-repository";
import { verifyCodeWithCartSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "invalid_json" }, { status: 400 });
  }

  const parsed = verifyCodeWithCartSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "invalid_code" }, { status: 400 });
  }

  const phone = (await cookies()).get(PENDING_PHONE_COOKIE)?.value;
  if (!phone) {
    return NextResponse.json({ success: false, error: "no_pending_request" }, { status: 400 });
  }

  const result = verifyCode(phone, parsed.data.code);
  if (!result.ok) {
    return NextResponse.json(
      {
        success: false,
        error: result.reason,
        ...(result.reason === "invalid" ? { attemptsLeft: result.attemptsLeft } : {}),
      },
      { status: result.reason === "too_many_attempts" ? 429 : 400 }
    );
  }

  const cart = await mergeGuestCart(phone, parsed.data.cart?.items ?? []);

  const response = NextResponse.json({ success: true, cart });
  response.cookies.set(SESSION_COOKIE, await createSessionToken(phone), sessionCookieOptions);
  response.cookies.set(AUTH_HINT_COOKIE, "1", authHintCookieOptions);
  response.cookies.delete(PENDING_PHONE_COOKIE);
  return response;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run app/api/auth/verify-code/route.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/schemas.ts app/api/auth/verify-code/route.ts app/api/auth/verify-code/route.test.ts
git commit -m "feat(cart): merge guest cart into server cart on phone-code verification"
```

---

### Task 9: Full verification pass

- [ ] **Step 1:** Run `npm test` — expect every test in the repo to pass, not only the new files.
- [ ] **Step 2:** Run `npm run lint` — expect no errors.
- [ ] **Step 3:** Run `npx tsc --noEmit` — expect no errors.
- [ ] **Step 4:** Run `npm run build` — expect a clean production build.
- [ ] **Step 5:** Report the exact commands run and their pass/fail output. Do not report the plan as complete on anything less than all four green.

---

## Self-Review Notes

- **Spec coverage:** Original Phase 1 (models) — covered for the cart/payment/address/channel pieces; `User`, `Product`, base `Order`/`OrderItem` already existed and are untouched. Original Phase 2's cart endpoints — covered (Task 7). Original Phase 5's server cart + login-merge — covered (Tasks 4, 6, 8). Not covered here, deferred to later plans: checkout order creation from the cart, payment provider integration + webhook, checkout UI, account/admin surfacing, notifications, ERP stock. These need their own plans per the Scope Check rule — this plan is already a full independently-testable slice on its own.
- **Placeholder scan:** no TBD/TODO; every step has real code.
- **Type consistency:** `CartItemRow { productId, quantity }` used identically in `cart-repository.ts`, the three route files, and their tests; matches the client-side `CartItem` shape in `lib/store/cart.ts` so no translation layer is needed when the checkout UI plan wires them together.
