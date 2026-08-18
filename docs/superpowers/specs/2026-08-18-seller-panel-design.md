# Seller Panel — Design Spec

Date: 2026-08-18
Status: Approved
Branch: `feat/catalog-database-foundation`

## 1. Scope

The staff panel currently has a complete director half — dashboard, catalog
editing, staff management, discount approvals, audit trail — and a seller half
that is one placeholder page. This spec covers the seller half.

Seven capabilities, all requested in the 2026-08-18 brief:

1. A board of incoming inquiries, moving left to right through five columns.
2. A per-seller customer book (mini-CRM) that does not show another seller's
   customers.
3. Manual order creation.
4. Live stock lookup while the seller is on the phone.
5. Discounts inside the seller's own `discountLimit`, applied immediately; above
   it, a `DiscountRequest` that the director's existing queue already answers.
6. The seller's own KPI figures — period sales, closed deals, conversion.
7. A mobile bottom navigation, because a seller works from a phone.

No new subsystem is introduced. Every one of these reads or writes tables that
`2026-08-17-catalog-database-foundation-design.md` and the director sub-project
already created, and reuses the repository / pure-function split those
established.

## 2. Decisions

The five decisions below were put to Xusan on 2026-08-18 and answered. They are
recorded here because each one closes off a design that would otherwise look
equally reasonable to a later reader.

**2.1 Inquiries are an open pool, claimed by whoever gets there first.**
A seller sees unassigned inquiries and their own. Claiming sets
`assignedSellerId`; after that only the owner and directors see the row. The
alternative — the director assigning every inquiry — was rejected because it
needs a director-side assignment screen that nobody asked for and puts a human
in the path of every incoming lead.

**2.2 A won inquiry offers an order, it does not require one.**
Moving a card to WON offers "create an order from this inquiry", prefilled with
the inquiry's contact as a `Customer` and its product and quantity as the first
line. Marking won without an order stays legal: deals are agreed on the phone
and written up later, and a board that refuses to record that would simply be
worked around.

**2.3 Orders never move stock.**
The order form shows live stock and warns when a line exceeds it, but nothing in
the seller panel writes `Product.stock`. The director's product editor stays the
only writer, which is what keeps the derived `stockStatus` column from drifting
(foundation spec, section 3.1). Reservation semantics — hold on CONFIRMED,
deduct on COMPLETED — would need a reserved-quantity column, a release path on
cancellation, and a reconciliation story, none of which the brief asked for.

**2.4 Line prices are snapshots and cannot be edited.**
`OrderItem.unitPrice` is copied from `Product.price` at the moment the line is
added. Every reduction goes through the order-level discount percent. This is
the decision that makes `User.discountLimit` mean anything: a freely editable
line price lets a seller reach any total they like and routes around the
approval path entirely. Products priced on request (`price = null`) are the one
exception — a line for one of those requires a manually entered unit price,
because there is no catalog figure to snapshot.

**2.5 The seller drives the whole order lifecycle; the audit trail is the
control.** `DRAFT → PENDING → CONFIRMED → COMPLETED | CANCELLED`, all of it in
the seller's hands, with every transition written to `AuditLog`. Revenue in the
director's dashboard is therefore seller-attested. Xusan accepted this
explicitly on the grounds that it matches the trust model the discount system
already encodes: a seller acts independently inside their own bounds, and only
stepping outside them reaches a director. The alternative, reserving COMPLETED
for a director, requires a director-side order screen that is deliberately out
of scope (section 12).

## 3. Data model

One migration, one nullable column.

```prisma
model Order {
  // ...
  /// Set when the order was raised from a board card, so the conversion figure
  /// is counted rather than estimated and one inquiry cannot be billed twice.
  inquiryId String?
  inquiry   Inquiry? @relation(fields: [inquiryId], references: [id], onDelete: SetNull)

  @@index([inquiryId])
}

model Inquiry {
  // ...
  orders Order[]
}
```

### 3.1 `InquiryStatus` is not extended

The brief asks for five columns — Yangi, Band qilingan, Jarayonda, Yutildi,
Yo'qotildi — and the enum has four values. The fifth column is not a fifth
status: **"Band qilingan" is `NEW` with an assignee**, and "Yangi" is `NEW`
without one.

```
NEW,  assignedSellerId = null   → Yangi
NEW,  assignedSellerId != null  → Band qilingan
IN_PROGRESS                     → Jarayonda
WON                             → Yutildi
LOST                            → Yo'qotildi
```

This falls out of decision 2.1 rather than being contrived to avoid a migration:
claiming *is* the transition between the first two columns, so the assignment
field already carries the distinction. Adding a `CLAIMED` enum value would store
the same fact twice and would admit the illegal state "CLAIMED with no assignee".

The bucketing is a pure function, `inquiryColumn(status, assignedSellerId)`, so
the five-way mapping is asserted in a unit test rather than spread across JSX.

## 4. Row-level visibility

`lib/api/seller-scope.ts` is the single place that answers "which rows may this
person see". It exports pure functions returning Prisma `where` fragments:

| Model | SELLER sees | DIRECTOR sees |
|---|---|---|
| `Inquiry` | `assignedSellerId = me OR null` | all |
| `Customer` | `assignedSellerId = me`, plus an explicit unassigned pool view | all |
| `Order` | `sellerId = me` | all |

Two rules apply on top:

- **Writes are stricter than reads.** A seller may read an unassigned inquiry or
  customer, but the only write permitted against an unowned row is the claim
  itself, which requires the row to still be unassigned. Every other mutation
  requires ownership.
- **A write against a row the seller does not own answers 404, not 403.** 403
  confirms the row exists, which tells one seller that another seller's order is
  real. The director-only guard in `route-auth.ts` correctly uses 403 for the
  opposite reason — there the seller already knows the route exists — and that
  asymmetry is deliberate.

Three enforcement strategies were compared. A Prisma client extension injecting
`sellerId` globally was rejected: it needs a director escape hatch anyway, and
extension behaviour on a custom-output Prisma 7 client is unverified — the
foundation spec's rule that a core guarantee must not rest on an unconfirmed
capability applies here too. Per-handler `row.sellerId === user.id` checks were
rejected because the rule would be restated in roughly ten handlers and omitting
one fails open. The scoped-filter approach keeps the rule in one tested file.

## 5. The inquiry board

`/admin/seller` — a server component reading the seller's visible inquiries and
bucketing them into the five columns.

**No drag and drop.** It would add a dependency, and pointer-sensor drag on a
touch screen is exactly the interaction that fails for the phone-first user this
panel is for. Each card carries explicit next-step buttons, which are also
reachable by keyboard and announceable by a screen reader.

- Desktop (`lg`): five columns side by side.
- Mobile: a row of status chips filtering one single-column list. Counts sit on
  the chips, so the shape of the pipeline is legible without scrolling.

Card actions: **Men olaman** (claim, first column only), **Jarayonga o'tkazish**,
**Yutildi**, **Yo'qotildi**. WON additionally surfaces "Buyurtma yaratish",
linking to `/admin/seller/orders/new?inquiry=<id>`.

**Claiming is race-safe without a transaction:**

```ts
const claimed = await prisma.inquiry.updateMany({
  where: { id, assignedSellerId: null },
  data:  { assignedSellerId: actor.id },
});
if (claimed.count === 0) return { ok: false, reason: "taken" };  // → 409
```

Two sellers tapping the same card a second apart is the expected case, not an
edge case, and the loser must be told the lead is gone rather than shown a
silent no-op.

## 6. Customers

`/admin/seller/customers` lists the seller's own customers with a search box and
a second tab for the unassigned pool, claimable by the same `updateMany` guard.
`/admin/seller/customers/[id]` shows contact details, editable notes, and the
customer's order history with totals.

Creating a customer from an inquiry matches on `phone` first: `Customer.phone`
is indexed and deliberately non-unique (a company switchboard is shared), so the
match offers an existing row rather than silently merging or blindly inserting.

## 7. Orders

### 7.1 Money

`lib/api/order-money.ts`, pure:

```ts
subtotalOf(items: { qty: number; unitPrice: number }[]): number
applyDiscount(subtotal: number, percent: number): number   // rounded to 2dp
```

`applyDiscount` currently exists as a private copy inside
`discount-repository.ts`. It moves here and that file imports it. Two copies of
the rule that turns a percent into a total is exactly the drift that would let
the director's approval screen quote one figure and the seller's order another.

The move adds rounding to two decimals, which the private copy lacked. The
columns are `Decimal(14, 2)`; feeding them an unrounded float leaves the
database to round, and the value the seller was shown before saving can then
differ from the value stored.

### 7.2 Order numbers

`lib/api/order-number.ts`, pure: `nextOrderNumber(latest: string | null, year:
number)` → `DP-2026-0042`. The repository reads the highest existing number for
the year, calls the function, and inserts. `Order.orderNumber` is already
`@unique`, so a collision under concurrency surfaces as a write error rather
than a duplicate; the repository retries three times before failing. Sequence
restart at each new year, and a malformed or absent latest value, are
unit-tested.

### 7.3 Lifecycle

`lib/api/order-status.ts`, pure: `allowedTransitions(current): OrderStatus[]`.

```
DRAFT     → PENDING, CANCELLED
PENDING   → CONFIRMED, CANCELLED
CONFIRMED → COMPLETED, CANCELLED
COMPLETED → (terminal)
CANCELLED → (terminal)
```

**Items and discounts are editable only in DRAFT and PENDING.** From CONFIRMED
onward the order is a record of an agreement and only its status may change. Any
other transition is rejected with 409.

Every transition writes an `AuditLog` row (`action: "UPDATE"`, `entityType:
"Order"`, before/after carrying the two statuses) — the control that decision
2.5 rests on.

### 7.4 The order form

`/admin/seller/orders/new` — customer picker (existing or new), then lines added
by searching the catalog. Each line shows live stock and flags `qty > stock` as
a warning, never a block. Unit price is read-only per decision 2.4, except for
`price = null` products where it is required input.

The picker searches over HTTP as the seller types, so it needs
`GET /api/v1/products/search?q=`, guarded by `authenticateStaff` (not
`authenticateDirector` — sellers must reach it). It returns the existing
`AdminProductRow` shape from `listProductsForAdmin`, restricted to active
products.

## 8. Discounts

Pure decision in `lib/api/discount-policy.ts`:

```ts
classifyDiscount(requestedPercent, sellerLimit):
  | { kind: "immediate" }        // requested <= limit
  | { kind: "needs_approval" }   // requested >  limit
```

- **Immediate:** `discountRequestedPercent` and `discountApprovedPercent` are
  both set and `totalAmount` recomputed, in one write.
- **Needs approval:** `discountRequestedPercent` is set,
  `discountApprovedPercent` is left at its previous value, and a `PENDING`
  `DiscountRequest` is created with a `Notification` to every active director.
  The order continues to quote the total the seller may actually honour.

One `PENDING` request per order at a time; a second attempt answers 409. The
director's existing `listPendingDiscounts` / `decideDiscount` path needs no
change — it already writes the approved percent and total back onto the order
and notifies the seller.

`/admin/seller/orders/[id]` shows the request's state so the seller knows whether
they are waiting, approved, or rejected, and with what note.

## 9. Stock lookup

`/admin/seller/stock` — a server component taking `?q=`, calling the **existing**
`listProductsForAdmin({ search, page, includeInactive: false, sort: "stock" })`.

This corrects the design as first presented in chat, which said the page would
reuse `buildProductWhere`. It cannot: `buildProductWhere` feeds `queryProducts`,
which maps rows through `toProduct` into the public `Product` type, and that type
deliberately carries only the derived `stockStatus` — the raw `stock` and
`minStock` numbers a seller needs are dropped by design. `listProductsForAdmin`
already searches SKU, Uzbek name and OEM numbers and already returns the raw
counts, so no new query is written.

Sellers pass `includeInactive: false`: a retired product is not sellable, and
offering its stock figure would only invite a quote against it.

## 10. Seller KPI

`/admin/seller/stats`, reusing the director's `Period`, `StatTile` and
`TrendChart`.

`getSalesSummary(period)` and `getRevenueSeries(period)` in
`analytics-repository.ts` gain an optional trailing `sellerId?: string`. Director
call sites pass nothing and are unchanged. A parallel `seller-analytics.ts` was
rejected: the revenue definition (`COMPLETED` only, `CONFIRMED`/`PENDING` as
pipeline) must not be able to differ between the two dashboards.

New: `getSellerConversion(sellerId, period)` —

- `handled` = inquiries assigned to the seller, created within the period
- `won` = those at `WON`
- conversion = `won / handled`, and `null` when `handled === 0` rather than 0%,
  because a seller with no leads has not converted badly

Tiles: period sales, closed deals, average order value, pipeline, conversion,
pending discount requests.

**No commission is computed.** The payroll formula was never specified, and a
plausible-looking invented number on a seller's own earnings screen is the worst
possible place for a guess.

## 11. Navigation and the mobile shell

`lib/auth/admin-nav.ts` becomes sectioned — `ADMIN_NAV_SECTIONS`, each with a
title, a role list and items. A flat list gains five entries here and the
director's sidebar becomes a ten-item wall with no grouping.

- Sidebar (`PanelShell`): renders every section the role may see, under its
  title. A director keeps both.
- Bottom bar (`components/admin/panel-bottom-nav.tsx`): `lg:hidden`, fixed,
  rendering only the seller section — So'rovlar, Mijozlar, Buyurtmalar, Zaxira,
  Statistika. Five items, which is the practical ceiling for a thumb-reachable
  bar. Icons come from `lucide-react`, already a dependency, each paired with its
  label; the active item is marked the way `PanelNav` marks it, by weight and ink
  as well as the accent, so state is never carried by colour alone.
- Bottom padding `pb-20 lg:pb-8` on the panel main element, plus
  `env(safe-area-inset-bottom)`, so the bar never covers the last row of a table
  on a notched phone.

The bar renders only under `/admin/seller`. A director reading a seller page on a
phone gets it too — that is the point of directors being able to open seller
pages at all.

## 12. Out of scope

- A director-side order screen. Decision 2.5 makes it unnecessary for now.
- Stock reservation or a warehouse model (decision 2.3; the foundation spec
  fixed a single stock pool).
- Commission (section 10).
- Notification UI. Rows are written to `Notification`; no bell or inbox is built
  in this phase, and nothing in this spec depends on one being read.
- Customer-facing order tracking. `Order` has no customer login path.

## 13. Testing

The project tests pure functions with vitest beside their source and does not
test against a live database. This phase keeps that split, which is why so much
of the logic above is extracted into pure modules:

| File | Asserts |
|---|---|
| `lib/api/seller-scope.test.ts` | seller vs director filters; unassigned rows readable and claimable, but not otherwise mutable |
| `lib/api/inquiry-board.test.ts` | the five-way column mapping, including `NEW` with and without an assignee |
| `lib/api/order-money.test.ts` | subtotal, discount application, 2dp rounding, 0% and 100% |
| `lib/api/order-number.test.ts` | first number of a year, increment, year rollover, malformed input |
| `lib/api/order-status.test.ts` | every legal transition and the terminal states |
| `lib/api/discount-policy.test.ts` | at, below and above the limit; a zero limit |
| `lib/schemas.test.ts` | the new order, customer and discount-request schemas |

Verified after each task with `npx tsc --noEmit`, `npm run lint`, `npm test` and
`npm run build`. `npm run db:demo` re-seeds demo orders and customers for manual
checks; the database currently holds none (see the pre-deploy checklist).

## 14. Files

New:

```
app/admin/seller/customers/page.tsx, customers/[id]/page.tsx
app/admin/seller/orders/page.tsx, orders/new/page.tsx, orders/[id]/page.tsx
app/admin/seller/stock/page.tsx
app/admin/seller/stats/page.tsx
app/api/v1/inquiries/[id]/route.ts            PATCH status
app/api/v1/inquiries/[id]/claim/route.ts      POST
app/api/v1/customers/route.ts                 GET, POST
app/api/v1/customers/[id]/route.ts            PATCH
app/api/v1/customers/[id]/claim/route.ts      POST
app/api/v1/orders/route.ts                    POST
app/api/v1/orders/[id]/route.ts               PATCH status
app/api/v1/orders/[id]/discount/route.ts      POST
app/api/v1/products/search/route.ts           GET  (authenticateStaff)
lib/api/seller-scope.ts, inquiry-board.ts, order-money.ts, order-number.ts,
lib/api/order-status.ts, discount-policy.ts,
lib/api/inquiry-board-repository.ts, customer-repository.ts, order-repository.ts
components/admin/panel-bottom-nav.tsx, inquiry-board.tsx, customer-list.tsx,
components/admin/order-form.tsx, order-detail.tsx, product-picker.tsx
prisma/migrations/<ts>_order_inquiry_link/
```

Modified: `prisma/schema.prisma`, `lib/auth/admin-nav.ts`,
`components/admin/panel-shell.tsx`, `lib/api/analytics-repository.ts`,
`lib/api/discount-repository.ts`, `lib/schemas.ts`, `app/admin/seller/page.tsx`.
