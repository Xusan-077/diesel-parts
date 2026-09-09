# Moliya (Finance) module — design & backend spec

**Date:** 2026-09-09
**Status:** frontend shipped against this spec; backend NOT yet built
**Branch:** `feat/finance-module`

## Summary

A new top-level director section at `/director/finance` with a shared KPI
header and three tabs:

1. **To'lovlar** (Payments) — money in. Read-only ledger of completed
   customer payments.
2. **Xarajatlar** (Expenses) — money out. Full CRUD (Plus / Pencil / Trash2),
   the same "Amallar" dropdown pattern as `warehouse/warehouses`.
3. **Qarzdorlik** (Debt) — orders taken on credit: total, paid, remaining,
   status (`to'langan / qisman / to'lanmagan`). One row action: record a
   partial payment.

KPI row (always visible above the tabs): **Jami tushum**, **Jami xarajat**,
**Sof foyda** (tushum − xarajat), **Jami qarzdorlik**.

Palette from the existing panel token system:
- Payments / income → `success` (`--success` / `--success-surface`)
- Expenses → `danger` (`--danger` / `--danger-surface`)
- Debt → `warning` (`--warning` / `--warning-surface`)
- Net profit → `success` when ≥ 0, `danger` when negative.

## What already exists in `backend/`

| Concept | In `backend/` today |
| --- | --- |
| `Payment` | `Payment` model — `orderId`, `amount`, `method` (`PaymentMethod`), `status` (`PaymentStatus`), `paidAt`. Created today only by `PaymeService` (gateway) — there is **no staff "record a payment" endpoint**. |
| Order payment state | `Order.paymentStatus` (`UNPAID / PARTIAL / PAID`), `Order.totalAmount`, `Order.payments[]` |
| RBAC | `JwtAuthGuard` + `RolesGuard` + `@Roles()`; `MANAGER_UP`, `DIRECTOR_UP` |
| pagination | `PaginationDto` + `paginationMeta()` |
| audit | `AuditService.record()` (never throws) |
| period aggregation | `analytics` module already does date-window revenue/order rollups — the summary endpoint below should live beside it or reuse its helpers |

**Missing entirely:** any `Expense` concept, and any endpoint that
aggregates payments/debt for a finance view.

## Backend spec — to build

### 1. Schema

```prisma
enum ExpenseCategory {
  RENT
  SALARY
  UTILITIES     // kommunal
  LOGISTICS     // yetkazib berish / transport
  TAX           // soliq
  SUPPLIES      // xo'jalik / kanstovarlar
  MARKETING
  BANK          // bank xizmati / komissiya
  OTHER
}

model Expense {
  id          String          @id @default(cuid())
  /// Short human title, e.g. "Sentyabr ijara".
  title       String
  category    ExpenseCategory
  amount      Decimal         @db.Decimal(14, 2)
  /// The day the money left, not the day the row was entered.
  spentAt     DateTime
  note        String?
  createdById String
  createdBy   User            @relation("CreatedExpenses", fields: [createdById], references: [id], onDelete: Restrict)
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt

  @@index([spentAt])
  @@index([category, spentAt])
}
```

`User` gains `createdExpenses Expense[] @relation("CreatedExpenses")`.

Migration: production's `prisma/migrations/` is a clean baseline again
(warehouse Phase 1 re-based it), so `prisma migrate dev --name add_expense`
authors this normally.

### 2. `FinanceModule` — `backend/src/finance/`

All routes `@Roles(...DIRECTOR_UP)` (SUPER_ADMIN, DIRECTOR) — money is a
director concern; MANAGER is deliberately excluded here, unlike warehouse.
Register in `AppModule`.

#### `GET /api/finance/summary?dateFrom&dateTo`

`dateFrom` / `dateTo` are `YYYY-MM-DD` (inclusive day range, `Asia/Tashkent`);
both optional — omitted ⇒ all-time.

```jsonc
{
  "totalIncome":  123456789,   // Σ Payment.amount WHERE status=COMPLETED AND paidAt IN range
  "totalExpense": 45678900,    // Σ Expense.amount WHERE spentAt IN range
  "netProfit":    77777889,    // totalIncome - totalExpense
  "totalDebt":    9900000,     // Σ (Order.totalAmount - Σ completed payments) WHERE paymentStatus IN (UNPAID, PARTIAL); NOT range-filtered — debt is a "now" figure
  "debtorCount":  7
}
```

#### `GET /api/finance/payments`

Query: `PaginationDto` + `method?` (`PaymentMethod`) + `dateFrom?` + `dateTo?`
+ `q?` (order number or customer name, case-insensitive).
Source: `Payment` where `status = COMPLETED`, `orderBy: { paidAt: 'desc' }`.

```jsonc
{
  "data": [{
    "id": "...",
    "amount": 1500000,
    "method": "CASH",
    "paidAt": "2026-09-08T09:12:00.000Z",
    "order": { "id": "...", "orderNumber": "DP-2026-0042" },
    "customer": { "id": "...", "name": "Anvar Karimov" }
  }],
  "meta": { "page": 1, "limit": 20, "total": 128, "totalPages": 7 }
}
```

#### `GET /api/finance/expenses` · `POST` · `PATCH /:id` · `DELETE /:id`

- **GET** — `PaginationDto` + `category?` + `dateFrom?` + `dateTo?` + `q?`
  (title contains). `orderBy: { spentAt: 'desc' }`. Row shape:
  `{ id, title, category, amount, spentAt, note, createdBy: { id, name }, createdAt }`.
- **POST / PATCH** body (`CreateExpenseDto` / `UpdateExpenseDto` = partial):
  ```jsonc
  { "title": "Sentyabr ijara", "category": "RENT", "amount": 4000000, "spentAt": "2026-09-01", "note": null }
  ```
  `amount` > 0, ≤ 2 decimals. `spentAt` is a `YYYY-MM-DD` date (stored at
  Tashkent midnight). Audit `CREATE` / `UPDATE` / `DELETE`, `entityType: 'Expense'`.
- **DELETE** — hard delete (an expense row is a bookkeeping line; a wrong one
  is removed, not archived). Audit `DELETE` with `before` snapshot.

#### `GET /api/finance/debts`

Query: `PaginationDto` + `status?` (`UNPAID | PARTIAL` — `PAID` is not debt) +
`q?` (order number or customer name).
Source: `Order` where `paymentStatus IN (UNPAID, PARTIAL)`,
`orderBy: { createdAt: 'asc' }` (oldest debt first).

```jsonc
{
  "data": [{
    "orderId": "...",
    "orderNumber": "DP-2026-0031",
    "customer": { "id": "...", "name": "Anvar Karimov", "phone": "998901234567" },
    "total": 8000000,
    "paid": 3000000,              // Σ Payment.amount WHERE status=COMPLETED
    "remaining": 5000000,
    "status": "PARTIAL",
    "createdAt": "2026-08-20T...",
    "lastPaymentAt": "2026-09-01T..." | null
  }],
  "meta": { ... },
  "totals": { "remaining": 9900000, "count": 7 }
}
```

#### `POST /api/finance/debts/:orderId/payments`

Records a staff-taken partial (or full) payment against an order.

Body: `{ "amount": 2000000, "method": "CASH", "paidAt": "2026-09-09" }`
(`method` ∈ `CASH | CARD | TRANSFER`; `paidAt` optional, defaults now).

Behaviour, in one `prisma.$transaction`:
1. Load order + completed payments; reject if `amount <= 0` or
   `amount > remaining` (`400 payment_exceeds_debt`).
2. `Payment.create({ orderId, amount, method, status: COMPLETED, paidAt })`
   (`provider` / `transactionId` null — same as the existing staff-recorded rows the schema comment describes).
3. Recompute: `paid' = paid + amount`; set
   `Order.paymentStatus = paid' >= totalAmount ? PAID : PARTIAL`.
4. Audit `PAYMENT` (add the enum value) / or `UPDATE` on `entityType: 'Order'`.

Returns the updated debt row shape above (or `{ ...row, status: "PAID" }` when
cleared — the frontend drops it from the list on refetch).

## Frontend — shipped in this branch

Built against the endpoints above. Until the backend ships, every read
degrades through `safeRead` to an empty state + a one-line "ma'lumotni
yuklab bo'lmadi" notice (identical to the warehouse dashboard's fallback),
and the expense/payment mutations surface the transport error in the modal.

| Layer | File |
| --- | --- |
| zod schemas + types | `frontend/lib/schemas.ts` (`/* Director panel: finance */` block) |
| deterministic dates | `frontend/lib/finance/format.ts` |
| server repository | `frontend/lib/api/finance-repository.ts` |
| route errors | `frontend/lib/api/finance-route-errors.ts` |
| API routes | `frontend/app/api/v1/finance/{summary,payments,expenses,expenses/[id],debts,debts/[orderId]/payments}/route.ts` |
| client fetchers | `frontend/lib/api/admin/finance.ts` |
| query keys | `frontend/lib/api/admin/keys.ts` → `adminKeys.finance` |
| hooks | `frontend/hooks/admin/use-finance.ts` |
| pages | `frontend/app/director/(panel)/finance/{layout,page,expenses/page,debts/page}.tsx` |
| components | `frontend/components/director/finance/*` |
| nav wiring | `admin-nav.ts`, `admin/nav-groups.ts` (new bare `finance` group), `panel-nav.tsx` glyph, `panel-dictionary.ts` (uz/ru/en) |

### Frontend decisions (autonomous)

- **Route shape:** three real route segments (`/director/finance`,
  `/finance/expenses`, `/finance/debts`) with a shared `layout.tsx`, mirroring
  `warehouse/*`. The KPI read lives in the layout so a tab switch does not
  refetch it. Payments is the index route.
- **New `finance` nav group, not a child of `catalog`/`management`:** a
  one-item group renders bare (no heading) in `PanelNav` — which is exactly
  "a separate top-level nav item". Placed right after `overview`, next to
  Analitika, because it is a director cockpit view.
- **`StatCard` gains a `success` tone** (maps to `--success-surface` /
  `--success`). Pure addition — every existing `tone` value is untouched.
- **`lib/finance/format.ts` carries its own `formatDate` / `formatDateTime`**,
  copied from `lib/warehouse/format.ts`'s hydration-safe technique rather than
  importing across modules — module-scoped date formatting is the established
  pattern (warehouse and seller each have their own).
- **Expenses is the full-CRUD tab; Debts gets one write** (record payment);
  **Payments is read-only** — matches the nature of each dataset.
