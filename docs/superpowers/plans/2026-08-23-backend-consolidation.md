# Backend Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `backend/` (NestJS + Prisma) the single source of truth for all data and business logic. The root Next.js app stops touching Postgres entirely and becomes a pure frontend that calls `backend/`'s REST API.

**Architecture:** `backend/`'s Prisma schema (a warehouse/POS system) is extended to absorb everything the root schema has that it doesn't (i18n catalog, reviews, inquiries, discount-approval workflow, audit log). Every Next.js file that currently imports `@/lib/db` gets its *internals* rewritten to call `backend/` over HTTP — but its exported function names, parameter types, and return shapes stay byte-for-byte identical wherever practical, so every caller (API routes, server components, `components/admin/*`, `hooks/admin/*`) needs zero changes. This is the load-bearing decision of the whole plan: it turns "rewrite the frontend" into "rewrite what's behind 19 repository files," which is the only way this is tractable in one pass.

**Tech Stack:** NestJS 10, Prisma ORM 7 (`prisma-client` generator, driver adapters), class-validator DTOs, Passport JWT. Next.js 15 App Router, Zod, `server-only`.

**Spec:** User request in this conversation (consolidate all data access into `backend/`; `backend/`'s schema stays and absorbs what it's missing; don't touch `app/(seller-auth)/`, `app/seller/**`, `lib/api/seller-panel/**`, `lib/store/seller-auth-store.ts`). Confirmed with the user: full merge into `backend/`'s schema, not a scoped/partial merge.

## Global Constraints

- Do not touch: `app/(seller-auth)/`, `app/seller/**`, `components/seller/**`, `hooks/seller/**`, `lib/seller/**`, `lib/api/seller-panel/**`, `lib/store/seller-auth-store.ts`. These are already correctly wired to `backend/` only.
- Every repository file's **public exports** (function names, parameter types, return types) must stay unchanged unless a task explicitly says otherwise. Route handlers, server components, and admin UI code must not need edits as a result of the swap from Prisma to HTTP.
- `backend/` is a separate npm project (own `package.json`, own `node_modules`, not a workspace member of root). It must build, lint, and test independently at every checkpoint.
- After the final task, nothing outside `backend/` may import `@/lib/db`, `@prisma/client`, or `@/prisma/generated/*`. `prisma/` at the repo root is deleted entirely.
- All money fields stay `Decimal` end-to-end; convert to `number` only at the Next.js response-mapping boundary, exactly as the current repositories already do.
- Uzbek user-facing strings (e.g. notification messages, validation errors) in the ported logic must be preserved verbatim — they are product copy, not incidental.
- Run `npx tsc --noEmit`, `npm run lint`, `npm run build`, and the relevant test suite in **both** `backend/` and the root app after every task that touches that project. A task is not done until both are clean.

---

## Part 0 — Reference material (read this before any task)

**`backend/`'s module pattern** (mimic this shape for every new/extended module — do not invent a different structure):
- `backend/src/<domain>/<domain>.module.ts` — registers controller(s) + service, exports service.
- `backend/src/<domain>/<domain>.controller.ts` — `@Controller('<path>')`, `@UseGuards(JwtAuthGuard, RolesGuard)`, `@Roles(...)` from `backend/src/common/roles.ts` (`MANAGER_UP`, `DIRECTOR_UP`, `SELLER_UP`, `ALL_ROLES`). Thin: delegates to the service, no business logic.
- `backend/src/<domain>/<domain>.service.ts` — all logic, `PrismaService` injected, throws Nest exceptions (`NotFoundException`, `ConflictException`, `BadRequestException`, `ForbiddenException`).
- `backend/src/<domain>/dto/*.dto.ts` — class-validator DTOs. `Update*Dto extends PartialType(Create*Dto)`.
- `@CurrentUser()` (from `backend/src/common/decorators/current-user.decorator.ts`) injects `AuthenticatedUser` (`{ sub, phone, role, sellerId }` roughly — check `backend/src/auth/auth.types.ts`) into a handler param.
- Pagination: extend `PaginationDto` (`backend/src/common/dto/pagination.dto.ts`), return `{ data, meta: paginationMeta(page, limit, total) }`.
- A seller-scoped mirror controller (e.g. `seller-products.controller.ts`) exists beside some admin controllers, mounted at `seller/<resource>`, restricted to `SELLER_UP`, calling the same service's `*Seller` methods which strip privileged fields (see `ProductsService.toSellerView`).

**Next.js's existing HTTP-client pattern to mirror** (`lib/api/seller-panel/client.ts`): base URL from `NEXT_PUBLIC_API_URL`/an internal server-side backend URL, `sellerApiRequest<T>(path, {method, body, query})`, 401 triggers a single coalesced refresh-and-retry, throws a typed `ApiError` on failure. Part 3 builds a **server-side** analogue of this (no zustand — Next.js server code holds tokens in its own encrypted session cookie, not in-memory browser state).

**Root schema fields being retired as raw columns** (they become computed, exactly как `ProductsService.withStock()` already computes them for backend's own admin product list today): `Product.stock`, `Product.stockStatus`. Post-merge, "stock" for a product is always `sum(Inventory.quantity - Inventory.reservedQuantity)` across warehouses. Every ported piece of root logic that read `product.stock` must be rewritten to read the computed `availableQuantity` instead (Part 1, Task 6 and Part 2, Task 9 call this out explicitly where it matters).

---

## Part 1 — Schema unification (do this first; everything else depends on it)

### Task 1: Extend `backend/prisma/schema.prisma` and migrate

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/<timestamp>_consolidate_storefront_crm/migration.sql` (via `npx prisma migrate dev --name consolidate_storefront_crm`, then hand-edit the generated SQL for the data backfill described below — do not hand-write the DDL from scratch, let Prisma generate it from the schema diff, then insert backfill statements before the `NOT NULL`/constraint statements that need the backfilled data to already be in place)
- Test: `backend/src/products/stock-status.spec.ts` and `backend/src/orders/order-status-transitions.spec.ts` must still pass unmodified proves the enum/status changes below didn't break existing logic (Task 8/10 will add new cases)

**Target schema — replace the relevant models in `backend/prisma/schema.prisma` with:**

```prisma
enum Role {
  SUPER_ADMIN
  DIRECTOR
  MANAGER
  SELLER
  VIEWER
}

enum OrderStatus {
  DRAFT
  NEW
  CONFIRMED
  PREPARING
  COMPLETED
  CANCELLED
}

enum OrderPaymentStatus {
  UNPAID
  PARTIAL
  PAID
}

enum DiscountStatus {
  PENDING
  APPROVED
  REJECTED
}

enum InquiryStatus {
  NEW
  IN_PROGRESS
  WON
  LOST
}

enum InquirySource {
  PRODUCT_DIALOG
  QUOTE_FORM
  CONTACT_FORM
}

enum AuditAction {
  CREATE
  UPDATE
  DELETE
  APPROVE
  REJECT
  IMPORT
  LOGIN
}

enum StockMovementType {
  IN
  OUT
  RESERVE
  RELEASE
}

enum PaymentMethod {
  CASH
  CARD
  TRANSFER
  ONLINE
}

enum PaymentStatus {
  PENDING
  COMPLETED
  FAILED
  REFUNDED
}

model User {
  id           String   @id @default(cuid())
  /// Nullable: some accounts (director/staff created via the old email-based
  /// admin login) may have no phone on file. At least one of phone/email must
  /// be set — enforced in CreateUserDto/UserWriteInput, not at the DB level.
  phone        String?  @unique
  /// Nullable for the same reason: the warehouse/POS side never required one.
  email        String?  @unique
  name         String   @default("")
  passwordHash String   @map("password_hash")
  role         Role     @default(SELLER)
  isActive     Boolean  @default(true) @map("is_active")
  /// Percent this account may discount an order without director approval.
  discountLimit Int     @default(5) @map("discount_limit")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  seller               Seller?
  refreshTokens        RefreshToken[]
  notifications        Notification[]
  stockMovementsMade   StockMovement[]
  assignedInquiries    Inquiry[]         @relation("AssignedInquiries")
  assignedCustomers    Customer[]        @relation("AssignedCustomers")
  requestedDiscounts   DiscountRequest[] @relation("RequestedDiscounts")
  reviewedDiscounts    DiscountRequest[] @relation("ReviewedDiscounts")
  auditLogs            AuditLog[]

  @@map("users")
}

model RefreshToken {
  id        String    @id @default(cuid())
  userId    String    @map("user_id")
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  tokenHash String    @map("token_hash")
  expiresAt DateTime  @map("expires_at")
  revokedAt DateTime? @map("revoked_at")
  createdAt DateTime  @default(now()) @map("created_at")

  @@index([userId])
  @@map("refresh_tokens")
}

model Seller {
  id          String     @id @default(cuid())
  userId      String     @unique @map("user_id")
  user        User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  warehouseId String?    @map("warehouse_id")
  warehouse   Warehouse? @relation(fields: [warehouseId], references: [id])
  createdAt   DateTime   @default(now()) @map("created_at")
  updatedAt   DateTime   @updatedAt @map("updated_at")

  orders Order[]

  @@index([warehouseId])
  @@map("sellers")
}

/// A buyer a seller works with repeatedly. `debt` is the warehouse/POS side's
/// running balance; `assignedSellerId`/pool-claim is the CRM side's ownership
/// model. Both are kept — they answer different questions and neither implies
/// the other.
model Customer {
  id               String   @id @default(cuid())
  name             String
  /// Not unique: a company switchboard is shared by several contacts. (The
  /// old backend schema had this unique; that constraint is dropped here
  /// because root's model — and its seller-claim workflow — depends on
  /// non-unique phone. See Task 1's migration notes.)
  phone            String
  email            String?
  company          String?
  telegram         String?
  notes            String?
  debt             Decimal  @default(0) @db.Decimal(14, 2)
  /// Null = unassigned — visible to directors, claimable by any seller.
  assignedSellerId String?  @map("assigned_seller_id")
  assignedSeller   User?    @relation("AssignedCustomers", fields: [assignedSellerId], references: [id], onDelete: SetNull)
  createdAt        DateTime @default(now()) @map("created_at")
  updatedAt        DateTime @updatedAt @map("updated_at")

  orders Order[]

  @@index([assignedSellerId])
  @@index([phone])
  @@map("customers")
}

/// A node in the catalog tree. Roots are the mega-menu's columns; children
/// hang off them; a product hangs off a leaf.
model Category {
  id        String     @id @default(cuid())
  slug      String     @unique
  nameUz    String     @map("name_uz")
  nameRu    String     @map("name_ru")
  nameEn    String     @map("name_en")
  /// Part family this branch belongs to — "engine", "brakes", "filters".
  type      String     @default("general")
  parentId  String?    @map("parent_id")
  parent    Category?  @relation("CategoryTree", fields: [parentId], references: [id])
  children  Category[] @relation("CategoryTree")
  order     Int        @default(0)
  icon      String?
  createdAt DateTime   @default(now()) @map("created_at")
  updatedAt DateTime   @updatedAt @map("updated_at")

  products Product[]

  @@index([parentId, order])
  @@map("categories")
}

model Brand {
  id        String   @id @default(cuid())
  slug      String   @unique
  name      String   @unique
  logoUrl   String?  @map("logo_url")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  products Product[]

  @@map("brands")
}

model Product {
  id               String   @id @default(cuid())
  slug             String   @unique
  sku              String   @unique
  oemNumbers       String[] @default([]) @map("oem_numbers")
  nameUz           String   @map("name_uz")
  nameRu           String   @map("name_ru")
  nameEn           String   @map("name_en")
  descriptionUz    String   @default("") @map("description_uz")
  descriptionRu    String   @default("") @map("description_ru")
  descriptionEn    String   @default("") @map("description_en")
  categoryId       String   @map("category_id")
  category         Category @relation(fields: [categoryId], references: [id])
  brandId          String   @map("brand_id")
  brand            Brand    @relation(fields: [brandId], references: [id])
  compatibleModels String[] @default([]) @map("compatible_models")
  specs            Json     @default("{}")
  /// Nullable: a "price on request" product has no catalog figure. Storefront
  /// order lines snapshot this at order time; when null, the caller (order
  /// creation) must supply a price explicitly. Renamed from the old
  /// `sellingPrice` — same meaning, root's name kept since it's the one
  /// customer-facing and CSV-import code already uses.
  price            Decimal? @db.Decimal(14, 2)
  currency         String   @default("UZS")
  /// SELLER role never sees this (see ProductsService.SELLER_HIDDEN_FIELDS).
  purchasePrice    Decimal? @map("purchase_price") @db.Decimal(14, 2)
  /// Renamed from `image` to `imageUrl` to match the in-flight product-image
  /// feature (migration 20260823062921_add_product_image_url) and the
  /// customer-facing naming everywhere else.
  imageUrl         String?  @map("image_url")
  minStock         Int      @default(0) @map("min_stock")
  isActive         Boolean  @default(true) @map("is_active")
  createdAt        DateTime @default(now()) @map("created_at")
  updatedAt        DateTime @updatedAt @map("updated_at")

  inventories Inventory[]
  orderItems  OrderItem[]
  inquiries   Inquiry[]
  reviews     Review[]

  @@index([categoryId])
  @@index([brandId])
  @@index([isActive])
  @@map("products")
}

/// A buyer's rating of a part they bought. See root schema's original
/// doc-comments (preserved verbatim below) for why this is rows, not an
/// average column, and why authorPhone must never reach a public payload.
model Review {
  id          String   @id @default(cuid())
  productId   String   @map("product_id")
  product     Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  /// Whole stars, 1 to 5. A CHECK constraint in the migration enforces the
  /// range in the database, which Prisma's schema language cannot express.
  rating      Int
  body        String?
  authorName  String   @map("author_name")
  /// MUST NEVER reach a public payload. Every read path selects columns
  /// explicitly for that reason — see ReviewsService.
  authorPhone String   @map("author_phone")
  isApproved  Boolean  @default(true) @map("is_approved")
  createdAt   DateTime @default(now()) @map("created_at")

  @@unique([productId, authorPhone])
  @@index([productId, isApproved, createdAt])
  @@index([isApproved, createdAt])
  @@map("reviews")
}

model Inquiry {
  id               String        @id @default(cuid())
  customerName     String        @map("customer_name")
  phone            String
  email            String?
  message          String
  productId        String?       @map("product_id")
  product          Product?      @relation(fields: [productId], references: [id], onDelete: SetNull)
  productSku       String?       @map("product_sku")
  quantity         Int?
  status           InquiryStatus @default(NEW)
  source           InquirySource
  assignedSellerId String?       @map("assigned_seller_id")
  assignedSeller   User?         @relation("AssignedInquiries", fields: [assignedSellerId], references: [id], onDelete: SetNull)
  notes            String?
  followUpAt       DateTime?     @map("follow_up_at")
  createdAt        DateTime      @default(now()) @map("created_at")

  orders Order[]

  @@index([status, createdAt])
  @@index([assignedSellerId])
  @@index([followUpAt])
  @@map("inquiries")
}

model Warehouse {
  id        String   @id @default(cuid())
  name      String
  location  String?
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  sellers     Seller[]
  inventories Inventory[]
  orders      Order[]

  @@map("warehouses")
}

model Inventory {
  id               String    @id @default(cuid())
  productId        String    @map("product_id")
  product          Product   @relation(fields: [productId], references: [id])
  warehouseId      String    @map("warehouse_id")
  warehouse        Warehouse @relation(fields: [warehouseId], references: [id])
  quantity         Int       @default(0)
  reservedQuantity Int       @default(0) @map("reserved_quantity")
  createdAt        DateTime  @default(now()) @map("created_at")
  updatedAt        DateTime  @updatedAt @map("updated_at")

  stockMovements StockMovement[]

  @@unique([productId, warehouseId])
  @@index([warehouseId])
  @@map("inventories")
}

model StockMovement {
  id          String            @id @default(cuid())
  inventoryId String            @map("inventory_id")
  inventory   Inventory         @relation(fields: [inventoryId], references: [id])
  type        StockMovementType
  quantity    Int
  reason      String?
  createdById String?           @map("created_by")
  createdBy   User?             @relation(fields: [createdById], references: [id])
  createdAt   DateTime          @default(now()) @map("created_at")

  @@index([inventoryId])
  @@index([createdAt])
  @@map("stock_movements")
}

model OrderSequence {
  id         Int @id @default(1)
  lastNumber Int @default(1000) @map("last_number")

  @@map("order_sequences")
}

model Order {
  id                       String             @id @default(cuid())
  orderNumber              String             @unique @map("order_number")
  customerId               String             @map("customer_id")
  customer                 Customer           @relation(fields: [customerId], references: [id])
  sellerId                 String             @map("seller_id")
  seller                   Seller             @relation(fields: [sellerId], references: [id])
  /// Nullable: a CRM order raised through the seller board has no warehouse
  /// until it is confirmed and inventory actually needs reserving (see
  /// OrdersService.updateStatus, which resolves a warehouse at CONFIRMED
  /// time — Task 10). A POS order created with a warehouseId up front (the
  /// existing backend flow) still sets this immediately, unchanged.
  warehouseId              String?            @map("warehouse_id")
  warehouse                Warehouse?         @relation(fields: [warehouseId], references: [id])
  status                   OrderStatus        @default(DRAFT)
  currency                 String             @default("UZS")
  subtotal                 Decimal            @db.Decimal(14, 2)
  /// Flat-amount discount — the original POS quick-sale mechanism. Kept
  /// alongside the percent workflow below rather than merged into it: the two
  /// serve different flows (walk-in POS sale vs. seller-negotiated CRM order)
  /// and merging them would change either flow's existing behavior.
  discount                 Decimal            @default(0) @db.Decimal(14, 2)
  deliveryFee              Decimal            @default(0) @map("delivery_fee") @db.Decimal(14, 2)
  /// Percent the seller asked for (CRM flow). Within their User.discountLimit
  /// it applies immediately; above it, a DiscountRequest gates approval.
  discountRequestedPercent Decimal            @default(0) @map("discount_requested_percent") @db.Decimal(5, 2)
  discountApprovedPercent  Decimal            @default(0) @map("discount_approved_percent") @db.Decimal(5, 2)
  total                    Decimal            @db.Decimal(14, 2)
  paymentStatus            OrderPaymentStatus @default(UNPAID) @map("payment_status")
  notes                    String?
  /// Set when the order was raised from a CRM board card.
  inquiryId                String?            @map("inquiry_id")
  inquiry                  Inquiry?           @relation(fields: [inquiryId], references: [id], onDelete: SetNull)
  createdAt                DateTime           @default(now()) @map("created_at")
  updatedAt                DateTime           @updatedAt @map("updated_at")

  items            OrderItem[]
  payments         Payment[]
  invoice          Invoice?
  discountRequests DiscountRequest[]

  @@index([status])
  @@index([customerId])
  @@index([sellerId])
  @@index([createdAt])
  @@index([inquiryId])
  @@map("orders")
}

model OrderItem {
  id          String  @id @default(cuid())
  orderId     String  @map("order_id")
  order       Order   @relation(fields: [orderId], references: [id], onDelete: Cascade)
  productId   String  @map("product_id")
  product     Product @relation(fields: [productId], references: [id], onDelete: Restrict)
  /// Snapshots so a line still reads correctly after the product is renamed,
  /// repriced, or retired.
  productSku  String  @map("product_sku")
  productName String  @map("product_name")
  quantity    Int
  price       Decimal @db.Decimal(14, 2)
  total       Decimal @db.Decimal(14, 2)

  @@index([orderId])
  @@index([productId])
  @@map("order_items")
}

model DiscountRequest {
  id               String         @id @default(cuid())
  orderId          String         @map("order_id")
  order            Order          @relation(fields: [orderId], references: [id], onDelete: Cascade)
  sellerId         String         @map("seller_id")
  seller           User           @relation("RequestedDiscounts", fields: [sellerId], references: [id], onDelete: Restrict)
  requestedPercent Decimal        @map("requested_percent") @db.Decimal(5, 2)
  reason           String?
  status           DiscountStatus @default(PENDING)
  reviewedByUserId String?        @map("reviewed_by_user_id")
  reviewedBy       User?          @relation("ReviewedDiscounts", fields: [reviewedByUserId], references: [id], onDelete: SetNull)
  reviewedAt       DateTime?      @map("reviewed_at")
  decisionNote     String?        @map("decision_note")
  createdAt        DateTime       @default(now()) @map("created_at")

  @@index([status, createdAt])
  @@index([sellerId])
  @@index([orderId])
  @@map("discount_requests")
}

model Payment {
  id        String        @id @default(cuid())
  orderId   String        @map("order_id")
  order     Order         @relation(fields: [orderId], references: [id], onDelete: Cascade)
  amount    Decimal       @db.Decimal(14, 2)
  method    PaymentMethod
  status    PaymentStatus @default(PENDING)
  paidAt    DateTime?     @map("paid_at")
  createdAt DateTime      @default(now()) @map("created_at")
  updatedAt DateTime      @updatedAt @map("updated_at")

  @@index([orderId])
  @@map("payments")
}

model Invoice {
  id            String   @id @default(cuid())
  orderId       String   @unique @map("order_id")
  order         Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)
  invoiceNumber String   @unique @map("invoice_number")
  issuedAt      DateTime @default(now()) @map("issued_at")
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  @@map("invoices")
}

model Notification {
  id        String           @id @default(cuid())
  userId    String           @map("user_id")
  user      User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  /// Root's typed enum, richer than backend's free-text title/body. Kept as
  /// the source of truth; `title`/`body` collapse into one `message`.
  type      NotificationType
  message   String
  entityId  String?          @map("entity_id")
  isRead    Boolean          @default(false) @map("is_read")
  createdAt DateTime         @default(now()) @map("created_at")

  @@index([userId, isRead, createdAt])
  @@map("notifications")
}

enum NotificationType {
  LOW_STOCK
  NEW_INQUIRY
  DISCOUNT_REQUESTED
  DISCOUNT_DECIDED
  ORDER_STATUS
}

model AuditLog {
  id         String      @id @default(cuid())
  userId     String?     @map("user_id")
  user       User?       @relation(fields: [userId], references: [id], onDelete: SetNull)
  action     AuditAction
  entityType String      @map("entity_type")
  entityId   String      @map("entity_id")
  before     Json?
  after      Json?
  createdAt  DateTime    @default(now()) @map("created_at")

  @@index([entityType, entityId])
  @@index([userId, createdAt])
  @@index([createdAt])
  @@map("audit_logs")
}
```

**Reconciliation decisions made here (document these in the task's commit message too):**
1. `Product.stock`/`stockStatus` columns dropped — stock is always computed from `Inventory` (Part 0). `Product.price` replaces `sellingPrice` (nullable, for "price on request"); `purchasePrice` becomes nullable since not every migrated storefront product has one on record.
2. `Product.image` renamed to `imageUrl`; `Category.name` (unique flat) replaced by `nameUz/nameRu/nameEn` + `slug` (unique).
3. `Customer.phone` uniqueness is **dropped** (was unique in the old backend schema) — root's CRM model requires multiple customer cards per phone (shared switchboards) to work. `Customer.debt` (POS) and `Customer.assignedSellerId` (CRM claim) coexist.
4. `Order.warehouseId` becomes nullable to support CRM orders that don't pick a warehouse until confirmation (Task 10 explains the resolution logic). `Order.discount` (flat, POS) and `Order.discountRequestedPercent`/`discountApprovedPercent` (percent, CRM approval workflow) coexist rather than merging — different flows, preserve both unchanged.
5. `OrderStatus` gains `DRAFT` (CRM) alongside existing `NEW/CONFIRMED/PREPARING/COMPLETED/CANCELLED`; Task 10 defines the unified transition table.
6. `User.phone` becomes nullable (unique when present); `User.email`, `name`, `discountLimit` added. At least one of phone/email is required at the application layer (DTO validation), not enforced by the DB.
7. `Notification.title`+`body` collapse into root's typed `type` (`NotificationType` enum) + `message`; backend's plain `Notification` rows get backfilled with `type = ORDER_STATUS` (best-effort default; there is no better signal in the old data) as part of the migration SQL.

**Data backfill to hand-write into the generated migration SQL** (after `npx prisma migrate dev --name consolidate_storefront_crm` generates the DDL, edit it before it applies — the dev DB has already been seeded with warehouse/POS test data per the audit, and that data must survive):
```sql
-- Category: old flat `name` -> all three i18n columns, plus a generated slug
UPDATE categories SET name_uz = name, name_ru = name, name_en = name, slug = lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(id, 1, 6) WHERE name_uz IS NULL;
-- Product: old `name`/`image`/`selling_price` -> new columns
UPDATE products SET name_uz = name, name_ru = name, name_en = name, description_uz = COALESCE(description, ''), description_ru = COALESCE(description, ''), description_en = COALESCE(description, ''), price = selling_price, image_url = image, slug = lower(regexp_replace(sku, '[^a-zA-Z0-9]+', '-', 'g')) WHERE name_uz IS NULL;
-- User: give every existing staff account a synthetic slug-based name if it has none
UPDATE users SET name = COALESCE(NULLIF(name, ''), 'Staff ' || substr(id, 1, 6));
-- Notification: backfill enum + message from title/body
UPDATE notifications SET type = 'ORDER_STATUS', message = COALESCE(title || ': ' || body, body) WHERE type IS NULL;
-- Give every existing Seller-linked User a default Warehouse if warehouses exist but sellers.warehouse_id is null (unchanged rows keep working); if backend/'s seed created no warehouse, create one:
INSERT INTO warehouses (id, name, created_at, updated_at) SELECT 'default-warehouse', 'Main', now(), now() WHERE NOT EXISTS (SELECT 1 FROM warehouses);
UPDATE sellers SET warehouse_id = 'default-warehouse' WHERE warehouse_id IS NULL;
```
Adjust column/table names in this SQL to match whatever `snake_case` names the Prisma-generated migration actually produces (the `@map`/`@@map` directives above are the source of truth — verify against the generated file rather than assuming).

**Steps:**
- [ ] Write the target schema above into `backend/prisma/schema.prisma` (merge with, don't blindly overwrite, anything added to `backend/` since this plan was written — check `git log backend/prisma/schema.prisma` first)
- [ ] Run `cd backend && npx prisma migrate dev --name consolidate_storefront_crm` against a local/dev database seeded with backend's current test data
- [ ] Open the generated migration SQL, insert the backfill statements above in the correct order (before any `ALTER COLUMN ... SET NOT NULL` on columns the backfill populates), and re-run the migration on a fresh copy of the dev DB to confirm it applies cleanly end-to-end
- [ ] Run `cd backend && npx prisma generate`
- [ ] Run `cd backend && npx tsc --noEmit` — fix every compile error this schema change causes across existing modules (categories.service.ts's `name` select, products.service.ts's `category.name`/`image` references, notifications' `title`/`body` usage, customers seed data, etc. — this is expected; each is a one-line rename)
- [ ] Run `cd backend && npm run lint && npm test`
- [ ] Commit: `git add backend/prisma backend/src && git commit -m "feat(backend): extend schema to absorb storefront + CRM domain"`

---

## Part 2 — New NestJS modules

Each of these four is a full new module. Build each one, verify (`tsc`/lint/test), commit, before moving to the next — they don't depend on each other.

### Task 2: Reviews module

**Files:**
- Create: `backend/src/reviews/reviews.module.ts`, `reviews.controller.ts`, `reviews.service.ts`
- Create: `backend/src/reviews/dto/upsert-review.dto.ts`, `dto/query-review.dto.ts`, `dto/moderate-review.dto.ts`
- Test: `backend/src/reviews/reviews.service.spec.ts`

**Endpoints** (ported from `lib/api/review-repository.ts`, business rules unchanged — see that file's doc comments for the *why*, preserve them as comments on the service methods):
- `GET /reviews?productId=&page=&limit=&authorPhone=` — public, no guard. Returns only `isApproved: true` rows. `authorPhone` (optional query param, sent by Next.js from the customer's OTP session — never a header/token since backend has no concept of customer identity) marks the caller's own review with `isMine: true` in the response and is never itself returned.
- `PUT /reviews` body `{productId, authorPhone, rating, body, authorName}` — public, no guard. Upsert on `@@unique([productId, authorPhone])`, exactly as `upsertReview` — `isApproved` is untouched on update (a director's takedown survives the author editing).
- `GET /reviews/mine?productId=&authorPhone=` — public, no guard. Mirrors `getOwnReview`.
- `GET /reviews/purchase-check?productId=&phone=` — public, no guard. Mirrors `hasPurchasedProduct`: true only if there's a `COMPLETED` order whose customer's phone (canonicalized — port the digit-matching logic from `lib/auth/phone.ts`, which you'll need to also port as `backend/src/common/phone.ts`) contains this product.
- `GET /reviews/admin?page=&limit=&productId=` — `@Roles(...MANAGER_UP)`. Mirrors `listAllReviews`: all rows, visible or hidden, with product `{id, slug, name: nameUz}`.
- `PATCH /reviews/:id/approval` body `{isApproved: boolean}` — `@Roles(...MANAGER_UP)`. Mirrors `setReviewApproval`.
- `DELETE /reviews/:id` — `@Roles(...MANAGER_UP)`. Mirrors `deleteReview`.

Selecting fields: never `select` or return `authorPhone` from any endpoint except to do the internal `isMine`/purchase-check comparison — copy the `PUBLIC_FIELDS` pattern from the source file exactly, including its comment about why the leak-safety comes from the literal shape rather than an omitted field.

### Task 3: Inquiries module (create + seller board)

**Files:**
- Create: `backend/src/inquiries/inquiries.module.ts`, `inquiries.controller.ts` (public create), `seller-inquiries.controller.ts` (board, mounted `seller/inquiries`), `inquiries.service.ts`
- Create: `backend/src/inquiries/dto/create-inquiry.dto.ts`, `dto/query-inquiry.dto.ts`, `dto/update-inquiry.dto.ts`
- Create: `backend/src/inquiries/inquiry-board.ts` (pure logic, ported verbatim from `lib/api/inquiry-board.ts` — the `InquiryColumn`/`inquiryColumn()`/`inquiryColumnFilter()` derivation)
- Create: `backend/src/common/scope.ts` (pure logic, ported from `lib/api/seller-scope.ts` — `isDirector`, `inquiryReadScope`, `inquiryWriteScope`, `customerReadScope`, `customerWriteScope`, `orderReadScope`, `orderWriteScope`, `unclaimedScope`, all operating on Prisma `WhereInput`s against the new schema; `ScopeActor = { id: string; role: Role }`, sourced from `AuthenticatedUser`)
- Test: `backend/src/inquiries/inquiry-board.spec.ts` (port `inquiry-board.ts`'s existing unit tests if any exist at `lib/api/inquiry-board.test.ts` — check first), `backend/src/common/scope.spec.ts`

**Endpoints:**
- `POST /inquiries` body matches `CreateInquiryInput` from `lib/api/inquiry-repository.ts` — public, no guard (root's public-site inquiry creation).
- `GET seller/inquiries?column=&sellerId=&page=` — `@Roles(...SELLER_UP)`. Mirrors `listInquiries`, using `inquiryReadScope(actor)` from `common/scope.ts`.
- `GET seller/inquiries/board` — `@Roles(...SELLER_UP)`. Mirrors `listInquiryBoard` — all 5 columns in parallel, capped at `SELLER_PAGE_SIZE = 20` each, closed columns (`won`/`lost`) sorted newest-first, open columns oldest-first.
- `POST seller/inquiries/:id/claim` — `@Roles(...SELLER_UP)`. Mirrors `claimInquiry`'s race-safe `updateMany` compare-and-set on `assignedSellerId: null`; returns 404 vs "already taken" distinctly (map to a 409 Conflict for "taken", 404 for genuinely missing — the Next.js layer already expects to distinguish these, check `app/api/v1/inquiries/[id]/claim/route.ts` for the exact status codes it currently returns and match them).
- `PATCH seller/inquiries/:id` body `{status?, notes?, followUpAt?}` — `@Roles(...SELLER_UP)`. Mirrors `updateInquiry`, `inquiryWriteScope(actor)`, writes an audit entry only when `diffFields` (port `lib/api/audit-diff.ts` as `backend/src/common/audit-diff.ts`) finds a real change.

Every mutating endpoint calls `AuditLogService.record(...)` (Task 5) instead of importing `recordAudit` directly — inject it.

### Task 4: Discount requests module

**Files:**
- Create: `backend/src/discount-requests/discount-requests.module.ts`, `discount-requests.controller.ts`, `discount-requests.service.ts`
- Create: `backend/src/discount-requests/dto/decide-discount.dto.ts`
- Create: `backend/src/discount-requests/discount-policy.ts` (pure logic ported from `lib/api/discount-policy.ts` — `classifyDiscount`, `DIRECTOR_DISCOUNT_LIMIT`)
- Test: `backend/src/discount-requests/discount-policy.spec.ts`

**Endpoints** (ported from `lib/api/discount-repository.ts`):
- `GET /discount-requests?status=PENDING` — `@Roles(...DIRECTOR_UP)`. Mirrors `listPendingDiscounts`.
- `PATCH /discount-requests/:id/decision` body `{approve: boolean, note?: string}` — `@Roles(...DIRECTOR_UP)`. Mirrors `decideDiscount` exactly: single transaction updates the request, and on approval also updates the order's `discountApprovedPercent`/`total` (via `applyDiscount`, port `lib/api/order-money.ts` as `backend/src/orders/order-money.ts` — used by Task 10 too) and creates a `DISCOUNT_DECIDED` notification for the requesting seller with the Uzbek message strings copied verbatim (`percent + "% chegirma tasdiqlandi."` / rejected variant).
- The actual *requesting* of a discount (`requestOrderDiscount`) lives on the Orders module (Task 10) since it's really an order-mutation endpoint — this module only owns listing pending requests and deciding them.

### Task 5: Audit log module

**Files:**
- Create: `backend/src/audit/audit.module.ts`, `audit.controller.ts`, `audit.service.ts`
- Test: `backend/src/audit/audit.service.spec.ts`

**Service** (ported from `lib/api/audit.ts`): `AuditService.record(entry: {userId: string|null, action: AuditAction, entityType: string, entityId: string, before?: unknown, after?: unknown}): Promise<void>` — wraps `prisma.auditLog.create` in try/catch, **never throws**, logs failures via Nest's `Logger` instead of `console.error`. Export this service (`AuditModule` exports `AuditService`) so Tasks 2–4 and Part 2's extended modules can inject it.

**Endpoints** (ported from `lib/api/discount-repository.ts`'s `listAudit`/`listAuditEntityTypes`, which despite living in that file are really audit-log reads):
- `GET /audit?page=&entityType=` — `@Roles(...DIRECTOR_UP)`. Page size 30 (`AUDIT_PAGE_SIZE`), includes `actorName` from the joined user (null once the actor's account is deleted).
- `GET /audit/entity-types` — `@Roles(...DIRECTOR_UP)`. Distinct entity types present, for the filter dropdown.

**After this task**, go back and wire `AuditService` into every service written for Tasks 2–4 in place of the plan's "inject it" placeholders (or do this inline as you write each — whichever order is more natural given Nest's DI, `AuditModule` can be imported by `InquiriesModule`/`DiscountRequestsModule` regardless of file-creation order).

---

## Part 3 — Extend existing NestJS modules

### Task 6: Products — i18n, specs, image, CSV import/export, search

**Files:**
- Modify: `backend/src/products/products.service.ts`, `products.controller.ts`, `seller-products.controller.ts`
- Modify: `backend/src/products/dto/create-product.dto.ts`, `update-product.dto.ts`, `query-product.dto.ts`
- Create: `backend/src/products/dto/import-products.dto.ts`
- Create: `backend/src/products/product-csv.ts` (pure logic, ported verbatim from `lib/api/product-csv.ts` — parse/serialize only, no DB)
- Test: extend `backend/src/products/stock-status.spec.ts`; add `backend/src/products/product-csv.spec.ts` (port `lib/api/product-csv.test.ts`'s cases)

**Changes:**
- `CreateProductDto`/`UpdateProductDto` gain: `slug`, `oemNumbers: string[]`, `nameUz/nameRu/nameEn`, `descriptionUz/descriptionRu/descriptionEn`, `compatibleModels: string[]`, `specs: Record<string, unknown>`, `price?: number` (replaces `sellingPrice`, nullable), `currency?: string`. Drop `name`/`sellingPrice`/`image` from the DTOs (renamed, see Task 1).
- `ProductsService.create`/`update`: preserve the existing duplicate-SKU `ConflictException` check, add the same for `slug`; add the missing-category/brand `P2003` handling as a `NotFoundException` (currently create() only checks SKU — port `product-write-repository.ts`'s `duplicateField`/`isMissingReference` P2002/P2003 handling into this service). Every create/update/archive call now also calls `AuditService.record(...)` with the snapshot shape from `product-write-repository.ts`'s `auditSnapshot` (adapted: `name` → `nameUz`, `stock` → drop, since it's computed).
- `ProductsService.withStock()`: unchanged logic, but `deriveStockStatus` now also needs to work for the storefront's public read path (Task 9 needs `GET /products` filtered to `isActive: true` with no auth) — add a `findAllPublic(query)`/`findOnePublic(slug)` pair that reuses `queryWithComputedStock` but forces `where.isActive = true`, drops `purchasePrice` always (not just for SELLER), and looks up by `slug` instead of `id` for the single-product read (mirrors `lib/api/product-repository.ts`).
- New endpoint `GET products/search?q=` — `@Roles(...MANAGER_UP)` — ported from `app/api/v1/products/search/route.ts`'s query shape (read that route file for the exact response contract before porting — do not guess it).
- New endpoint `POST products/import` (multipart CSV) and `GET products/export` (CSV) — `@Roles(...MANAGER_UP)` — use `product-csv.ts`'s parse/serialize, write each row through the same `create`/`update` path so audit logging and validation are identical to a single-product write. Match the existing Next.js CSV column headers exactly (read `lib/api/product-csv.ts` for the header list — do not invent new ones).
- New endpoint `PATCH products/:id/image` body `{imageUrl: string}` — `@Roles(...MANAGER_UP)`. This does **not** handle the multipart upload itself (Part 4, Task 14 keeps that in Next.js, which still owns local-disk storage) — it only persists the URL, mirroring `setProductImage`.
- Public storefront endpoints (no `@UseGuards`, new controller `backend/src/products/public-products.controller.ts` mounted at `catalog/products` or reuse the existing `products` path with a route-level guard override — check whether `@Controller('products')`'s class-level `@UseGuards`/`@Roles` can be selectively bypassed per-route with `@SetMetadata` + a guard check, or whether a **separate public controller on a separate path** is cleaner; prefer the separate-controller approach, it's simpler and matches the existing `seller-products.controller.ts` precedent of "one controller per audience").

### Task 7: Categories — tree, i18n

**Files:**
- Modify: `backend/src/categories/categories.service.ts`, `categories.controller.ts`
- Modify: `backend/src/categories/dto/create-category.dto.ts`, `update-category.dto.ts`
- Create: `backend/src/categories/public-categories.controller.ts` (mirrors `lib/api/catalog-repository.ts`'s public tree read — no guard)

**Changes:**
- DTOs gain `slug`, `nameUz/nameRu/nameEn`, `type`, `parentId?`, `order?`, `icon?`. Drop `name`.
- `CategoriesService.findAll`: currently flat; add tree assembly (parent/children) matching `lib/api/catalog-repository.ts`'s shape for the public mega-menu — read that file for the exact response contract (root/children/type/icon grouping) before porting.
- Public endpoint(s) return only what the storefront needs (no `createdAt`/`updatedAt`), admin endpoints return full rows.

### Task 8: Customers — claim/pool workflow

**Files:**
- Modify: `backend/src/customers/customers.service.ts`, `customers.controller.ts`, `seller-customers.controller.ts`
- Modify: `backend/src/customers/dto/create-customer.dto.ts`, `update-customer.dto.ts`, `query-customer.dto.ts`

**Changes:**
- Drop the `findUnique({where:{phone}})` duplicate check in `create()` — phone is no longer unique (Task 1). Replace with nothing (root's `createCustomer` never checked for duplicates either — a shared switchboard is expected).
- `CustomersService.findAll` (admin) stays as-is (directors see everything, unscoped).
- `SellerCustomersController`/new methods on the service: port `listCustomers`/`getCustomer`/`createCustomer`/`updateCustomer`/`claimCustomer`/`listCustomerInquiries`/`findCustomersByPhone` from `lib/api/customer-repository.ts` using `customerReadScope`/`customerWriteScope`/`unclaimedScope` from `backend/src/common/scope.ts` (Task 3). `claimCustomer` uses the same race-safe `updateMany` compare-and-set pattern as `claimInquiry`.
- `findCustomersByPhone`/`listCustomerInquiries` need the phone-canonicalization helpers (`extractNationalDigits`, `isValidPhone`, `phoneTail`) — port `lib/auth/phone.ts` as `backend/src/common/phone.ts` once, share it with Task 2's purchase-check and Task 10's order phone-matching.
- Every write calls `AuditService.record`.

### Task 9: Users — name/email, login-by-identifier, discount limit

**Files:**
- Modify: `backend/src/users/users.service.ts`, `users.controller.ts`
- Modify: `backend/src/users/dto/create-user.dto.ts`, `update-user.dto.ts`
- Modify: `backend/src/auth/auth.service.ts`, `auth.controller.ts`, `auth.types.ts`

**Changes:**
- DTOs gain `name`, `email?`, `phone?` (at least one of email/phone — validate with a class-validator custom validator or a manual check in the service), `discountLimit?: number` (default 5).
- `UsersService`: port `listStaff`'s `completedOrders` aggregate (`prisma.order.groupBy`), `createStaff`'s duplicate-email check + bcrypt hashing (already uses `bcrypt` via `AuthService` elsewhere — reuse the same cost factor, `BCRYPT_COST = 12`, check what `auth.service.ts` currently uses and match it rather than introducing a second constant), `updateStaff`'s "last active director" guard (`otherActiveDirectors`) — this is a real safety rule, do not drop it.
- `AuthService.login(identifier: string, password: string)`: change from `findUnique({where:{phone}})` to `findFirst({where:{OR:[{phone:identifier},{email:identifier.toLowerCase()}]}})`. Port the login-rate-limiting from `app/api/v1/auth/login/route.ts` (`checkLoginAllowed`/`recordLoginFailure`/`clearLoginFailures` — find their implementation, likely `lib/auth/login-throttle.ts` or similar; grep for `recordLoginFailure` to find it) into `AuthService` as an in-memory (or reuse whatever mechanism the source uses) throttle — this is a real anti-brute-force control, do not drop it.
- `AuthService.me()`: extend the `select` to include `name`, `email`, `discountLimit` (Next.js's `getStaffUser`/DAL needs these — Part 4, Task 15).
- `LoginDto`: rename `phone` field to `identifier` (or add it alongside `phone` for backward compat with the seller panel's existing login call — check `app/(seller-auth)/**`'s login form payload shape first; if it sends `{phone, password}`, keep the DTO field named `phone` but accept an email-shaped string in it rather than renaming, to avoid touching the out-of-scope seller panel).

### Task 10: Orders — unified status machine, discount workflow, inquiry link

**Files:**
- Modify: `backend/src/orders/orders.service.ts`, `orders.controller.ts`
- Modify: `backend/src/orders/order-status-transitions.ts`, `order-status-transitions.spec.ts`
- Modify: `backend/src/orders/dto/create-order.dto.ts`, `update-order-status.dto.ts`
- Create: `backend/src/orders/dto/request-discount.dto.ts`
- Create: `backend/src/orders/order-money.ts` (ported from `lib/api/order-money.ts` — `applyDiscount`, `subtotalOf`)
- Create: `backend/src/orders/order-number.ts` (ported from `lib/api/order-number.ts` — `nextOrderNumber`, used only by the CRM creation path below; the existing `OrderSequence`-based numbering stays for the POS path, unchanged)

**Unified `OrderStatus` transition table** (`order-status-transitions.ts` — replace the existing table with this superset, keep the function signature `canTransition(from: OrderStatus, to: OrderStatus): boolean` identical):
```
DRAFT      -> PENDING is not a state here (root's PENDING folds into NEW — see note)
DRAFT      -> NEW, CANCELLED
NEW        -> CONFIRMED, CANCELLED
CONFIRMED  -> PREPARING, CANCELLED
PREPARING  -> COMPLETED, CANCELLED
COMPLETED  -> (terminal)
CANCELLED  -> (terminal)
```
Note: root's `PENDING` and backend's `NEW` mean the same thing ("submitted, not yet confirmed") — do not add a separate `PENDING` value to the enum beyond what Task 1's schema already defines (it doesn't define one; `NEW` is reused for both flows). `isEditable(status)` (ported from `lib/api/order-status.ts`) returns true for `DRAFT`/`NEW` only — matches root's "editable in DRAFT and PENDING only" rule with `NEW` standing in for `PENDING`.

**`OrdersService.create` — two entry points, one method each, sharing helpers:**
- Existing POS path (`create`, unchanged): requires `actor.sellerId`, requires a resolvable `warehouseId` up front, decrements nothing at creation (reserves at CONFIRMED via `InventoryService.reserveForOrder`, unchanged).
- New CRM path (`createCrmOrder`, ported from `order-repository.ts`'s `createOrder`): takes `customerId`, `items: {productId, quantity, unitPrice?}[]`, optional `inquiryId`, optional `notes`. Looks up each product's `price` (nullable — if null, the request must supply `unitPrice` or the call fails with `price_required`, matching `buildLines`'s behavior). Checks availability via **summed `Inventory.quantity - reservedQuantity` across all warehouses for that product** (this replaces `buildLines`'s old `product.stock` check — Part 0's computed-stock rule), not a flat column. Does **not** set `warehouseId` (left null) and does **not** reserve inventory at creation — reservation happens when the order transitions to `CONFIRMED`, at which point `updateStatus` must resolve a warehouse: use the acting seller's `Seller.warehouseId` if set, else the sole warehouse if only one exists, else throw `BadRequestException('warehouseId must be resolvable to confirm this order')`. Uses `nextOrderNumber`/`order-number.ts`'s `DP-{year}-{n}` format for this path specifically (the POS path keeps its existing `DP-{sequence}` format via `OrderSequence` — both are valid, distinguishable formats, no need to unify the numbering scheme itself).
- Both paths call `AuditService.record` with a `CREATE` entry, matching each source's existing `after` snapshot shape.

**`OrdersService.requestDiscount`** (new method, ported from `order-repository.ts`'s `requestOrderDiscount`): `POST seller/orders/:id/discount-request` body `{percent, reason?}` — `@Roles(...SELLER_UP)`. Uses `discount-requests/discount-policy.ts`'s `classifyDiscount` against `isDirector(actor) ? DIRECTOR_DISCOUNT_LIMIT : actor's User.discountLimit` (fetch the acting user's `discountLimit` — `AuthenticatedUser` may need a new field, or fetch fresh from `UsersService`; prefer fetching fresh since `discountLimit` can change between token issuance and use, matching root's behavior of always reading current state). Immediate path updates `discountApprovedPercent`/`total` in one write + audit; over-limit path creates a `PENDING` `DiscountRequest` + a `DISCOUNT_REQUESTED` notification to every active `DIRECTOR`, refusing a second concurrent pending request on the same order (`pending_exists`).

**`OrdersService.updateStatus`**: keep the existing `reserveForOrder`/`fulfillForOrder`/`releaseForOrder` calls unchanged for POS orders; for a CRM order (identified by `warehouseId === null` at the time `CONFIRMED` is requested), resolve the warehouse as described above, persist it onto the order (`data: {warehouseId: resolved}`) in the same transaction as the reservation, then proceed exactly as the existing POS logic does from that point on — this means a CRM order behaves identically to a POS order from `CONFIRMED` onward, which is a deliberate simplification: don't build a second inventory-lifecycle path.

---

## Part 4 — Next.js: rewire the data layer

Everything in this part preserves existing exported function signatures per the Global Constraints. Do task-by-task; each is independently testable (the route/component that calls it doesn't change, so `npm run build` + the existing test for that route/repository is the checkpoint).

### Task 11: Server-side backend API client

**Files:**
- Create: `lib/api/backend-client.ts`

**What it does** (new file, modeled on `lib/api/seller-panel/client.ts` but for **server-side** callers — route handlers, the DAL — not browser code):
```ts
import "server-only";

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL ?? "http://localhost:3001";

export class BackendApiError extends Error {
  constructor(message: string, readonly status: number, readonly code: string) { super(message); this.name = "BackendApiError"; }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE" | "PUT";
  body?: unknown;
  query?: object;
  accessToken?: string;
  /** Raw Cookie header value to forward to backend's refresh endpoint. */
  refreshCookie?: string;
}

export async function backendRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  // fetch(`${BACKEND_URL}/api${path}`, { headers: { Authorization: `Bearer ${accessToken}` }, ... })
  // 401 handling is the CALLER's job here (unlike the browser client): the DAL
  // (Task 15) owns the refresh-and-retry loop because it also has to persist
  // the new tokens into the Next.js session cookie, which this stateless
  // function has no access to.
}
```
Add `BACKEND_INTERNAL_URL` to `.env.example` (check what already exists there for `NEXT_PUBLIC_API_URL` and add the server-side equivalent beside it — same value in local dev, potentially different in production if backend is reached over an internal network address).

**Steps:**
- [ ] Write `backendRequest` with the same error-shape parsing as `seller-panel/client.ts`'s `parseErrorBody`
- [ ] Write a unit test (`lib/api/backend-client.test.ts`) mocking `fetch` for the success/4xx/5xx cases
- [ ] `npx tsc --noEmit && npm test -- backend-client`

### Task 12: Auth — staff session backed by backend JWT

**Files:**
- Modify: `lib/auth/dal.ts`, `lib/auth/session.ts`
- Modify: `lib/auth/session-token.ts` (or wherever the cookie is signed — locate it via the import in `session.ts`)
- Modify: `app/admin/login/**` (wherever the login form action lives — locate via `app/admin/login`)
- Delete: any local bcrypt-compare login logic once replaced

**Design:** The Next.js session cookie stops being a self-contained signed claim about `userId`. It now holds an encrypted `{accessToken, refreshToken, userId}` (reuse whatever encryption/signing primitive `session-token.ts` already uses — do not introduce a new crypto dependency). Login flow: the admin login route calls `backendRequest('/auth/login', {method:'POST', body:{phone: identifier, password}})` (Task 9 made `identifier` accept email or phone in the same field — confirm the exact field name after Task 9 lands), gets back `{accessToken, user}` plus backend's `Set-Cookie: refresh_token=...` response header — **read that header directly** (`response.headers.get('set-cookie')`, parse the token value out of it) since `backendRequest` is a server-to-server fetch and won't auto-store cookies; mint the Next.js session cookie with both tokens inside.

`getStaffUser()` (DAL): decode the session cookie, call `backendRequest('/auth/me', {accessToken})`. On 401, call `backendRequest('/auth/refresh', {refreshCookie: 'refresh_token=' + storedRefreshToken})`, get a new access+refresh pair, re-mint the Next.js cookie, retry `/auth/me` once. On repeated failure, return `null` (existing behavior — DAL callers already handle "not signed in"). Map backend's response (`{id, phone, email, name, role, discountLimit, isActive, seller}`) onto the existing `StaffUser` interface — same shape, so `requireStaff`/`requireDirector` and every caller of `getStaffUser` need no changes.

**Steps:**
- [ ] Extend the session token payload type and its encode/decode functions
- [ ] Rewrite `getStaffUser` per the above
- [ ] Rewrite the login route to call backend instead of local bcrypt/Prisma
- [ ] Rewrite the logout route to also call `backendRequest('/auth/logout', ...)` so the refresh token is revoked server-side, then clear the Next.js cookie
- [ ] Manually verify via `npm run dev`: log in as an existing director account (seeded through backend's own seed, not root's — the accounts now live in backend's DB post-migration) at `/admin/login`, confirm `requireDirector`-gated pages load, confirm logout clears the session
- [ ] `npx tsc --noEmit && npm run lint && npm run build`

### Task 13: Rewire the 4 net-new repositories (thin wrappers)

**Files:**
- Modify: `lib/api/review-repository.ts`, `lib/api/inquiry-repository.ts`, `lib/api/inquiry-board-repository.ts`, `lib/api/discount-repository.ts`, `lib/api/audit.ts`

For each: replace every `prisma.*` call with a `backendRequest(...)` call to the corresponding Task 2–5 endpoint, keep every exported function's name/signature/return type identical. `audit.ts`'s `recordAudit` becomes a thin wrapper that either (a) is deleted entirely and every caller switches to calling the relevant domain endpoint which now logs audit server-side automatically (preferred — audit logging is now `backend/`'s job, triggered by the mutation endpoints themselves, not a separate client-side call), or (b) if some caller needs a bare audit write with no corresponding domain mutation, keep a thin `POST /audit` passthrough. Check every current call site of `recordAudit` (there are several, across the files read in this session) before deciding — if all of them are already inside a repository function that's being rewired to call a Task 2–5 endpoint that itself logs the audit entry server-side, delete `recordAudit`'s call from the Next.js side entirely (double-logging would be a bug, not a safety margin).

**Steps per file:**
- [ ] Rewrite internals
- [ ] Run that file's existing test if one exists (e.g. check for `*-repository.test.ts` siblings)
- [ ] `npx tsc --noEmit`

### Task 14: Rewire the 11 existing-domain repositories

**Files:** `lib/api/product-repository.ts`, `lib/api/product-write-repository.ts`, `lib/api/catalog-repository.ts`, `lib/api/customer-repository.ts`, `lib/api/order-repository.ts`, `lib/api/user-repository.ts`, `lib/api/product-stats-repository.ts`, `lib/api/product-lookup-repository.ts`, `lib/api/analytics-repository.ts`, `lib/api/analytics-detail-repository.ts`, `lib/api/product-mapper.ts`

Same approach as Task 13, against the Part 3 endpoints. Two call-outs:
- `product-mapper.ts` currently reads `product.stock`/`product.stockStatus` off a raw Prisma row — rewrite it to read `availableQuantity`/`stockStatus` off the shape `ProductsService.withStock()` (Task 6) now returns from the API.
- `analytics-repository.ts`/`analytics-detail-repository.ts`: per existing project memory, margin/supplier/debt/stock-trend analytics sections were already blocked pending new Prisma models before this task started — those specific sections stay blocked (this plan's schema additions don't add the missing analytics models; that's a separate, already-tracked piece of work). Rewire only the parts of these two files that have a real backend equivalent today (`GET reports/sales-summary`, `GET reports/inventory-status`, `GET seller/dashboard*`); leave the blocked sections' TODOs as they are, don't silently implement them with guessed logic.

**Steps per file:** same as Task 13.

### Task 15: Product image upload — disk I/O stays, DB write moves

**Files:**
- Modify: `app/api/v1/products/[id]/image/route.ts` (the in-flight route)
- No change to: `lib/api/product-image-storage.ts` (pure disk I/O, no Prisma — stays exactly as-is per the audit)

Change the route: after `saveProductImage(file)` returns the new `imageUrl`, instead of writing it via a repository function that hits Prisma, call `backendRequest('/products/' + id + '/image', {method:'PATCH', body:{imageUrl}, accessToken})` (Task 6's new endpoint). On failure, call `deleteProductImage(imageUrl)` to clean up the orphaned file (the route likely already does something like this for its old failure path — check and preserve that behavior).

### Task 16: Admin API routes — verify no changes needed, fix what breaks

**Files:** all 37 files under `app/api/v1/**`, `app/api/catalog/**`, `app/api/products/**`, `app/api/inquiry/**`, `app/api/quote-request/**`, `app/api/reviews/**`

These should need **zero logic changes** given Tasks 12–15 preserved repository signatures. This task is verification, not authoring: run `npx tsc --noEmit` and fix any type mismatches that surface (e.g. a repository's return type changed shape slightly because the backend API's JSON serializes `Decimal` as a `string` where Prisma returned a JS `number`/`Decimal` object — reconcile at the repository boundary in Task 13/14, not here, if this task finds one).

- [ ] `npx tsc --noEmit` across the whole root app, fix everything
- [ ] Manually smoke-test in the browser (`npm run dev`) through `run` skill or `mcp__claude-in-chrome__*`: storefront product listing, product detail + review submission, admin product CRUD, admin inquiry board claim, admin discount approval — one pass through each, screenshot or note any breakage

### Task 17: `app/admin/seller/*` (old embedded seller CRM)

**Decision:** keep the pages, only rewire their data access (same treatment as every other admin route) — do not delete. This is a UI-availability question the audit flagged as ambiguous; deleting a still-linked admin route is out of scope for a data-layer consolidation and is reversible-but-annoying to undo, so the default is "leave the surface alone, fix what it's built on." Note this explicitly in the final report so the user can decide separately whether to delete it.

**Files:** everything under `app/admin/seller/**`, `components/admin/**`, `hooks/admin/use-admin-products.ts`, `lib/api/admin/resources.ts` — expected to need no changes beyond what Task 16 already catches, since they call the same repository functions.

---

## Part 5 — Cleanup and final verification

### Task 18: Delete root Prisma, remove dependencies

**Files:**
- Delete: `prisma/` (entire directory — schema, migrations, seed-data, generated client output)
- Delete: `lib/db.ts`
- Modify: root `package.json` (remove `@prisma/client`, `@prisma/adapter-pg`, `prisma` deps; remove `postinstall: prisma generate`, `db:generate`, `db:migrate`, `db:seed`, `db:studio`, `db:demo` scripts)
- Modify: root `tsconfig.json` if it has a `prisma/generated` path alias
- Modify: `.gitignore` if it references `prisma/generated`

**Steps:**
- [ ] Grep the whole root app (excluding `backend/`) for `@/lib/db`, `@prisma/client`, `@/prisma/generated` — confirm zero remaining imports (every earlier task should have already eliminated these; this is the final check, not the first fix)
- [ ] Delete the files/directories above
- [ ] Update `package.json`
- [ ] `npm install` to regenerate the lockfile without the removed deps
- [ ] `npx tsc --noEmit && npm run lint && npm run build`
- [ ] Run the full root test suite (`npm test`)

### Task 19: Full verification, both projects

- [ ] `cd backend && npx tsc --noEmit && npm run lint && npm test && npm run build`
- [ ] `cd .. && npx tsc --noEmit && npm run lint && npm run build && npm test`
- [ ] Boot both (`npm run dev` in `backend/`, `npm run dev` in root) and smoke-test end-to-end once more through the browser: storefront browsing, review, inquiry submission; admin login, product CRUD + CSV import/export + image upload, category tree edit, discount request + approval, inquiry board claim, audit log view, staff user management; seller panel (`/login`, `/seller/**`) untouched and still working, confirming Part 4 didn't regress it
- [ ] Write the final report (see plan's closing instructions below — not a file, the message back to the user)

---

## Self-review notes (from the plan author, not a task)

- **Spec coverage:** audit points A–E are all addressed — A/B fed Task 1's schema, C1–C5 map onto Tasks 11–17, D's "needs full port" items (Review/Inquiry/DiscountRequest/AuditLog) are Tasks 2–5, E's dependency/script cleanup is Task 18.
- **Known gap intentionally left open:** analytics sections already blocked on missing models (per prior project memory) stay blocked — this plan does not invent those models. Flag this in the final report as a pre-existing, separately-tracked item, not a regression this work introduced.
- **Known risk to flag in the final report:** Task 1's migration includes real data backfill against whatever is currently seeded in `backend/`'s dev database. If any environment has real (non-seed) production data in `backend/`'s Postgres already, Task 1 must not run against it without a reviewed backup first — this plan assumes dev/seed data throughout per the CLAUDE.md stop-condition on production data.
