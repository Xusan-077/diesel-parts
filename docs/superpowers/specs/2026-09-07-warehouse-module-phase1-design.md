# Warehouse (Ombor) module — Phase 1 design

**Date:** 2026-09-07
**Status:** design, awaiting review
**Scope owner decisions (this session):**

- **Schema:** extend the existing `Product` / `Warehouse` / `Inventory` /
  `StockMovement` / `AuditLog` models — do **not** create a parallel set.
- **Migration path:** re-baseline `backend/prisma/migrations/` to production's
  real history first (deploy-checklist Open item 4), then author the warehouse
  migration with `prisma migrate dev` against staging.
- **Roles:** keep the current five (`SUPER_ADMIN / DIRECTOR / MANAGER / SELLER /
  VIEWER`). Warehouse management actions gate on `MANAGER_UP`, read/list on
  `SELLER_UP` — same convention as the rest of `backend/`.
- **This session's scope:** Phase 1 only (Part A + Part B below). Write-offs,
  inventory counts, transfers and the extra reports are later phases.

---

## Context — what already exists

`backend/` is a mature NestJS + Prisma codebase. The spec in the task prompt was
written as a greenfield build; most of its surface is already here:

| Spec entity / concept | Already in `backend/` |
| --- | --- |
| `Warehouse` | `warehouses` module, full CRUD (`WarehousesService`) |
| `Stock` (`UNIQUE(product, warehouse)`) | `Inventory` model — `quantity`, `reservedQuantity`, `@@unique([productId, warehouseId])` |
| `StockMovement` | `StockMovement` model (`inventoryId`, enum `IN/OUT/RESERVE/RELEASE`) + `stock-movements` module |
| `Product` | `products` module + `Product` model (i18n names, `stock`, `minStock`, `purchasePrice`) |
| `AuditLog` + audit writes | `AuditLog` model + `AuditService.record()` (never throws) |
| transaction pattern (`movement → stock → audit`) | `InventoryService.reserveForOrder / fulfillForOrder / adjust` already do this inside `prisma.$transaction` |
| RBAC | `JwtAuthGuard` + `RolesGuard` + `@Roles()` + `roles.ts` (`MANAGER_UP`, `DIRECTOR_UP`, `SELLER_UP`) |
| server-side pagination | `PaginationDto` + `paginationMeta()` |

**Production DB reality** (`docs/deploy-checklist.md` → "STATUS — backend schema
alignment"): production Postgres already contains `Warehouse`, `Inventory`,
`StockMovement` (and 7 other step-2 tables); `prisma migrate diff` from prod to
`backend/prisma/schema.prisma` reports an **empty migration** — schema and prod
match. The **only** outstanding DB issue is that `backend/prisma/migrations/`
is not a byte-for-byte baseline of prod's applied history, so `migrate dev` /
`migrate deploy` cannot be used (step 2 and the checkout migration were applied
by hand via `db execute` + `migrate resolve --applied`).

**No `Supplier` model exists** (see the `analytics-blocked-on-schema` note). A
real supplier table is its own migration. Phase 1 records the supplier on a
goods receipt as free text.

---

## Part A — Re-baseline `backend/prisma/migrations/`

Goal: make `prisma migrate status` read clean against production (and staging),
so `prisma migrate dev` can author the Phase 1 migration normally.

This is deploy-checklist **Open item 4**, done as the first slice of this work
because Part B needs a working `migrate dev`.

### Steps

1. **Delete the 6 abandoned consolidated migrations** from
   `backend/prisma/migrations/`:
   `20260823092527_init`, `20260823111930_order_status_add_draft`,
   `20260823111939_consolidate_storefront_crm`, `20260827131051_add_cart`,
   `20260827140000_payme_payment_fields`,
   `20260828093445_checkout_customer_delivery_fields`.
   None of these are in prod's `_prisma_migrations` (the first was marked
   `--rolled-back` on prod and staging; the rest were never applied — their DDL
   reached prod via `20260901120000_backend_step2_additive` instead).

2. **Vendor production's 9 applied root migrations byte-for-byte** from
   `git show d5cc994~1:prisma/migrations/<name>/migration.sql`:
   `20260817145718_init_catalog`,
   `20260818040218_add_sales_and_audit_models`,
   `20260819081019_seller_panel_inquiry_followup_and_order_inquiry_link`,
   `20260821031413_add_product_reviews`,
   `20260821040000_review_author_identity`,
   `20260821100839_category_tree_metadata`,
   `20260821170000_category_icon`,
   `20260823062921_add_product_image_url`,
   `20260823070819_drop_product_image_labels`.
   Copied verbatim so their `_prisma_migrations` checksums still match prod.
   (The 3 later root migrations at that commit —
   `checkout_cart_foundation`, `payment_transaction_idempotency`,
   `revert_checkout_cart_foundation` — were **not** applied to prod and are not
   vendored.)

3. **Keep** `20260901120000_backend_step2_additive` and
   `20260906120000_checkout_contact_payment_address` (both already applied to
   prod via `migrate resolve --applied`).

4. Resulting folder = 9 + 2 = **11 migrations**, matching prod's applied history
   in name and checksum.

### Verification (read-only, staging only)

- Staging DB `postgresql://postgres:postgres@localhost:5433/diesel_parts_staging`
  is a verified byte-for-byte prod copy (per deploy-checklist). It is **not**
  production — safe to run `migrate status` / `migrate dev` against.
- `npx prisma migrate status` against staging must report the history as
  reconciled (11 applied, none pending, no failed/unknown). If the rolled-back
  `20260823092527_init` row still produces noise, clear it on **staging** with
  `prisma migrate resolve` (staging is disposable; production is untouched in
  Phase 1).
- `npx prisma migrate diff --from-migrations ./prisma/migrations
  --to-schema-datamodel ./prisma/schema.prisma --exit-code` → **empty** before
  Part B changes (proves the vendored baseline reproduces the current schema).

**Production is not touched in Part A.** Applying the Phase 1 migration to prod
is a separate, later, explicitly-approved step (same as step 2 was), folded
into the pending Railway redeploy.

---

## Part B — Phase 1 schema extensions + module

### B1. Enum + model changes (`schema.prisma`)

**`StockMovementType`** — add values (keep the existing 4 so no code breaks):

```
enum StockMovementType {
  IN
  OUT
  RESERVE
  RELEASE
  PURCHASE            // goods receipt approved
  WRITE_OFF           // (Phase 3) — added now so the ledger vocabulary is stable
  TRANSFER_IN         // (Phase 4)
  TRANSFER_OUT        // (Phase 4)
  INVENTORY_ADJUSTMENT// (Phase 5) manual / count correction
}
```

Only `PURCHASE` is produced by Phase 1 code; the rest are declared now so the
enum is not re-migrated every phase.

**`Product`** — add columns, all nullable / defaulted (populated table):

| Column | Type | Note |
| --- | --- | --- |
| `barcode` | `String?  @unique` | spec's `barcode` unique index |
| `unit` | `String  @default("dona")` | pcs / litr / komplekt — free text for now |
| `recommendedStock` | `Int  @default(0)` | spec's `recommended_stock` |
| `averageCost` | `Decimal?  @db.Decimal(14, 2)` | weighted average, updated on receipt approve |
| `lastPurchaseCost` | `Decimal?  @db.Decimal(14, 2)` | last receipt line unit cost |

`sku` and `oemNumbers` already exist and are already indexed (`sku @unique`).
Existing `minStock` = spec's `minimum_stock`; `purchasePrice` stays as-is.

**`Warehouse`** — add columns:

| Column | Type | Note |
| --- | --- | --- |
| `code` | `String  @unique` | required; backfill existing rows in the migration (`W1`, `W2`, … by `createdAt`) |
| `address` | `String?` | `location` already exists; `address` kept distinct per spec, `location` retained for back-compat |
| `managerId` | `String?` + relation to `User` | nullable |
| `status` | `WarehouseStatus  @default(ACTIVE)` | new enum `ACTIVE / INACTIVE` |

**`Inventory`** — add `averageCost Decimal? @db.Decimal(14, 2)` (per-warehouse
cost; `Product.averageCost` is the global roll-up). `availableQuantity` stays
derived, never a column (existing rule).

**`StockMovement`** — add columns (all nullable, existing rows untouched):

| Column | Type | Note |
| --- | --- | --- |
| `balanceAfter` | `Int?` | on-hand quantity after this movement |
| `referenceType` | `String?` | `"GoodsReceipt"`, `"WriteOff"`, `"Order"`, … |
| `referenceId` | `String?` | id of that row |
| `unitCost` | `Decimal?  @db.Decimal(14, 2)` | cost carried by this movement |
| `warehouseId` | `String?` + relation | denormalised from `inventory.warehouseId` for direct ledger queries + the spec's `stock_movements` shape; set on every new write, left null on legacy rows |

Index: `@@index([referenceType, referenceId])`, `@@index([warehouseId, createdAt])`.

**`AuditLog`** — add `ipAddress String?`. `AuditService.record()` gains an
optional `ipAddress` field on `AuditEntry`; existing callers unaffected.

**New models** (Phase 1 builds receipts; write-off / count / transfer tables are
Phase 3–5 and are **not** added now):

```
enum GoodsReceiptStatus { DRAFT APPROVED CANCELLED }

model GoodsReceipt {
  id             String   @id @default(cuid())
  receiptNumber  String   @unique              // auto: GR-2026-0001, gapless via a sequence row
  warehouseId    String
  warehouse      Warehouse @relation(fields: [warehouseId], references: [id])
  supplierName   String?                        // free text — no Supplier model yet
  status         GoodsReceiptStatus @default(DRAFT)
  subtotal       Decimal  @default(0) @db.Decimal(14, 2)
  discount       Decimal  @default(0) @db.Decimal(14, 2)
  tax            Decimal  @default(0) @db.Decimal(14, 2)
  total          Decimal  @default(0) @db.Decimal(14, 2)
  note           String?
  createdById    String
  createdBy      User     @relation("GoodsReceiptCreatedBy", fields: [createdById], references: [id])
  approvedById   String?
  approvedBy     User?    @relation("GoodsReceiptApprovedBy", fields: [approvedById], references: [id])
  approvedAt     DateTime?
  items          GoodsReceiptItem[]
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@index([warehouseId, status])
  @@index([status, createdAt])
}

model GoodsReceiptItem {
  id            String  @id @default(cuid())
  goodsReceiptId String
  goodsReceipt  GoodsReceipt @relation(fields: [goodsReceiptId], references: [id], onDelete: Cascade)
  productId     String
  product       Product @relation(fields: [productId], references: [id])
  quantity      Int
  unitCost      Decimal @db.Decimal(14, 2)
  lineTotal     Decimal @db.Decimal(14, 2)   // quantity * unitCost, recomputed on write

  @@index([goodsReceiptId])
  @@index([productId])
}

model GoodsReceiptSequence {           // gapless receipt numbering — exact copy of the OrderSequence pattern
  id         Int @id @default(1)
  lastNumber Int @default(0)
}
```

`receiptNumber` is built inside the approve/create `$transaction` with a
`SELECT … FOR UPDATE` on the single `GoodsReceiptSequence` row (same as
`OrderSequence`), formatted `GR-<YYYY>-<NNNN>` where `<YYYY>` is
`new Date().getFullYear()` (display only) and `<NNNN>` is the zero-padded global
counter. The counter is not reset per year in Phase 1.

### B2. Migration (`prisma migrate dev --name warehouse_phase1`)

Authored against **staging**. Must be reviewed for:
- `Warehouse.code` — `ADD COLUMN … ` nullable, backfill `UPDATE` by row order,
  then `SET NOT NULL` + `ADD UNIQUE`. Three statements, hand-edited into the
  generated SQL if Prisma emits a plain `NOT NULL` add.
- Everything else is nullable/defaulted `ADD COLUMN`, `CREATE TABLE`,
  `ALTER TYPE … ADD VALUE`, `CREATE INDEX` — purely additive.
- `grep -E "DROP |RENAME |ALTER COLUMN .* TYPE"` on the final SQL must be empty
  (same gate step 2 used).

Not applied to production in this session.

### B3. Module structure

New `WarehouseModule` grouping sub-features, mounted in `app.module.ts`.
Existing `warehouses` / `inventory` / `stock-movements` modules stay where they
are; the new module sits alongside and **reuses `InventoryService`** for the
stock math rather than duplicating it.

```
src/warehouse/
  warehouse.module.ts
  products/            # /api/v1/warehouse/products  (warehouse-flavoured product read + write)
    warehouse-products.controller.ts
    warehouse-products.service.ts
    dto/{query-warehouse-products.dto.ts, create-warehouse-product.dto.ts, update-warehouse-product.dto.ts}
  receipts/            # /api/v1/warehouse/goods-receipts
    goods-receipts.controller.ts
    goods-receipts.service.ts
    goods-receipts.service.spec.ts
    dto/{create-goods-receipt.dto.ts, update-goods-receipt.dto.ts, query-goods-receipts.dto.ts}
  reports/             # /api/v1/warehouse/reports
    warehouse-reports.controller.ts
    warehouse-reports.service.ts
```

`api/v1` prefix: existing controllers use bare paths (`@Controller('warehouses')`)
and a global prefix is set in `main.ts`. Phase 1 mirrors the spec's
`/api/v1/warehouse/...` by using `@Controller('warehouse/products')` etc.; the
plan checks `main.ts` for an existing global `api/v1` prefix and aligns.

### B4. Endpoints (Phase 1)

**Products** (`MANAGER_UP` write, `SELLER_UP` read):
- `GET  /warehouse/products` — server-side pagination; filters
  `warehouseId, categoryId, brandId, status`; search `q` over
  name / sku / oem / barcode. Returns per-warehouse stock (on-hand, reserved,
  available) when `warehouseId` is given, else totals.
- `GET  /warehouse/products/:id`
- `POST /warehouse/products` — create; `AuditLog` CREATE
- `PATCH /warehouse/products/:id` — update; `AuditLog` UPDATE (before/after diff)
- `GET  /warehouse/products/:id/movements` — stock ledger for one product,
  paginated, with running `balanceAfter`

**Warehouses** — extend the existing `WarehousesController` rather than
re-implement: add `code` (unique, 409 on conflict), `address`, `managerId`,
`status` to its DTOs and `WarehousesService`. `GET /warehouses/:id` gains a
stock-value summary. No second warehouse controller.

**Goods receipts** (`MANAGER_UP`):
- `GET  /warehouse/goods-receipts` — list, paginated, filter
  `warehouseId, status`, search on `receiptNumber` / `supplierName`
- `GET  /warehouse/goods-receipts/:id` — with items
- `POST /warehouse/goods-receipts` — create as `DRAFT`; totals computed
  server-side from items; `AuditLog` CREATE
- `PATCH /warehouse/goods-receipts/:id` — only while `DRAFT`; `AuditLog` UPDATE
- `POST /warehouse/goods-receipts/:id/approve` — **transaction**:
  1. guard `status === DRAFT`
  2. for each item: upsert `Inventory` row, `updateMany` with
     `WHERE id = … ` incrementing `quantity` (receipts only ever add, so no
     negative-stock check here), read new balance
  3. create one `StockMovement` per item — `type: PURCHASE`,
     `balanceAfter`, `referenceType: "GoodsReceipt"`, `referenceId`,
     `unitCost`, `warehouseId`, `createdById`
  4. recompute `Inventory.averageCost` (weighted) and roll up
     `Product.averageCost` + `Product.lastPurchaseCost`
  5. set receipt `status: APPROVED`, `approvedById`, `approvedAt`
  6. `AuditLog` APPROVE
  Any failure → whole `$transaction` rolls back.
- `POST /warehouse/goods-receipts/:id/cancel` — `DRAFT → CANCELLED` only
  (an `APPROVED` receipt cannot be cancelled in Phase 1 — reversing stock is a
  Phase 3 concern). No hard delete. `AuditLog` (action `REJECT`).

**Reports** (`SELLER_UP`):
- `GET /warehouse/reports/stock` — per-warehouse breakdown + stock value
  (`sum(quantity * coalesce(inventory.averageCost, product.purchasePrice, 0))`)
- `GET /warehouse/reports/low-stock` — `available <= product.minStock`
  (there is already a `seller/inventory/low-stock`; this is the warehouse-scoped
  version with cost columns)
- `GET /warehouse/reports/movements` — global stock ledger, paginated,
  filter `warehouseId, productId, type, dateFrom, dateTo`

### B5. Business rules (how the spec's mandatory rules map)

1. **Stock only moves via `StockMovement` inside `$transaction`.** Enforced by
   keeping all writes in `GoodsReceiptsService.approve()` /
   `InventoryService`; no controller touches `Inventory` directly. Existing
   `InventoryService.adjust()` already the only manual path.
2. **Negative stock** — not reachable in Phase 1 (receipts only add). The
   guard text `"Mahsulot qoldig'i yetarli emas. Available: X, Requested: Y"`
   already exists in `InventoryService.reserveForOrder`; Phase 3 (write-offs)
   reuses it. `allowNegativeStock` permission is deferred to Phase 3.
3. **Atomic decrement** — `tx.inventory.updateMany({ where: { id, quantity: { gte: X } }, data: { decrement } })` + `count === 0 → ConflictException`.
   Helper added to `InventoryService` now, exercised by Phase 3; Phase 1's
   increments don't need it but the helper lands with tests.
4. **No hard delete** on `GoodsReceipt` — only `status: CANCELLED`. Enforced;
   no `DELETE` endpoint.
5. **AuditLog on every C/U/Approve/Cancel** — via `AuditService.record()`,
   already fire-and-forget safe.
6. **Available = on-hand − reserved** — unchanged; reserve/release endpoints
   already exist for the order flow.

### B6. Errors

`class-validator` DTOs per endpoint. Domain errors thrown as
`BadRequestException` / `ConflictException` / `NotFoundException` with plain
Uzbek/plain messages (matching existing style — e.g. `"Ombor kodi band: W1"`,
`"Faqat DRAFT holatidagi qabulni tasdiqlash mumkin"`). No stack traces to the
client (Nest's default filter already does this).

### B7. Tests

- `goods-receipts.service.spec.ts` — create computes totals; approve moves
  stock + writes movements + audit + updates costs; approve is idempotent-safe
  (second approve → 400); cancel only from DRAFT; transaction rollback on a
  bad product id leaves stock untouched.
- `warehouse-products.service.spec.ts` — search matches sku/oem/barcode;
  pagination meta; audit diff on update.
- `warehouse-reports.service.spec.ts` — stock value math; low-stock threshold.
- Extend `warehouses.service.spec` (if present) for `code` uniqueness.
- Atomic-decrement helper unit test in `inventory.service.spec.ts`.

### B8. Verification gate (per `CLAUDE.md`)

After each phase slice: `npx tsc --noEmit`, `npx eslint`, `npx jest`,
`npx nest build` — all clean before "done".

---

## Out of scope (later phases)

- **Phase 3** — Write-offs (`WriteOff` / `WriteOffItem`, reason enum),
  `allowNegativeStock` permission, atomic-decrement in anger.
- **Phase 4** — Transfers (`Transfer` / `TransferItem`, `from != to`,
  in-transit state, receive endpoint).
- **Phase 5** — Inventory counts (`InventoryCount` / `InventoryCountItem`,
  system vs actual, adjustment on approve).
- **Supplier model** — `Supplier`, `Product.supplierId`, `SupplierPrice`
  history (also blocks supplier analytics — see `analytics-blocked-on-schema`).
- **Applying any migration to production** — folded into the pending Railway
  redeploy, separately approved.
- **Frontend** — `frontend/app/director/(panel)/warehouse/page.tsx` consumes
  these endpoints; not part of this backend task.
