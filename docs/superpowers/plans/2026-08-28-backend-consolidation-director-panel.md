# Backend Consolidation v2 — Director Panel Merge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One `/backend` folder (NestJS + Prisma) and one Postgres database (`diesel_parts_erp`) become the single source of truth for every panel and surface in this project. The root Next.js app's own Prisma layer (`prisma/`, `lib/db.ts`, database `diesel_parts_web_dev`) is retired entirely; the root app becomes a pure frontend that talks to `backend/` over HTTP for everything, exactly as `app/seller/**` already does today.

**Architecture:** This is a resumption of `docs/superpowers/plans/2026-08-23-backend-consolidation.md`, which this session's audit confirms got roughly 40% done and then stopped (see Part 0 below for the exact split) — the newer `docs/superpowers/plans/2026-08-28-checkout-order-types-expansion.md` explicitly documents the stall as a known, flagged gap and scoped itself around it rather than fixing it. Three things changed since the 2026-08-23 plan was written, and this plan corrects for all three: (1) `backend/`'s schema already absorbed root's shape (Part 1/2 of the old plan shipped) and has since evolved further via checkout work (Cart, Payme/Click-ready payments, delivery fields) — this plan does not re-touch the schema, it finishes what consumes it; (2) the two databases are no longer a clean one-way backfill — `backend/`'s dev database now holds its *own* independently-seeded rows (22 products, 12 customers, 7 users, 22 orders) that did not exist when the 2026-08-23 plan assumed an empty/backfill-only target, so the data merge in this plan is a real two-way reconciliation with collision handling, not a blind copy; (3) the old plan's scope was "make `backend/` the source of truth for everything root's Prisma layer touches" — this plan's user request narrows the *name* to "director panel," but the director panel, the storefront catalog (`app/(site)/**`), the legacy `app/admin/seller/**` CRM, and every `app/api/v1/**`/`app/api/catalog|products|inquiry|quote-request|reviews/**` route all read and write the *same* root-DB tables (`Product`, `Category`, `Customer`, `Order`, …). Migrating only the director panel's data access while leaving the storefront writing to a second, separate copy of `Product`/`Category` would not produce "one database is authoritative" — it would produce two live, silently-diverging catalogs. **Reconciliation decision (per this project's autonomous-mode rule): this plan's scope is every root-DB consumer, not just `app/director/**`**, because that is the only way to actually deliver "one backend, one database." This is called out again in this plan's closing report so the user can see the scope was widened and why.

**Tech Stack:** NestJS 11, Prisma ORM 7 (`prisma-client` generator, driver adapters), class-validator DTOs, Passport JWT, `pg` (already a dependency in both projects, used directly for the one-off cross-database migration script). Next.js 16 App Router, Zod, `server-only`, Vitest + Testing Library.

**Spec:** `docs/superpowers/plans/2026-08-23-backend-consolidation.md` (the original spec — its Global Constraints, module-shape reference material in "Part 0," and reconciliation decisions #1–#7 all still apply and are not repeated in full here; read that file's Part 0 and Part 1 before starting). This plan supersedes only that plan's **Part 4 and Part 5** (which never ran) and adds the data-reconciliation work neither plan anticipated. `docs/superpowers/plans/2026-08-28-checkout-order-types-expansion.md`'s Global Constraints (the "two separate databases" note) and its Bosqich 6 are the reason this plan exists — see this plan's closing section for how the two interact.

## Global Constraints

- Both databases are local dev Postgres instances (`localhost:5432`) with real but non-production seed/test data — not empty, not production. Row counts as of this plan's writing: root `diesel_parts_web_dev` has 2 `User`, 1 `Customer`, 19 `Product`, 0 `Order`, 56 `Category`, 0 `Review`, 1 `Inquiry`. `backend/`'s `diesel_parts_erp` has 7 `users`, 12 `customers`, 22 `products`, 22 `orders`, 6 `categories`, 0 `reviews`, 0 `inquiries`, 2 `carts`, 3 `warehouses`, 60 `inventories`. Neither is production — CLAUDE.md's stop-condition on production data does not apply — but real dev work exists on both sides and must not be silently dropped.
- Product SKUs collide on 2 of 19 root SKUs (`DP-TRF-L60`, `DP-TRC-DX225`) with `backend/`'s existing 22 — the migration script must detect and skip (never overwrite) an exact-SKU match, logging it, rather than erroring the whole run or silently duplicating.
- The real director login is `director@dieselparts.uz` (root `User`, role `DIRECTOR`, no phone) — this is a genuine credential, not seed data, and must still work after cutover. Both root and `backend/` hash passwords with `bcrypt` (confirmed: `app/api/v1/auth/login/route.ts` and `backend/src/auth/auth.service.ts` both use it) — the migration copies `passwordHash` verbatim rather than re-hashing or resetting it, so the existing password keeps working with no re-registration step.
- Root's `Role` enum (`DIRECTOR | SELLER`) is a subset of `backend/`'s (`SUPER_ADMIN | DIRECTOR | MANAGER | SELLER | VIEWER`) — direct 1:1 mapping for the two values that exist on both sides, no translation table needed.
- Root has **no** `Warehouse`/`Inventory` model — `app/director/(panel)/warehouse` is actually a flat stock view over `Product.stock`/`Product.stockStatus` (real columns in root's schema), not a real warehouse system. `backend/` dropped those columns in favor of computed `Inventory`-derived stock (2026-08-23 plan, Part 0). Migrated root products need a real `Inventory` row (Part 2, Task 8) against a new `Warehouse` row created for this purpose (name: `"Katalog (ko'chirilgan)"`) so their stock keeps meaning post-migration instead of silently becoming 0.
- `lib/api/internal-backend.ts` already exists and already proxies **customer-identity** (phone-verified session) calls from the root app to `backend/` for checkout/cart, using an HMAC-signed internal-request scheme. This plan's Part 3 client (`lib/api/backend-client.ts`) is a **separate, JWT-bearer-based** client for **staff** (director/seller) calls — same precedent `lib/api/seller-panel/client.ts` already set for the browser-side seller panel, this one is the server-side analogue for the director panel and the API routes. Do not merge the two clients or their auth schemes; they authenticate fundamentally different callers.
- Every repository file's **public exports** (function names, parameter types, return types) must stay unchanged unless a task explicitly says otherwise — every route handler, server component, and admin/director UI component that calls these repositories must not need edits as a result of the swap from Prisma to HTTP. This is the same load-bearing decision the 2026-08-23 plan made and it still holds.
- All money fields stay `Decimal` end-to-end in `backend/`; convert to `number` only at the Next.js response-mapping boundary in the rewired repository, exactly as today.
- Uzbek user-facing strings (notification messages, validation errors) must be preserved verbatim wherever ported.
- Run `cd backend && npx tsc --noEmit && npm run lint && npx jest` after every `backend/`-touching task, and `npx tsc --noEmit && npm run lint && npm run build && npm test` at the root after every root-touching task. A task is not done until both are clean for the side(s) it touched.
- Do not touch `app/(seller-auth)/`, `app/seller/**`, `components/seller/**`, `hooks/seller/**`, `lib/seller/**`, `lib/api/seller-panel/**`, `lib/store/seller-auth-store.ts` — already correctly wired to `backend/` only, per the original plan's constraint.
- After the final task, nothing outside `backend/` may import `@/lib/db`, `@prisma/client`, or `@/prisma/generated/*`. `prisma/` at the repo root is deleted entirely, and root's `DATABASE_URL` (pointing at `diesel_parts_web_dev`) is removed from `.env.local`/`.env.example` (the database itself is dropped only after the user confirms the final backup — Part 5, Task 23).

---

## Part 0 — Current-state audit (read before starting; not a task)

**What the 2026-08-23 plan actually shipped in `backend/`** (confirmed via `git log --oneline -- backend/` and reading the live schema/modules this session):
- Part 1 (schema unification): done — `backend/prisma/schema.prisma` already has `Category`/`Product` i18n fields, `Review`, `Inquiry`, `DiscountRequest`, `AuditLog`, `Notification` with the unified shape.
- Part 2 (four new modules): done — `backend/src/reviews`, `backend/src/inquiries` (+ `seller-inquiries.controller.ts`), `backend/src/discount-requests`, `backend/src/audit` all exist. `backend/src/common/scope.ts`, `backend/src/common/phone.ts`, `backend/src/common/audit-diff.ts` (the shared pure-logic files Part 2 needed) all exist and have specs.
- Part 3 (extend existing modules): **partially** done. What shipped (mostly via the checkout plan, not the original one): `CustomersService.findOrCreateByPhone`, the unified `OrderStatus` transition table (`DRAFT → NEW → CONFIRMED → PREPARING → COMPLETED → CANCELLED`, now also `PENDING_REVIEW`), `orders.controller.ts` mounted at `seller/orders` (scoped so a director sees everything via `orderReadScope`, a seller sees their own). What did **not** ship (this plan's Part 1 below): `AuthService.login` still takes only `phone`, no identifier/throttle; `UsersService` has no `completedOrders` aggregate or last-active-director guard; no `POST seller/orders/:id/discount-request` endpoint; no public (unauthenticated) product/category read endpoints; no CSV import/export; no product-image PATCH endpoint; no product search endpoint; no service anywhere except `discount-requests`/`inquiries` calls `AuditService.record` on writes.
- Part 4 (Next.js rewire — `lib/api/backend-client.ts`, DAL rewrite, 15 repositories, image route, 37 API routes) and Part 5 (delete root Prisma) — **not started**. Confirmed: `lib/api/backend-client.ts` does not exist, `lib/db.ts` and `prisma/` are both live and actively used, `lib/auth/dal.ts` still does `prisma.user.findUnique(...)`.

**What actually uses root's `diesel_parts_web_dev` today** (confirmed by reading imports, not assumed): `app/director/**` (every page), `app/admin/seller/**` (the legacy embedded CRM), `app/(site)/**`'s storefront catalog/product-detail/review pages (4 files import `product-repository.ts`/`catalog-repository.ts` directly), and every route under `app/api/v1/**` except `checkout`, `cart`, `products/ai-fill`, `products/ai-generate-image` (those four already proxy to `backend/` via `internal-backend.ts`), plus `app/api/catalog`, `app/api/products/**`, `app/api/inquiry`, `app/api/quote-request`, `app/api/reviews`. 47 route files under `app/api/**` total; 4 already proxy to `backend/`, the other 43 are candidates for Part 4 (some, like `app/api/auth/*`, are the customer-phone-OTP flow and use neither database directly — verify per-file in Task 21, don't assume all 43 need changes).

---

## Part 1 — Finish `backend/`'s remaining gaps

These land first: the data migration (Part 2) needs identifier-based login to work for `director@dieselparts.uz` (which has no phone), and the Next.js rewire (Part 4) needs the read/write endpoints these tasks build.

### Task 1: Auth — identifier login (phone or email), throttle, richer `/auth/me`

**Files:**
- Modify: `backend/src/auth/auth.service.ts`, `backend/src/auth/auth.controller.ts`, `backend/src/auth/dto/login.dto.ts`, `backend/src/auth/auth.types.ts`
- Test: `backend/src/auth/auth.service.spec.ts` (check whether this file already exists — if so, add cases; if not, create it)

**Current state** (read this session): `LoginDto.phone: string` is the only field; `AuthService.login(phone, password)` does `prisma.user.findUnique({ where: { phone } })`. `director@dieselparts.uz` has `phone: null`, so this login can never succeed today.

**Steps:**
- [ ] Write the failing test:
```ts
// backend/src/auth/auth.service.spec.ts
it('logs in by email when the account has no phone', async () => {
  const email = 'director@example.uz';
  const passwordHash = await bcrypt.hash('secret123', 10);
  prisma.user.findFirst.mockResolvedValue({
    id: 'u1', phone: null, email, passwordHash, role: 'DIRECTOR',
    isActive: true, name: 'Director', discountLimit: 5,
  } as any);

  const result = await service.login(email, 'secret123');

  expect(prisma.user.findFirst).toHaveBeenCalledWith({
    where: { OR: [{ phone: email }, { email: email.toLowerCase() }] },
  });
  expect(result.user.role).toBe('DIRECTOR');
});
```
- [ ] Run: `cd backend && npx jest auth.service.spec.ts` — expect FAIL (`findFirst` not called / method still named `findUnique` with `phone` only)
- [ ] Rename `LoginDto.phone` to `identifier: string` (keep `@IsString() @MinLength(1)`) — check `app/(seller-auth)/**`'s login form payload shape first (`grep -rn "phone" "app/(seller-auth)"`); if the seller panel's login POST body sends `{phone, password}` literally, keep the DTO field named `phone` instead of renaming (to avoid an out-of-scope seller-panel change) and just widen what it accepts — the field *name* matters less than the lookup logic below
- [ ] Change `AuthService.login` to `findFirst({ where: { OR: [{ phone: identifier }, { email: identifier.toLowerCase() }] } })` instead of `findUnique({ where: { phone } })`
- [ ] Port login-rate-limiting: grep the root app for `recordLoginFailure`/`checkLoginAllowed` (likely `lib/auth/login-throttle.ts` or inline in `app/api/v1/auth/login/route.ts`) to find the exact window/threshold, then add the same in-memory throttle to `AuthService.login` (fixed in-memory Map keyed by identifier is fine — matches root's mechanism if root's is also in-memory; if root's is Redis-backed, keep `backend/`'s in-memory since it has no Redis dependency today and this is a new addition, not a port of existing infra)
- [ ] Extend `AuthService.me()`'s Prisma `select` to include `name`, `email`, `discountLimit` (already columns on `User` — just add to the select)
- [ ] Extend `AuthenticatedUser`/`JwtAccessPayload` in `auth.types.ts` if `/auth/me`'s response shape needs the extra fields reflected in the type
- [ ] Run: `cd backend && npx jest auth.service.spec.ts` — expect PASS
- [ ] Run: `cd backend && npx tsc --noEmit && npm run lint && npx jest`
- [ ] Commit: `git add backend/src/auth && git commit -m "feat(backend): accept email-or-phone identifier at login, add throttle"`

### Task 2: Users — completed-orders aggregate, last-active-director guard

**Files:**
- Modify: `backend/src/users/users.service.ts`, `backend/src/users/users.controller.ts`
- Test: `backend/src/users/users.service.spec.ts` (create if it doesn't exist)

**Ported from** `lib/api/user-repository.ts`'s `listStaff` (the `completedOrders` per-user aggregate via `groupBy`) and `updateStaff`'s "last active director" guard — read that file for the exact query shape before porting; do not guess the `groupBy` args.

**Steps:**
- [ ] Write a failing test asserting `UsersService.findAll()` (or whatever the current admin-list method is named — check `users.controller.ts`) returns each user with a `completedOrders: number` field, and that `UsersService.update(id, {isActive: false})` throws when `id` is the last active `DIRECTOR` (mock `prisma.user.count` to return `1` for the active-directors-excluding-this-one count)
- [ ] Run it, confirm FAIL
- [ ] Add the `groupBy`-based aggregate to whatever list method backs the admin/director "staff" list, matching root's `completedOrders` semantics (count of that seller's/director's `Order`s with `status: COMPLETED`)
- [ ] Add the guard to `update`/`remove`: before deactivating or demoting a user whose current role is `DIRECTOR`, count other active `DIRECTOR`s (`prisma.user.count({ where: { role: 'DIRECTOR', isActive: true, id: { not: id } } })`); if `0`, throw `ConflictException('Cannot deactivate the last active director')` (match root's exact message if `otherActiveDirectors` in `lib/api/user-repository.ts` has one — copy it verbatim, don't invent new copy)
- [ ] Run the test, confirm PASS
- [ ] `cd backend && npx tsc --noEmit && npm run lint && npx jest`
- [ ] Commit: `git add backend/src/users && git commit -m "feat(backend): add completed-orders aggregate and last-director guard"`

### Task 3: Orders — discount-request endpoint

**Files:**
- Modify: `backend/src/orders/orders.service.ts`, `backend/src/orders/orders.controller.ts`
- Create: `backend/src/orders/dto/request-discount.dto.ts`
- Test: `backend/src/orders/orders.service.spec.ts` (create if it doesn't exist)

**Ported from** `lib/api/order-repository.ts`'s `requestOrderDiscount`, per the 2026-08-23 plan's Task 10 spec (read that plan's Task 10 section for the full behavior — immediate-approval-within-limit vs. over-limit-creates-`DiscountRequest` branching, notification to every active `DIRECTOR`, refusing a second concurrent pending request).

**Steps:**
- [ ] Write `request-discount.dto.ts`:
```ts
import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class RequestDiscountDto {
  @IsNumber()
  @Min(0)
  @Max(100)
  percent: number;

  @IsOptional()
  @IsString()
  reason?: string;
}
```
- [ ] Write the failing test: a seller within their `discountLimit` gets an immediate approval (`order.discountApprovedPercent` updated, no `DiscountRequest` row); a seller over their limit gets a `PENDING` `DiscountRequest` row and no order change; a second call while one is already `PENDING` throws `ConflictException`
- [ ] Run it, confirm FAIL (method doesn't exist)
- [ ] Add `OrdersService.requestDiscount(orderId, actor, dto)` per the ported logic — inject `DiscountRequestsService` or write directly via `PrismaService` (whichever `discount-requests.service.ts`'s existing shape makes more natural; check it before deciding) and `AuditService`/`NotificationService`-equivalent (check whether a `NotificationsService` exists in `backend/src` — if not, this endpoint's "notify every active director" step writes `Notification` rows directly via `prisma.notification.createMany`, matching root's mechanism, since there's no separate service to inject)
- [ ] Add `POST seller/orders/:id/discount-request` to `orders.controller.ts`, `@Roles(...SELLER_UP)`
- [ ] Run the test, confirm PASS
- [ ] `cd backend && npx tsc --noEmit && npm run lint && npx jest`
- [ ] Commit: `git add backend/src/orders && git commit -m "feat(backend): add seller order discount-request endpoint"`

### Task 4: Wire `AuditService` into every write path that's missing it

**Files:**
- Modify: `backend/src/products/products.service.ts`, `backend/src/categories/categories.service.ts`, `backend/src/customers/customers.service.ts`, `backend/src/users/users.service.ts`, `backend/src/orders/orders.service.ts`
- Test: extend each service's existing `.spec.ts`

**Why this is its own task, not folded into whichever task touches each file:** the director panel's `/director/(panel)/audit` page reads the `AuditLog` table. Today only `discount-requests` and `inquiries` write to it (confirmed via `grep -rl AuditService backend/src`). Every other domain's writes are currently silent. Post-cutover, the director's audit trail would look empty for the domains that make up most of their daily activity (products, categories, customers, orders, staff) unless this is fixed — this is a real functional gap this plan surfaces, not a nice-to-have.

**Steps (repeat per service — `create`/`update`/`remove` methods only, not reads):**
- [ ] Write a failing test per service asserting `AuditService.record` is called with `{userId, action: 'CREATE'|'UPDATE'|'DELETE', entityType: '<Domain>', entityId, before, after}` on the relevant write (mock `AuditService`, assert the call)
- [ ] Run it, confirm FAIL
- [ ] Inject `AuditService` (`AuditModule` already exports it — add `AuditModule` to the relevant `*.module.ts`'s `imports` if not already there) and call `.record(...)` in each write method, `before` fetched pre-write where the method doesn't already have the row in hand (matches root's `product-write-repository.ts`'s `auditSnapshot` pattern — read it for the exact before/after shape convention, adapted: `name` → `nameUz`, no `stock`/`stockStatus` since those are computed)
- [ ] Run the test, confirm PASS
- [ ] `cd backend && npx tsc --noEmit && npm run lint && npx jest`
- [ ] Commit per service (5 commits) or one combined commit — either is fine, note in the message which services were touched: `git commit -m "feat(backend): record audit entries for products/categories/customers/users/orders writes"`

### Task 5: Products — public (unauthenticated) read endpoints

**Files:**
- Create: `backend/src/products/public-products.controller.ts`
- Modify: `backend/src/products/products.service.ts`, `backend/src/products/products.module.ts`
- Test: extend `backend/src/products/stock-status.spec.ts` or create `backend/src/products/products.service.spec.ts`

**Why a separate controller, not a guard bypass on the existing one:** `products.controller.ts` is `@Controller('products')` with a class-level `@UseGuards(JwtAuthGuard, RolesGuard)`. Bypassing per-route needs `@SetMetadata` plumbing through the guard; a second controller on its own path is simpler and matches the existing `seller-products.controller.ts` precedent ("one controller per audience").

**Steps:**
- [ ] Write the failing test: `ProductsService.findAllPublic({})` returns only `isActive: true` rows and never includes `purchasePrice`; `findOnePublic(slug)` looks up by `slug`, not `id`, and 404s on `isActive: false`
- [ ] Run it, confirm FAIL
- [ ] Add to `ProductsService`:
```ts
async findAllPublic(query: QueryProductDto) {
  const result = await this.queryWithComputedStock({ ...query });
  // queryWithComputedStock's `where` builder needs isActive:true forced in —
  // add a second private param or an internal overload rather than duplicating
  // the whole method; see queryWithComputedStock's current signature.
  return { ...result, data: result.data.map((p) => this.toSellerView(p)) };
}

async findOnePublic(slug: string) {
  const product = await this.prisma.product.findUnique({
    where: { slug },
    include: ADMIN_INCLUDE,
  });
  if (!product || !product.isActive) throw new NotFoundException('Product not found');
  return this.toSellerView(this.withStock(product));
}
```
(`toSellerView` already strips `purchasePrice` — reuse it rather than inventing a second stripping function. Adjust `queryWithComputedStock`'s `where` construction to accept a forced `isActive: true` — the cleanest change is adding `where.isActive = true` unconditionally inside a new private `queryWithComputedStock(query, { forcePublic: true })` overload, or simply setting it after the existing `where` object is built when called from `findAllPublic`.)
- [ ] Create `public-products.controller.ts`:
```ts
import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { ProductsService } from './products.service';
import { QueryProductDto } from './dto/query-product.dto';

@Controller('catalog/products')
export class PublicProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  findAll(@Query() query: QueryProductDto) {
    return this.products.findAllPublic(query);
  }

  @Get(':slug')
  findOne(@Param('slug') slug: string) {
    return this.products.findOnePublic(slug);
  }
}
```
- [ ] Register `PublicProductsController` in `products.module.ts`'s `controllers` array
- [ ] Run the test, confirm PASS
- [ ] `cd backend && npx tsc --noEmit && npm run lint && npx jest`
- [ ] Commit: `git add backend/src/products && git commit -m "feat(backend): add public catalog/products read endpoints"`

### Task 6: Categories — tree assembly, public endpoint

**Files:**
- Modify: `backend/src/categories/categories.service.ts`
- Create: `backend/src/categories/public-categories.controller.ts`
- Test: `backend/src/categories/categories.service.spec.ts` (create if it doesn't exist)

**Ported from** `lib/api/catalog-repository.ts`'s public tree read — read that file for the exact response contract (root/children/type/icon grouping the mega-menu expects) before writing this; do not guess the shape.

**Steps:**
- [ ] Write the failing test: `CategoriesService.findTree()` returns root categories (`parentId: null`) each with a `children` array populated, ordered by `order` then `nameUz`
- [ ] Run it, confirm FAIL
- [ ] Add `findTree()` to `CategoriesService`:
```ts
async findTree() {
  const all = await this.prisma.category.findMany({
    orderBy: [{ order: 'asc' }, { nameUz: 'asc' }],
  });
  const byParent = new Map<string | null, typeof all>();
  for (const c of all) {
    const key = c.parentId;
    byParent.set(key, [...(byParent.get(key) ?? []), c]);
  }
  const attach = (c: (typeof all)[number]): any => ({
    ...c,
    children: (byParent.get(c.id) ?? []).map(attach),
  });
  return (byParent.get(null) ?? []).map(attach);
}
```
- [ ] Create `public-categories.controller.ts` mounted at `catalog/categories`, one `@Get()` calling `findTree()`, no guard
- [ ] Register in `categories.module.ts`
- [ ] Run the test, confirm PASS
- [ ] `cd backend && npx tsc --noEmit && npm run lint && npx jest`
- [ ] Commit: `git add backend/src/categories && git commit -m "feat(backend): add category tree assembly and public read endpoint"`

### Task 7: Products — CSV import/export

**Files:**
- Create: `backend/src/products/product-csv.ts` (pure logic, ported verbatim from `lib/api/product-csv.ts` — parse/serialize only, no DB)
- Modify: `backend/src/products/products.service.ts`, `products.controller.ts`
- Create: `backend/src/products/dto/import-products.dto.ts`
- Test: `backend/src/products/product-csv.spec.ts` (port `lib/api/product-csv.test.ts`'s cases — same header list, same edge cases)

**Match the existing Next.js CSV column headers exactly** — read `lib/api/product-csv.ts` for the header list before writing; do not invent new column names, the director panel's existing exported CSVs must stay importable after this migration.

**Steps:**
- [ ] Port `product-csv.ts`'s parse/serialize functions verbatim (adjust only the import paths)
- [ ] Port its test file, confirm the ported tests pass unmodified against the ported logic (`cd backend && npx jest product-csv.spec.ts`)
- [ ] Add `POST products/import` (multipart, `@Roles(...MANAGER_UP)`) to `products.controller.ts` — parse via `product-csv.ts`, write each row through the existing `create`/`update` methods (so validation and audit logging, from Task 4, apply identically to a bulk import as to a single write)
- [ ] Add `GET products/export` (CSV, `@Roles(...MANAGER_UP)`) — serialize all products via `product-csv.ts`
- [ ] `cd backend && npx tsc --noEmit && npm run lint && npx jest`
- [ ] Commit: `git add backend/src/products && git commit -m "feat(backend): add product CSV import/export"`

### Task 8: Products — image PATCH, search endpoint

**Files:**
- Modify: `backend/src/products/products.service.ts`, `products.controller.ts`

**Steps:**
- [ ] Add `ProductsService.setImage(id, imageUrl)`: `getOrThrow(id)` then `prisma.product.update({where:{id}, data:{imageUrl}})`, calling `AuditService.record` (Task 4's pattern)
- [ ] Add `PATCH products/:id/image` body `{imageUrl: string}` — `@Roles(...MANAGER_UP)`. This does **not** handle the multipart upload itself — `lib/api/product-image-storage.ts` keeps owning local-disk storage from the Next.js side (Part 4, Task 13 wires the route to call this endpoint after upload); this endpoint only persists the URL
- [ ] Add `GET products/search?q=` — `@Roles(...MANAGER_UP)` — read `app/api/v1/products/search/route.ts` for the exact current response contract before porting (do not guess it); implement against `queryWithComputedStock`'s existing `search` param if the contract matches, otherwise a small dedicated query
- [ ] `cd backend && npx tsc --noEmit && npm run lint && npx jest`
- [ ] Commit: `git add backend/src/products && git commit -m "feat(backend): add product image-url endpoint and admin search"`

---

## Part 2 — Data reconciliation: merge `diesel_parts_web_dev` into `diesel_parts_erp`

This is a **cross-database script**, not a Prisma migration — the two are separate Postgres databases, so this cannot be expressed as schema-diff SQL. It connects to both with the `pg` driver directly (already a dependency in both `node_modules`), reads from root, and writes into `backend/`'s tables through raw `INSERT`s that match the already-unified schema (Part 1/2 of the 2026-08-23 plan already made the columns line up almost 1:1 — verified this session field-by-field for `Product`/`Category`/`Customer`/`User`).

### Task 9: Migration script — dry-run mode

**Files:**
- Create: `scripts/migrate-web-dev-to-erp.ts`
- Create: `scripts/migrate-web-dev-to-erp.test.ts`

**Design:** the script takes a `--dry-run` (default) or `--apply` flag. In dry-run mode it connects to both databases read-only (root fully read-only; it opens a transaction on `backend/`'s connection and always rolls back at the end regardless of outcome) and prints a plan: rows to insert per table, rows skipped per table with the collision reason, and any row that fails a foreign-key precondition (e.g., a root `Inquiry.assignedSellerId` pointing at a root `User.id` that doesn't exist in `backend/` yet because that user wasn't migrated). Nothing is committed in dry-run mode, ever — even if `--apply` is passed, a dry run must run first and its plan must be inspected before `--apply` is used for real (Task 10 enforces this).

**Steps:**
- [ ] Write the failing test:
```ts
// scripts/migrate-web-dev-to-erp.test.ts
import { describe, expect, it, vi } from "vitest";
import { planMigration } from "./migrate-web-dev-to-erp";

describe("planMigration", () => {
  it("marks a product skipped when its SKU already exists in the target", () => {
    const rootProducts = [{ id: "r1", sku: "DUP-1", slug: "dup-1", nameUz: "X", nameRu: "X", nameEn: "X" }];
    const erpSkus = new Set(["DUP-1"]);

    const plan = planMigration({ rootProducts, erpSkus, erpSlugs: new Set() });

    expect(plan.products.skipped).toHaveLength(1);
    expect(plan.products.skipped[0]).toMatchObject({ id: "r1", reason: "sku_exists" });
    expect(plan.products.toInsert).toHaveLength(0);
  });

  it("plans an insert for a non-colliding product", () => {
    const rootProducts = [{ id: "r2", sku: "NEW-1", slug: "new-1", nameUz: "Y", nameRu: "Y", nameEn: "Y" }];
    const plan = planMigration({ rootProducts, erpSkus: new Set(), erpSlugs: new Set() });

    expect(plan.products.toInsert).toEqual(rootProducts);
    expect(plan.products.skipped).toHaveLength(0);
  });
});
```
- [ ] Run: `npx vitest run scripts/migrate-web-dev-to-erp.test.ts` — expect FAIL (module doesn't exist)
- [ ] Write `scripts/migrate-web-dev-to-erp.ts`'s pure planning core (no DB I/O — this is the part the test above exercises):
```ts
export interface RootProductRow {
  id: string; sku: string; slug: string; nameUz: string; nameRu: string; nameEn: string;
  [key: string]: unknown;
}

export interface PlanInput {
  rootProducts: RootProductRow[];
  erpSkus: Set<string>;
  erpSlugs: Set<string>;
}

export interface SkippedRow<T> { row: T; reason: string; }

export interface TablePlan<T> {
  toInsert: T[];
  skipped: (T & { reason: string })[];
}

export function planMigration(input: PlanInput): { products: TablePlan<RootProductRow> } {
  const toInsert: RootProductRow[] = [];
  const skipped: (RootProductRow & { reason: string })[] = [];

  for (const product of input.rootProducts) {
    if (input.erpSkus.has(product.sku)) {
      skipped.push({ ...product, reason: "sku_exists" });
    } else if (input.erpSlugs.has(product.slug)) {
      skipped.push({ ...product, reason: "slug_exists" });
    } else {
      toInsert.push(product);
    }
  }

  return { products: { toInsert, skipped } };
}
```
- [ ] Run the test, confirm PASS
- [ ] `npx tsc --noEmit && npx vitest run scripts/migrate-web-dev-to-erp.test.ts`
- [ ] Commit: `git add scripts/migrate-web-dev-to-erp.ts scripts/migrate-web-dev-to-erp.test.ts && git commit -m "feat(scripts): add dry-run planning core for web_dev->erp migration"`

### Task 10: Migration script — per-table I/O, collision handling for every model

**Files:**
- Modify: `scripts/migrate-web-dev-to-erp.ts`
- Test: extend `scripts/migrate-web-dev-to-erp.test.ts`

**Per-table plan** (this session's audit gives the exact source/target column mapping — write these directly, don't re-derive):

- **`Brand`**: root has none migrated yet distinct from `backend/`'s (both use `slug` unique) — plan by `slug` collision, same pattern as products.
- **`Category`**: root's 56 rows → `backend/`'s `categories`. Root's `Category.id`/`slug`/`nameUz`/`nameRu`/`nameEn`/`type`/`parentId`/`order`/`icon` map 1:1 to `backend/`'s columns (confirmed identical field-for-field this session). Plan by `slug` collision. **Insert in parent-first order** (root categories with `parentId: null` first, then repeat passes for children whose parent now exists) — a flat single-pass insert will violate the `parentId` foreign key for any non-root category.
- **`Product`**: plan by `sku` collision (primary) then `slug` collision (secondary) — Global Constraints already names the 2 known collisions. Root's columns map 1:1 except: root has no `purchasePrice` (insert `NULL`), root has `stock`/`stockStatus` as real columns that don't exist in `backend/` — do not insert them into `products`; instead, for every product that's actually inserted, also insert one `Inventory` row: `{ productId: <new id>, warehouseId: <the "Katalog (ko'chirilgan)" warehouse from Task 8's setup step below>, quantity: <root's Product.stock>, reservedQuantity: 0 }`.
- **`User`**: root's 2 rows → `backend/`'s `users`. Plan by `email` collision (root's `director@dieselparts.uz` and the seller's `xusanyarashov1@gmail.com` — check both against `backend/`'s existing `email`/`phone` columns; this session confirmed **no collision** on either). Copy `passwordHash` verbatim (Global Constraints — do not re-hash). Map `Role.DIRECTOR → 'DIRECTOR'`, `Role.SELLER → 'SELLER'`. A migrated `SELLER`-role user additionally needs a `Seller` row (`backend/`'s schema requires one for the role to function in `orders`/`inquiries` scoping) — create one with `warehouseId: null` (resolved lazily, same as the checkout CRM-order path already does per the 2026-08-23 plan's Task 10).
- **`Customer`**: root's 1 row → `backend/`'s `customers`. Phone is non-unique on both sides (confirmed) — no collision logic needed, always insert. Map `name`/`phone`/`email`/`company`/`notes`/`assignedSellerId`(remap to the migrated `User`'s new id)/`createdAt`/`updatedAt`. Root's `assignedSellerId` must be remapped through the `User` id-mapping table Task 10 builds — if it points at a root user that wasn't migrated (shouldn't happen given root only has 2 users, both migrated), fall back to `NULL` and log a warning, don't fail the run.
- **`Inquiry`**: root's 1 row → `backend/`'s `inquiries`. Same id-remap treatment for `productId` (through the `Product` id-mapping table — if the inquiry's product was skipped as a SKU collision, remap to the **existing** `backend/` product with that SKU instead of dropping the inquiry) and `assignedSellerId`.
- **`Review`**: 0 rows on both sides currently — write the table-plan function for completeness (symmetry with the others, and so a future non-empty state is handled) but there's nothing to verify against real rows this run; add one unit test with a synthetic row instead.

**Steps:**
- [ ] Write failing tests for the `Category` parent-ordering logic, the `Product`→`Inventory` side-effect, and the `User`-role→`Seller`-row side-effect (three more `describe` blocks in the existing test file, same style as Task 9's)
- [ ] Run them, confirm FAIL
- [ ] Implement `planMigration`'s remaining table branches (`categories` with the parent-ordering pass, `products` with the `Inventory` side-effect list, `users` with the `Seller`-row side-effect list, `customers`, `inquiries`, `reviews`) per the mapping above — extend the return type accordingly
- [ ] Write the DB-I/O shell around the pure planning core: connect to both databases via `pg.Client` (reuse the connection-string-quote-stripping fix this session had to apply manually — `.env` values here are double-quoted, `new Client({connectionString: url.replace(/^"|"$/g, '')})`), fetch each root table fully, call the matching `plan*` function, and in `--dry-run` mode (default) print a table-by-table summary (`console.table` is fine) of insert counts and skip counts+reasons, then exit **without opening a write transaction at all**
- [ ] Add the one-time `Warehouse` bootstrap check: before planning `Product`/`Inventory`, query `backend/`'s `warehouses` for a row named `"Katalog (ko'chirilgan)"`; the dry-run plan notes whether this warehouse will need to be created (it doesn't create it in dry-run mode)
- [ ] Run the tests, confirm PASS
- [ ] Run `npx tsx scripts/migrate-web-dev-to-erp.ts --dry-run` against the real local dev databases, read the printed plan, confirm it matches this session's audit numbers (19 products minus 2 collisions = 17 to insert, 56 categories, 2 users, 1 customer, 1 inquiry, 0 reviews) — if it doesn't match, that's a bug in this task, not a data surprise; fix before proceeding
- [ ] `npx tsc --noEmit && npx vitest run scripts/migrate-web-dev-to-erp.test.ts`
- [ ] Commit: `git add scripts/migrate-web-dev-to-erp.ts scripts/migrate-web-dev-to-erp.test.ts && git commit -m "feat(scripts): add full per-table migration planning and dry-run I/O"`

### Task 11: Migration script — apply mode, backup, run it for real

**Files:**
- Modify: `scripts/migrate-web-dev-to-erp.ts`

**Steps:**
- [ ] Before writing `--apply` mode, take a real backup of `backend/`'s local dev database: `pg_dump` it to `scripts/backups/diesel_parts_erp_pre_migration_<date>.sql` (create the `scripts/backups/` dir; add it to `.gitignore` — this file must never be committed, it's a full data dump) — this is the rollback path if `--apply` goes wrong; state this file's path in the commit message so it's easy to find later
- [ ] Implement `--apply`: same planning core as Task 10, but wraps every table's inserts in one `pg` transaction against `backend/`'s connection (`BEGIN` ... per-table `INSERT`s using the id-remapping tables built along the way ... `COMMIT`), creating the `"Katalog (ko'chirilgan)"` warehouse first if the dry-run said it was needed. On any error, the transaction rolls back and the script exits non-zero with the row/table that failed — no partial-apply state.
- [ ] Run `npx tsx scripts/migrate-web-dev-to-erp.ts --apply` against the real local dev databases
- [ ] Verify: re-run the row-count check from this plan's research (`SELECT count(*) FROM products`, etc., against `backend/`'s DB) and confirm it grew by exactly the dry-run's planned insert counts (22+17=39 products, 6+56=62 categories, 7+2=9 users, 12+1=13 customers, 0+1=1 inquiry)
- [ ] Verify the director login specifically: `curl -X POST http://localhost:3001/api/auth/login -H 'Content-Type: application/json' -d '{"identifier":"director@dieselparts.uz","password":"<the real password>"}'` (ask the user for the password if you don't have it stored anywhere accessible, or use `SEED_DIRECTOR_PASSWORD` from `.env.local` if that's confirmed to be the account's actual current password — check root's seed script to see whether it's used to *set* the password or just to *seed a fresh one*, don't assume) — confirm `200` with a valid token, not `401`
- [ ] `cd backend && npx tsc --noEmit && npm run lint && npx jest` (the backend app itself is unaffected by this script but its test suite should still be green — this is a sanity check, not expected to catch anything)
- [ ] Commit: `git add scripts/migrate-web-dev-to-erp.ts .gitignore && git commit -m "feat(scripts): add apply mode with transactional write and pre-migration backup"`

---

## Part 3 — Next.js: backend HTTP client and staff auth

### Task 12: Server-side backend API client for staff calls

**Files:**
- Create: `lib/api/backend-client.ts`
- Create: `lib/api/backend-client.test.ts`

**Steps:**
- [ ] Write the failing test (mock global `fetch`):
```ts
// lib/api/backend-client.test.ts
import { describe, expect, it, vi } from "vitest";
import { backendRequest, BackendApiError } from "./backend-client";

describe("backendRequest", () => {
  it("sends a bearer token and returns parsed JSON on success", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ id: "1" }),
    });

    const result = await backendRequest("/products", { accessToken: "tok" });

    expect(result).toEqual({ id: "1" });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/products"),
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer tok" }) }),
    );
  });

  it("throws BackendApiError with parsed message/code on a 4xx", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false, status: 404,
      json: async () => ({ message: "Product not found", error: "not_found" }),
    });

    await expect(backendRequest("/products/x")).rejects.toMatchObject({
      status: 404, code: "not_found", message: "Product not found",
    });
  });
});
```
- [ ] Run: `npx vitest run lib/api/backend-client.test.ts` — expect FAIL (module doesn't exist)
- [ ] Write `lib/api/backend-client.ts`, modeled on `lib/api/seller-panel/client.ts`'s error-parsing but server-side (`import "server-only"`, plain `fetch`, no axios/zustand — this runs in route handlers and the DAL, not the browser):
```ts
import "server-only";

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export class BackendApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "BackendApiError";
    this.status = status;
    this.code = code;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE" | "PUT";
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  accessToken?: string;
  /** Raw Cookie header value to forward to backend's own refresh endpoint. */
  refreshCookie?: string;
}

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const url = new URL(`${BACKEND_URL}/api${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

export async function backendRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, query, accessToken, refreshCookie } = options;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (refreshCookie) headers.Cookie = refreshCookie;

  const res = await fetch(buildUrl(path, query), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return undefined as T;

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const message = Array.isArray(data?.message) ? data.message.join(", ") : (data?.message ?? res.statusText);
    throw new BackendApiError(message, res.status, data?.error ?? String(res.status));
  }

  return data as T;
}
```
- [ ] Add `BACKEND_INTERNAL_URL` to `.env.example` beside the existing `NEXT_PUBLIC_API_URL` entry (same value in local dev; a real internal network address in production if `backend/` isn't publicly reachable at the same URL the browser uses)
- [ ] Run the test, confirm PASS
- [ ] `npx tsc --noEmit && npx vitest run lib/api/backend-client.test.ts`
- [ ] Commit: `git add lib/api/backend-client.ts lib/api/backend-client.test.ts .env.example && git commit -m "feat: add server-side backend API client for staff calls"`

### Task 13: Role reconciliation — widen `StaffRole`

**Files:**
- Modify: `lib/auth/roles.ts`, `lib/auth/roles.test.ts` (create if it doesn't exist)

**Reconciliation decision:** `backend/`'s `Role` enum (`SUPER_ADMIN | DIRECTOR | MANAGER | SELLER | VIEWER`) has three more values than root's `StaffRole` (`DIRECTOR | SELLER`) did. This project has no existing UI concept for `SUPER_ADMIN`/`MANAGER`/`VIEWER` at the panel-access level — `backend/`'s own API guards already establish the convention (`DIRECTOR_UP = [SUPER_ADMIN, DIRECTOR]`, `MANAGER_UP = [SUPER_ADMIN, DIRECTOR, MANAGER]`, `SELLER_UP` adds `SELLER`). This task mirrors that convention at the UI-gating level: `SUPER_ADMIN` and `MANAGER` get the director panel (same as `DIRECTOR_UP`/`MANAGER_UP` treat them as director-or-above for API access), `VIEWER` also gets the director panel but read-only enforcement stays at the API layer (this task does not add per-page read-only UI — that's a separate, later concern if the user ever creates a `VIEWER` account; today `backend/`'s seed has exactly one `VIEWER` row and no page currently branches on it). `SELLER` keeps going to `/admin/seller`.

**Steps:**
- [ ] Write the failing test:
```ts
// lib/auth/roles.test.ts
import { describe, expect, it } from "vitest";
import { adminHomePath, canAccessAdminPath } from "./roles";

describe("adminHomePath", () => {
  it("sends MANAGER and SUPER_ADMIN to the director root, same as DIRECTOR", () => {
    expect(adminHomePath("MANAGER")).toBe("/director");
    expect(adminHomePath("SUPER_ADMIN")).toBe("/director");
    expect(adminHomePath("VIEWER")).toBe("/director");
    expect(adminHomePath("SELLER")).toBe("/admin/seller");
  });
});
```
- [ ] Run: `npx vitest run lib/auth/roles.test.ts` — expect FAIL (TS type error: `"MANAGER"` not assignable to `StaffRole`)
- [ ] Widen `StaffRole`:
```ts
export type StaffRole = "SUPER_ADMIN" | "DIRECTOR" | "MANAGER" | "SELLER" | "VIEWER";
```
- [ ] Update `adminHomePath`:
```ts
export function adminHomePath(role: StaffRole): string {
  return role === "SELLER" ? "/admin/seller" : DIRECTOR_ROOT;
}
```
- [ ] Update `ADMIN_AREAS`'s `/admin/seller` entry to include every role that may support a seller — keep it as `["SELLER", "DIRECTOR", "MANAGER", "SUPER_ADMIN"]` (a manager/director/super-admin can still open seller pages to support one, same reasoning the existing comment already gives for `DIRECTOR`)
- [ ] Run the test, confirm PASS
- [ ] `npx tsc --noEmit && npm run lint && npx vitest run lib/auth/roles.test.ts`
- [ ] Commit: `git add lib/auth/roles.ts lib/auth/roles.test.ts && git commit -m "feat(auth): widen StaffRole to match backend's five-role model"`

### Task 14: Rewrite staff session/DAL and login/logout to call `backend/`

**Files:**
- Modify: `lib/auth/dal.ts`, `lib/auth/staff-session.ts` (locate exact filename via the import in `dal.ts` — confirmed `getStaffSession` lives there)
- Modify: `app/director/login/page.tsx` and whatever server action/route it posts to (locate via reading that file — do not assume a path)
- Modify: `app/api/v1/auth/login/route.ts`, `app/api/v1/auth/logout/route.ts`, `app/api/v1/auth/me/route.ts` (these three currently hit root's own Prisma — check each before assuming; `me` might already just wrap `getStaffUser()`)

**Design:** the Next.js staff-session cookie stops being a self-contained signed claim about a root `userId`. It now holds an encrypted `{accessToken, refreshToken}` pair (reuse whichever encryption/signing primitive `staff-session.ts` already uses for its cookie — do not add a new crypto dependency). `getStaffUser()` decodes the cookie, calls `backendRequest('/auth/me', {accessToken})`. On a `401`, it calls `backendRequest('/auth/refresh', {refreshCookie: 'refresh_token=' + storedRefreshToken})`, gets a new pair, re-mints the cookie, retries `/auth/me` once; on repeated failure, returns `null` (existing behavior — every caller already handles "not signed in").

**Steps:**
- [ ] Write the failing test (extend or create `lib/auth/dal.test.ts`, mocking `backend-client.ts`'s `backendRequest`):
```ts
import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/api/backend-client", () => ({ backendRequest: vi.fn() }));
vi.mock("./staff-session", () => ({ getStaffSession: vi.fn() }));

import { backendRequest } from "@/lib/api/backend-client";
import { getStaffSession } from "./staff-session";
import { getStaffUser } from "./dal";

describe("getStaffUser", () => {
  it("returns null when there is no session", async () => {
    vi.mocked(getStaffSession).mockResolvedValue(null);
    expect(await getStaffUser()).toBeNull();
  });

  it("maps backend's /auth/me response onto StaffUser", async () => {
    vi.mocked(getStaffSession).mockResolvedValue({ accessToken: "tok", refreshToken: "r" } as any);
    vi.mocked(backendRequest).mockResolvedValue({
      id: "u1", name: "Director", email: "director@dieselparts.uz",
      role: "DIRECTOR", discountLimit: 5, isActive: true,
    } as any);

    const user = await getStaffUser();

    expect(user).toMatchObject({ id: "u1", role: "DIRECTOR", discountLimit: 5 });
  });
});
```
- [ ] Run: `npx vitest run lib/auth/dal.test.ts` — expect FAIL (`dal.ts` still imports `@/lib/db`)
- [ ] Rewrite `staff-session.ts`'s payload type from `{userId}` to `{accessToken, refreshToken}`, keeping the same encode/decode function names so nothing else importing them needs edits (check every current caller with `grep -rln "staff-session" lib app` first)
- [ ] Rewrite `getStaffUser` per the design above:
```ts
export const getStaffUser = cache(async (): Promise<StaffUser | null> => {
  const session = await getStaffSession();
  if (!session) return null;

  try {
    const user = await backendRequest<BackendMeResponse>("/auth/me", { accessToken: session.accessToken });
    return mapToStaffUser(user);
  } catch (error) {
    if (!(error instanceof BackendApiError) || error.status !== 401) return null;
  }

  try {
    const refreshed = await backendRequest<{ accessToken: string; refreshToken: string }>("/auth/refresh", {
      refreshCookie: `refresh_token=${session.refreshToken}`,
    });
    await setStaffSession(refreshed); // re-mint the Next.js cookie — reuse staff-session.ts's existing setter
    const user = await backendRequest<BackendMeResponse>("/auth/me", { accessToken: refreshed.accessToken });
    return mapToStaffUser(user);
  } catch {
    return null;
  }
});
```
(`mapToStaffUser` is a small new private function: `{id: user.id, name: user.name, email: user.email ?? "", role: user.role, discountLimit: user.discountLimit}` — `email` defaults to `""` since `backend/`'s `User.email` is nullable but root's `StaffUser.email` was always a string; confirm no current caller of `StaffUser.email` breaks on an empty string before shipping, e.g. an admin header that displays the email — check `grep -rn "\.email" app/admin app/director components/admin components/director`)
- [ ] `requireStaff`/`requireDirector` need **no changes** — they only call `getStaffUser()` and check `.role`, both preserved
- [ ] Rewrite the login route: `backendRequest('/auth/login', {method:'POST', body:{identifier, password}})` (field name matches whatever Task 1 landed on), read `Set-Cookie` off the raw response for the refresh token (note: `backendRequest` as written in Task 12 uses `fetch` directly and returns parsed JSON — the login route needs the raw `Response` to read `Set-Cookie`, so either add a `raw: true` option to `backendRequest` that returns `{data, response}`, or have the login route call `fetch` directly instead of going through `backendRequest` for this one call; the latter is simpler and login is a single call site, so prefer that unless it creates real duplication), mint the Next.js session cookie with both tokens
- [ ] Rewrite the logout route to call `backendRequest('/auth/logout', {accessToken})` (revokes server-side) then clear the Next.js cookie regardless of that call's outcome (a failed revoke shouldn't leave the user stuck signed in locally)
- [ ] `app/api/v1/auth/me/route.ts`: if it currently duplicates DAL logic, simplify it to just call `getStaffUser()` and return it (check first — don't guess it's redundant)
- [ ] Run the test, confirm PASS
- [ ] Manually verify via `npm run dev`: `/director/login` with `director@dieselparts.uz` (the real, migrated credential — confirms Part 2's backfill actually preserved a working login end-to-end through the new HTTP path, not just at the API level), confirm `/director` loads, confirm a director-gated page loads, confirm logout clears the session and redirects
- [ ] `npx tsc --noEmit && npm run lint && npm run build`
- [ ] Commit: `git add lib/auth app/api/v1/auth app/director/login && git commit -m "feat(auth): back the staff session with backend's JWT pair instead of local Prisma"`

---

## Part 4 — Rewire every root-DB consumer

Same treatment per file throughout this part: replace every `prisma.*` call with a `backendRequest(...)` call to the corresponding Part 1/2026-08-23-plan endpoint, keep every exported function's name/signature/return type identical (Global Constraints), adapt the existing test file's mocks from `vi.mock("@/lib/db", ...)` to `vi.mock("@/lib/api/backend-client", ...)` where one exists, write one if it doesn't.

### Task 15: Products domain

**Files:** `lib/api/product-repository.ts`, `lib/api/product-write-repository.ts`, `lib/api/product-mapper.ts`, `lib/api/product-lookup-repository.ts`, `lib/api/product-stats-repository.ts`, `lib/api/stock-overview-repository.ts`

**Call-outs:**
- `product-mapper.ts` currently reads `product.stock`/`product.stockStatus` off a raw Prisma row — rewrite it to read `availableQuantity`/`stockStatus` off the shape `ProductsService.withStock()` (Part 1) now returns from the API (Global Constraints of the 2026-08-23 plan already flagged this exact change).
- `stock-overview-repository.ts` (backs `app/director/(panel)/warehouse`) currently queries root's flat `Product.stock`/`stockStatus` columns directly — after this task it calls `backend/`'s `GET products` (admin) and derives the same view from `availableQuantity`/`stockStatus` in the response; the page itself needs no changes since `StockStatus`/`StockPager` etc. only consume `lib/types.ts`'s `StockStatus` union, which stays the same three values.
- Public storefront reads (`product-repository.ts`'s public-facing exports, used by `app/(site)/**`) call `backend/`'s new `catalog/products` endpoints (Part 1, Task 5); admin/director reads call the existing guarded `products` endpoints with the staff access token from `getStaffUser`'s session.

**Steps per file:**
- [ ] For each exported function, write/adapt its test to mock `backendRequest` instead of `@/lib/db`'s `prisma`, asserting the right path/method/query is called and the response is mapped correctly
- [ ] Run each test, confirm FAIL against the still-Prisma implementation
- [ ] Rewrite the function body to call `backendRequest`
- [ ] Run the test, confirm PASS
- [ ] `npx tsc --noEmit`
- [ ] Commit per file or grouped: `git add lib/api/product-repository.ts lib/api/product-write-repository.ts lib/api/product-mapper.ts lib/api/product-lookup-repository.ts lib/api/product-stats-repository.ts lib/api/stock-overview-repository.ts && git commit -m "feat: rewire product repositories onto backend/"`

### Task 16: Categories/Brands domain

**Files:** `lib/api/catalog-repository.ts`

Same steps-per-file pattern as Task 15. Public tree read calls `backend/`'s `catalog/categories` (Part 1, Task 6); admin CRUD calls the existing guarded `categories` endpoints.

### Task 17: Customers domain

**Files:** `lib/api/customer-repository.ts`

Same pattern. `listCustomers`/`getCustomer`/`createCustomer`/`updateCustomer`/`claimCustomer`/`listCustomerInquiries`/`findCustomersByPhone` all have a `backend/` equivalent already (2026-08-23 plan's Task 8, confirmed shipped via `common/scope.ts`'s existence). Director sees everything unscoped (`customerReadScope` already handles this server-side); no client-side scoping logic to port.

### Task 18: Orders domain

**Files:** `lib/api/order-repository.ts`

**Call-out:** root's `OrderStatus` (`DRAFT|PENDING|CONFIRMED|COMPLETED|CANCELLED`) maps onto `backend/`'s (`DRAFT|NEW|CONFIRMED|PREPARING|COMPLETED|CANCELLED|PENDING_REVIEW`) with root's `PENDING` reading as `backend/`'s `NEW` (2026-08-23 plan's Part 1 reconciliation note #5 — still accurate, unchanged by the checkout plan's later `PENDING_REVIEW` addition, which root's UI has no concept of yet and doesn't need to for this task: director-created orders never enter `PENDING_REVIEW`, only self-checkout ones do). `requestOrderDiscount` calls Part 1 Task 3's new endpoint.

### Task 19: Inquiries domain

**Files:** `lib/api/inquiry-repository.ts`, `lib/api/inquiry-board-repository.ts`

Both have direct `backend/` equivalents already shipped (Reviews/Inquiries modules, 2026-08-23 plan Task 3).

### Task 20: Reviews domain

**Files:** `lib/api/review-repository.ts`

Direct `backend/` equivalent already shipped (2026-08-23 plan Task 2).

### Task 21: Discount requests and audit domain

**Files:** `lib/api/discount-repository.ts`, `lib/api/audit.ts`

`audit.ts`'s `recordAudit` — check every current call site (`grep -rln "recordAudit" lib app`). If every one of them lives inside a repository function that Tasks 15–20 already rewired to call a `backend/` endpoint that itself now logs the audit entry server-side (Part 1, Task 4), delete `recordAudit`'s call from the Next.js side entirely at each site — double-logging would be a bug. If any caller needs a bare audit write with no corresponding domain mutation, keep a thin passthrough to `backend/`'s `GET/POST audit` endpoints instead of deleting `audit.ts` outright.

### Task 22: Users domain

**Files:** `lib/api/user-repository.ts`

`listStaff`'s `completedOrders` aggregate and `createStaff`/`updateStaff`'s guards now come from `backend/` (Part 1, Task 2) — this file becomes a thin wrapper, same pattern as the rest.

### Task 23: Analytics domain (partial — leave the pre-existing blocked sections alone)

**Files:** `lib/api/analytics-repository.ts`, `lib/api/analytics-detail-repository.ts`

Per this project's own memory (margin/supplier/debt/stock-trend sections were already blocked pending new Prisma models before this plan started — that is a separate, already-tracked piece of work this plan does not resolve): rewire only the parts of these two files that have a real `backend/` equivalent today (sales-summary, inventory-status, seller-dashboard-shaped reads). Leave the blocked sections' existing TODOs exactly as they are — do not silently implement them with guessed logic, and do not delete the TODO comments (they're load-bearing documentation of a known gap, not stale cruft).

### Task 24: Product image upload route

**Files:** `app/api/v1/products/[id]/image/route.ts`

No change to `lib/api/product-image-storage.ts` (pure disk I/O, no Prisma — stays as-is). Change the route: after `saveProductImage(file)` returns the new `imageUrl`, call `backendRequest('/products/' + id + '/image', {method:'PATCH', body:{imageUrl}, accessToken})` (Part 1, Task 8's endpoint) instead of writing via a Prisma-backed repository call. On failure, call `deleteProductImage(imageUrl)` to clean up the orphaned file — check the route's current failure-path behavior and preserve it, don't invent a new one.

### Task 25: Verify every remaining `app/api/**` route

**Files:** all 47 files under `app/api/**` (4 already proxy to `backend/` and need no changes — `checkout`, `cart/**`, `products/ai-fill`, `products/ai-generate-image`; verify the remaining ~43 per-file, some of which — `app/api/auth/*` (the customer phone-OTP flow) — may use neither database and also need no changes; confirm rather than assume)

This task is verification, not authoring — Tasks 15–24 should have made every route's underlying repository calls swap transparently.

- [ ] `npx tsc --noEmit` across the whole root app, fix any type mismatch that surfaces (e.g. a repository's return type changed shape slightly because `backend/`'s JSON serializes `Decimal` as a `string` where Prisma returned a `Decimal` object — reconcile this at the repository boundary in whichever of Tasks 15–24 owns that file, not here, if this task finds one)
- [ ] Manually smoke-test in the browser (`npm run dev`, or the `run` skill / `mcp__claude-in-chrome__*` tools): storefront product listing, product detail + review submission, `/director` product CRUD + CSV import/export + image upload, category tree edit, discount request + approval, inquiry board claim, audit log view (confirm Part 1 Task 4's new audit rows actually show up here — this is the concrete check that task's work paid off), staff user management — one pass through each, note any breakage
- [ ] Commit any fixes found: `git commit -m "fix: reconcile response shapes after backend rewire"`

### Task 26: `app/admin/seller/**` (legacy embedded seller CRM)

**Decision, inherited unchanged from the 2026-08-23 plan's own Task 17:** keep the pages, only rewire their data access (already covered by Tasks 15–22, since they call the same repository functions) — do not delete. Flag in the final report that this route still exists so the user can separately decide whether to remove it now that the seller panel proper (`app/seller/**`) fully duplicates its purpose.

**Files:** `app/admin/seller/**`, `components/admin/**`, `hooks/admin/use-admin-products.ts`, `lib/api/admin/resources.ts` — expected to need no changes beyond what Task 25 already catches.

---

## Part 5 — Cutover and cleanup

### Task 27: Full regression pass, both projects

- [x] `cd backend && npx tsc --noEmit && npm run lint && npx jest && npm run build` — clean; 31 suites/360 tests passing
- [x] `cd .. && npx tsc --noEmit && npm run lint && npm run build && npm test` — clean; 149 files/1463 passing, 6 known pre-existing failures (`app/sitemap.test.ts`, `lib/count-up.test.ts`, `components/marketing/workshop-backdrop.test.tsx`) unrelated to this plan, unchanged since earlier sessions verified them
- [x] Boot both (`npm run dev` in `backend/`, `npm run dev` at root) and smoke-test end-to-end once more: storefront browsing/review/inquiry submission; director login, product CRUD + CSV import/export + image upload, category tree edit, discount request + approval, inquiry board claim, audit log view, staff user management, warehouse/stock view; seller panel (`/login`, `/seller/**`) untouched and still working (confirms Part 3/4 didn't regress it); legacy `/admin/seller` still working — **done via HTTP requests against the live dev servers (curl + real seeded/test credentials), not a rendered browser** (the Claude-in-Chrome extension was not connected this session, confirmed twice; user chose the HTTP-level fallback). Booted `backend/` (`npm run start:dev`, port 4000) and root (`npm run dev`, port 3000). Exercised: storefront home/listing/product-detail/category pages, public inquiry submission end-to-end (confirmed landing on the seller's inquiry board), inquiry claim through root's rewired route, CSV export, every `/director/**` page with a real DIRECTOR session, the storefront availability filter and director warehouse stock filter, seller-scoped backend endpoints with a real SELLER JWT, and every `/seller/**` and `/admin/seller/**` page with both a DIRECTOR and a real SELLER session. Found and fixed two real regressions this pass caught (see commits `c8dfcc4` and `8f23cb9`): (1) backend/'s `IN_STOCK|LOW_STOCK|OUT_OF_STOCK` stock-status enum was never translated to/from root's own `available|limited|out_of_stock` vocabulary anywhere, crashing `/products/[slug]` for 22 of 39 products (a `specs` default-shape bug, found alongside it) and silently breaking every stock-status filter/comparison across the storefront, director warehouse, and analytics low-stock views; (2) `PanelShell` (shared chrome for `/director/**` and `/admin/seller/**`) unconditionally called a DIRECTOR-only backend analytics endpoint, 500ing the entire legacy seller panel for an actual SELLER. Not exercised (would need real customer phone-OTP SMS, out of scope for a dev smoke test — see Global Constraints on Eskiz costs/test-mode): product review submission, self-checkout order placement (verified instead via pre-existing real self-checkout orders already in the database, see Part 6's checklist above), CSV import (a file upload), product image upload, discount request+approval and category tree edit's actual write actions (their pages load and their read-side data is correct; the write actions themselves rely on the same rewired repositories Tasks 3/16/17/18 already unit-tested and reviewed, so this pass did not re-exercise them live).

### Task 28: Delete root Prisma, remove dependencies, retire `diesel_parts_web_dev`

**Files:**
- Delete: `prisma/` (entire directory)
- Delete: `lib/db.ts`
- Modify: root `package.json` (remove `@prisma/client`, `@prisma/adapter-pg`, `prisma` deps; remove `postinstall: prisma generate`, `db:generate`, `db:migrate`, `db:seed`, `db:studio`, `db:demo` scripts)
- Modify: root `tsconfig.json` if it has a `prisma/generated` path alias
- Modify: `.gitignore` if it references `prisma/generated`
- Modify: `.env.local`, `.env.example` — remove the root `DATABASE_URL` entry

**Steps:**
- [x] Grep the whole root app (excluding `backend/`) for `@/lib/db`, `@prisma/client`, `@/prisma/generated` — confirm zero remaining imports (every earlier task should have already eliminated these; this is the final check, not the first fix) — found and fixed 3 real gaps (enum type imports, dead Prisma-typed scope/search functions, and marketing fixture data that lived under `prisma/seed-data/` for no ORM-related reason); see commit `d5cc994` for the full breakdown
- [x] Delete the files/directories above
- [x] Update `package.json`, run `npm install` to regenerate the lockfile without the removed deps — also added `pg`/`@types/pg` as direct devDependencies (previously only a transitive dep of the now-removed `@prisma/adapter-pg`) so `scripts/migrate-web-dev-to-erp.ts` keeps building; cleared `next.config.ts`'s now-dead `serverExternalPackages` entry
- [x] `npx tsc --noEmit && npm run lint && npm run build && npm test` — clean; 150 files/1451 tests, 1445 passing, same 6 known pre-existing failures as Task 27, no new ones
- [x] **Stop and confirm with the user before this step**... take a final `pg_dump` of `diesel_parts_web_dev` alongside the one already taken in Part 2, Task 11, then `DROP DATABASE diesel_parts_web_dev` locally once the user has confirmed... — **user confirmed ("Backup qil, keyin drop qil"). Backup taken**: `scripts/backups/diesel_parts_web_dev_final_pre_drop_2026-08-31.sql` (77KB, `pg_dump.exe` from the matching PostgreSQL 17 client — the running server is 17.10 — all 13 tables present in the dump, verified by grepping its `COPY public.*` lines before dropping anything). **Database dropped**: `DROP DATABASE diesel_parts_web_dev` via `psql`, confirmed gone from `\l` — only `diesel_parts_erp` remains on the local server.
- [x] Commit: `git add -A && git commit -m "chore: remove root Prisma layer, root app is now backend/-only"` — commit `d5cc994` (code-side only; the DB-drop step above has no code artifact to commit and is still pending)

---

## Part 6 — Reconciliation with `docs/superpowers/plans/2026-08-28-checkout-order-types-expansion.md`'s Bosqich 6

That plan's Bosqich 6 (seller panel visibility for self-checkout orders) explicitly wrote, in its own Global Constraints: *"Extending the director panel to see these orders would require either duplicating order data across two databases ... or migrating `app/director/**` onto `backend/` — the multi-week effort the abandoned consolidation plan itself was for. That is a scope-creep architecture change ... so it is not attempted here; flagged to the user in this plan's own summary instead of decided silently."* This plan is that migration — once this plan's Part 5 lands, that constraint is obsolete and should be **explicitly removed**, not just left stale:

- [x] After this plan's Part 5 is complete, re-open `docs/superpowers/plans/2026-08-28-checkout-order-types-expansion.md` and strike its Global Constraints bullet about the two-database split (the one quoted above) — add a note pointing at this plan instead of deleting the history outright, e.g. `~~Extending the director panel...~~ Resolved by docs/superpowers/plans/2026-08-28-backend-consolidation-director-panel.md — the director panel now reads backend/ directly.` — done (Part 5's code-side work is complete; only the gated DB-drop step remains, which does not affect this)
- [x] `app/director/**` gains visibility into self-checkout orders (Payme, Click, Paynet, Cash, pending quotes) for free once Task 18 (Orders domain rewire) lands... Verify this specifically as part of Task 27's smoke test: place a self-checkout order (any method), confirm it's visible from the director panel's order view, not just the seller panel's. — **verified by reading the code path, not by placing a live order** (no browser session this session): the dashboard's `RecentOrdersTable` is fed by `getRecentOrders` in `lib/api/analytics-repository.ts`, which calls `backend/`'s `GET /analytics/recent-orders`; `AnalyticsService.recentOrders` (`backend/src/analytics/analytics.service.ts`) is an unscoped `prisma.order.findMany` with no channel/origin filter, gated only by `@Roles(...DIRECTOR_UP)` — so self-checkout orders appear alongside CRM ones with no extra work. A live end-to-end placement test is still open, folded into Task 27's still-open manual smoke test above.
- [x] If the director panel today has **no** dedicated "orders" list page at all... note this explicitly in the closing report rather than silently claiming it's covered, and leave it as a follow-up the user can decide to spec separately. — confirmed: `app/director/(panel)/**` has `analytics`/`audit`/`categories`/`customers`/`discounts`/`products`/`reviews`/`users`/`warehouse`, no `orders/`. Noted as an explicit, undecided follow-up — not attempted here.

---

## Self-review notes (from the plan author, not a task)

- **Spec coverage:** every gap Part 0's audit found in the 2026-08-23 plan's Part 3/4/5 has a task (Part 1 Tasks 1–8 close Part 3's gaps; Part 3/4 here are that plan's Part 4; Part 5 here is that plan's Part 5). The new two-way data-merge problem (not anticipated by either prior plan) is Part 2. The scope-widening from "director panel" to "every root-DB consumer" is stated up front in the Architecture section and enforced by Part 4 covering the storefront and legacy admin panel alongside the director panel, not just the latter.
- **Known gap intentionally left open:** analytics sections already blocked on missing models (margin/supplier/debt/stock-trend — per prior project memory) stay blocked; Task 23 does not invent those models or guess at implementing them.
- **Known risk flagged for the final report:** Part 2's migration script runs against real local dev data on both sides (not empty tables, per the row counts audited this session) — Task 11 takes a `pg_dump` backup before `--apply` specifically because of this, and Task 28's database drop is gated on an explicit user confirmation rather than being automatic.
- **Known follow-up, not this plan's job:** whether `app/admin/seller/**` (the legacy CRM, kept per Task 26's inherited decision) should be deleted now that `app/seller/**` fully duplicates it — flagged, not decided, consistent with how the original 2026-08-23 plan treated the same question.
