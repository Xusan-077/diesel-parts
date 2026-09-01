# Production deploy checklist

> ## ⚠️ NEVER point a local `DATABASE_URL` at the Railway production Postgres
>
> This happened twice on 2026-08-23 and broke production live traffic both
> times. `.env.local` (root app) and `backend/.env.example` (template file!)
> both had the real production connection string
> (`monorail.proxy.rlwy.net:54377/railway`, Railway project
> `melodious-adventure`) in them. Any `prisma migrate dev` / `db:migrate` run
> locally against that URL applies schema changes to the **live** database
> immediately — there is no confirmation prompt that knows it's production.
>
> - Local dev **always** uses a local or dedicated dev database. See
>   "Local dev setup" below.
> - `.env.local` and `backend/.env` are gitignored (`.env*` in `.gitignore`)
>   — that's expected, they hold real local secrets. But **`.env.example`
>   files are committed**, so they must never contain a real credential,
>   production or otherwise, even as a "just for reference" default.
> - Production's `DATABASE_URL` lives only in Vercel (root app) / Railway
>   service Variables (`backend/`) — never in a file inside this repo.

Written after the 2026-08-23 incident: `/api/products/home` (and every other
root-app route touching `Product`) returned 503 because the Railway Postgres
DB was missing the `imageUrl` column and still had the retired `imageLabels`
column, even though `_prisma_migrations` recorded both migrations as
successfully applied. The migration _history_ and the _actual database_ had
drifted apart silently. This checklist exists to catch that class of problem
before it reaches users again.

## 2026-08-23 incident timeline and fix (this pass)

Root cause, confirmed via Railway CLI + production logs:

1. `.env.local`'s `DATABASE_URL` was byte-for-byte identical to Railway's
   production Postgres `DATABASE_PUBLIC_URL`.
2. A local migration run applied `20260823070819_drop_product_image_labels`
   (`ALTER TABLE "Product" DROP COLUMN "imageLabels"`) directly to the
   **live** production database.
3. Production's currently-deployed build (last deployed 2026-08-22 20:25 UTC,
   from a different branch/commit than the one that dropped the column) still
   queries `Product.imageLabels` as a required field in multiple places
   (catalog cards, product gallery, CSV export, cart, wishlist) — every
   `prisma.product.findMany()` call started throwing
   `PrismaClientKnownRequestError P2022: The column Product.imageLabels does
not exist`, surfacing as 503s on `/api/products/home`, `/api/products`,
   and the storefront pages that call them.

Fix applied (production database, via `prisma db execute` with a raw SQL
file, **not** a new migration — this branch's `schema.prisma` has already
moved past `imageLabels`, so a real migration would just re-drop it later;
this is an out-of-band hotfix to unblock the currently-deployed build until
it's redeployed or replaced):

```sql
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "imageLabels" TEXT[];
UPDATE "Product" SET "imageLabels" = ARRAY['Asosiy'] WHERE "imageLabels" IS NULL;
```

Verified: `imageLabels` column present (`TEXT[]`), all 19 existing products
backfilled (0 remaining NULLs), and `/api/products/home`, `/api/products`,
and `/` on `https://api.diesel-parts.uz` all return `200` with real data
after the fix (confirmed against fresh requests, not a cached response).

**This restored column is not tracked by any Prisma migration.** Whoever
next runs `prisma migrate dev`/`deploy` for the root schema against
production (once dev/prod are properly separated and a real deploy pipeline
exists) needs to either re-add `imageLabels` to `schema.prisma` for real, or
formally author a migration that drops it again _after_ confirming the
deployed build no longer reads it. Don't let this drift silently a second
time — this is exactly the failure mode this checklist exists to prevent.

Also fixed in this pass: `.env.local`'s `DATABASE_URL` now points at a local
Postgres database (`diesel_parts_web_dev`, separate from `backend/`'s
`diesel_parts_erp`) instead of production — see "Local dev setup" below —
and the real production credential that was sitting in `backend/.env.example`
as a hardcoded "example" value was replaced with a warning + placeholder.

## Local dev setup

Both apps in this repo use the **same local Postgres server**
(`postgres:postgres@localhost:5432`) but **separate databases**, so their
independent Prisma schemas never collide:

| App                                 | `DATABASE_URL` (local)                                                             | Database               |
| ----------------------------------- | ---------------------------------------------------------------------------------- | ---------------------- |
| Root (Next.js, `.env.local`)        | `postgresql://postgres:postgres@localhost:5432/diesel_parts_web_dev?schema=public` | `diesel_parts_web_dev` |
| `backend/` (NestJS, `backend/.env`) | `postgresql://postgres:postgres@localhost:5432/diesel_parts_erp?schema=public`     | `diesel_parts_erp`     |

To stand either one up from scratch:

```sh
# root app
npx prisma migrate deploy   # applies prisma/migrations/ to diesel_parts_web_dev
npm run db:seed             # optional: seeds placeholder catalog data

# backend/
cd backend
npx prisma migrate deploy
npm run db:seed
```

If you don't have a local Postgres server yet, either install one natively
(what this repo currently uses) or run one via Docker:
`docker run -d --name diesel-parts-pg -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16`,
then create the two databases above with `createdb` or any Postgres client.

## Before every deploy that changes `prisma/schema.prisma` (root or `backend/`)

- [ ] Run `npx prisma migrate status` against the **target** `DATABASE_URL`
      (not just local) and confirm it says "Database schema is up to date!"
      with no drift warnings.
- [ ] Spot-check that the columns a new migration touches actually exist /
      don't exist as expected — `migrate status` reads the bookkeeping table,
      not the real columns, and the bookkeeping table can lie (as it did
      here) if a migration was interrupted, manually resolved with
      `prisma migrate resolve --applied`, or run against a DB that was later
      restored from an older backup.
- [ ] Never run `prisma migrate dev` directly against a shared/production
      `DATABASE_URL`. `migrate dev` is for local/throwaway databases only —
      use `prisma migrate deploy` for any shared environment (this repo does
      not yet run `migrate deploy` automatically; see "Open items" below).
- [ ] After deploying, hit one real endpoint that reads the changed
      model (e.g. `/api/products/home` for `Product`) and confirm 200, not
      just "deploy succeeded."

## Environment variables

**Root app (Vercel):**
| Variable | Local (`.env.local`) | Production (Vercel Project Settings → Environment Variables) |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000` | `https://api.diesel-parts.uz` |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` | `https://www.diesel-parts.uz` |
| `DATABASE_URL` | Railway Postgres (dev) | Railway Postgres (production) — **should not be the same physical database as local dev**; see "Open items" |
| `AUTH_SECRET`, `ESKIZ_EMAIL`, `ESKIZ_PASSWORD`, `ESKIZ_FROM`, `ESKIZ_SMS_TEMPLATE`, `SEED_DIRECTOR_PASSWORD` | see `.env.example` | set per environment in Vercel |
| `NEXT_PUBLIC_CLARITY_ID` | leave empty (Clarity only initializes when `NODE_ENV === "production"`, see `components/analytics/clarity-init.tsx`) | Microsoft Clarity project ID from clarity.microsoft.com — must be added to Vercel Project Settings → Environment Variables (Production) for session replay to start |

Set `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_SITE_URL` for both the
**Production** and **Preview** environments in Vercel (Preview should also
point at `https://api.diesel-parts.uz` unless a staging backend exists).

**Backend (Railway, service `diesel-parts`):**
| Variable | Notes |
|---|---|
| `DATABASE_URL` | Railway's Postgres plugin reference |
| `PORT` | Railway sets this; don't hardcode |
| `NODE_ENV=production` | gates the refresh-token cookie's `secure` flag |
| `JWT_ACCESS_SECRET`, `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_SECRET`, `JWT_REFRESH_EXPIRES_IN` | rotate the `change-me` dev defaults |
| `INTERNAL_SERVICE_SECRET` | shared with the root app's server-only code — must match on both sides |
| `CORS_ORIGINS` | comma-separated allowlist, e.g. `https://www.diesel-parts.uz,https://diesel-parts.uz` — **do not leave unset in production**, it falls back to `localhost:3000` only and will lock out the real frontend (fails closed, not open, by design) |

## Railway (backend)

- [ ] Confirm build command: `npm run build` (`nest build`) — no `railway.json`/`nixpacks.toml` in the repo, so Railway is auto-detecting via Nixpacks; verify in the dashboard under Settings → Build that this hasn't drifted.
- [ ] Confirm start command is `npm run start:prod` (`node dist/main`), **not** `npm start`/`nest start` (dev mode, no compiled output, wrong watch behavior in a container).
- [ ] Confirm `postinstall` (`prisma generate`) runs during the Railway build — it needs `prisma/schema.prisma` present but does not need a live DB connection.

## CORS

- Fixed in this pass: `main.ts` used `app.enableCors({ origin: true, credentials: true })`, which reflects _any_ request's `Origin` header back as allowed — with `credentials: true` that's a real CORS misconfiguration (any site can make credentialed requests). Replaced with an explicit allowlist read from `CORS_ORIGINS` (see table above), defaulting to `localhost:3000` only when unset.

## STATUS — backend schema alignment (2026-09-01, in progress)

Approach chosen: **adapt `backend/` to production's _current_ (root) Postgres
schema**, not migrate production forward to `backend/`'s consolidated schema.
Hybrid — common models adapt in code now (step 1); genuinely-missing
models/enums get a purely-additive migration later (step 2). This supersedes
"execute the consolidation plan" for now; see Open item 3.

### DONE — prep & step 1

- Production Postgres backed up and verified — `_db-backups/` (see its
  `README.md`): custom + plain `pg_dump` of `monorail.proxy.rlwy.net:54377/railway`,
  taken 2026-08-31T14:00Z, sha256s recorded.
- Staging DB `postgresql://postgres:postgres@localhost:5433/diesel_parts_staging`
  (local PG 18.6) is a verified byte-for-byte copy of production — table
  counts, row counts, columns, constraints, indexes, and `pg_dump --data-only`
  all match (only cosmetic dump-token / timezone-display differences).
- Broken migration row `20260823092527_init` marked `--rolled-back` on **both**
  production and staging (`prisma migrate resolve`) — metadata only, applied
  nothing, no data touched. `prisma migrate status` against prod no longer
  reports an error state (exit 0); it now shows the expected history
  divergence (prod has root's 9 migrations; `backend/`'s 6 are unapplied).
- `backend/prisma/schema.prisma` rewritten to match production's CURRENT
  shape, based on the deleted root schema (`git show d5cc994~1:prisma/schema.prisma`,
  which is the exact schema prod's data was migrated by) with `backend/`'s
  `generator` block. 12 models, 8 enums — schema body is byte-for-byte
  identical to `d5cc994~1:prisma/schema.prisma` apart from the extra
  `moduleFormat = "cjs"` generator line. `Role = {DIRECTOR, SELLER}`;
  `OrderStatus = {DRAFT, PENDING, CONFIRMED, COMPLETED, CANCELLED}`;
  `Order.totalAmount` (not `total`); `OrderItem.qty` + `unitPrice` (no `total`);
  `Brand.name` not unique; `Product/Category/Brand.id` has no `@default`
  (id = slug). `tsc` in `backend/` drops from 353 → 299 errors on this schema
  change alone. **Committed** (`backend/prisma/schema.prisma` was uncommitted
  through step 1b; the 1b code commits sit on top of it in history).

### DECIDED (D1–D3)

- **D1** — `Product`/`Category`/`Brand.id`: no `@default`; create/upsert paths
  pass the slug as `id` explicitly. (Not `@default(cuid())` — prod ids are
  slugs and frontend URLs depend on that.)
- **D2** — `User.updatedAt`: absent in prod; will be added via `ADD COLUMN` in
  step 2. `auth.service.ts` left untouched for now — it also reaches for the
  `Seller` relation and `RefreshToken` model (both step 2), so its 9 `tsc`
  errors all clear together in step 2, not before.
- **D3** — `OrderStatus.NEW` → `PENDING` mapping; `PREPARING` transitions
  removed in step 1, restored in step 2 via `ALTER TYPE ADD VALUE`. Prod has
  0 orders, so no data risk.

### DONE — step 1b (2026-09-01)

Code-only fixes (no migration): permanent renames + enum reductions +
explicit-id-on-create, one commit per file/spec (14 commits,
`392461f`..`da587a1`). Touched: `src/common/roles.ts` (+ `roles.guard.spec`),
`src/orders/order-status-transitions.ts` (+ spec), `src/orders/orders.service.ts`
(+ spec), `src/customers/customers.service.ts` (+ spec — `spendByCustomer` sums
`Order.totalAmount`), `src/brands/brands.service.ts` (slug-as-id, non-unique
name), `src/categories/categories.service.ts` (slug-as-id),
`src/discount-requests/discount-requests.service.ts` (approval writes
`Order.totalAmount`), `src/products/products.service.ts` (+ spec — sold-count
sums `OrderItem.qty`), `prisma/seed.ts` (slug-as-id, `PENDING`, `qty`).

Result: `tsc` 299 → **234** (close to the ~229 predicted). Every file that is
now `tsc`-clean is also `eslint`-clean; the 143 tests across the 9 touched
specs pass. Remaining 234 errors are all step 2 — verified: they are missing
models (`seller`, `refreshToken`, `inventory`, `warehouse`, `orderSequence`,
`stockMovement`, `payment`, `invoice`), missing columns (`Customer.taxId`
/`telegram`/`debt`, `Order.warehouseId`, `Product.purchasePrice`,
`User.updatedAt`), missing enum values (`PREPARING`, `SUPER_ADMIN`, `MANAGER`,
`VIEWER`) and missing types (`OrderPaymentStatus`, `PaymentMethod`,
`PaymentStatus`, `StockMovementType`) — nothing that a code-only fix could
resolve. Concentrated in `analytics.service.ts` (51), `products.service.ts`
(21), `inventory.service.ts` (21), `payme.service.ts` (17),
`dashboard.service.ts` (16), `auth.service.ts` (9).

### DONE — step 2 migration authored, staged, and applied to production (2026-09-01)

Migration `20260901120000_backend_step2_additive` (commit `c6d8b96`).
Purely additive — `grep -E "DROP |RENAME |ALTER COLUMN"` on the SQL is empty:

- `CREATE TYPE`: OrderPaymentStatus, StockMovementType, PaymentMethod,
  PaymentStatus, DeliveryMethod
- `ALTER TYPE … ADD VALUE`: Role (+SUPER_ADMIN, +MANAGER, +VIEWER),
  OrderStatus (+NEW, +PREPARING)
- `CREATE TABLE`: Warehouse, Inventory, StockMovement, OrderSequence, Payment,
  Invoice, Cart, CartItem, RefreshToken, Seller (+ their indexes and FKs)
- `ADD COLUMN` (all nullable or `DEFAULT`): Customer.{debt,taxId,telegram},
  Product.purchasePrice, Order.{warehouseId, paymentStatus, deliveryMethod,
  deliveryCity, deliveryDistrict, deliveryStreet, deliveryNotes, discount,
  deliveryFee}, User.updatedAt (`DEFAULT CURRENT_TIMESTAMP`).

Deviations from the original sketch, decided this pass:

- **Order.sellerId stays FK → User** (production's shape). The re-added
  `Seller` model is a separate optional record (`Seller.userId @unique → User`).
  It has no `orders` back-relation — `orders.service.ts` code that assumed
  `Order → Seller` is a step-3 fix.
- **`Product.imageLabels` is modelled again** (`String[]`, retired, unread) so
  the schema matches the column the 2026-08-23 hotfix left in prod. Without it
  Prisma's diff wanted to `DROP COLUMN "imageLabels"` — out of scope here.
  Dropping it for real is its own migration (see incident section).

Applied to **staging** (`localhost:5433`, byte-for-byte prod copy) via
`prisma db execute` + `prisma migrate resolve --applied` — **not**
`migrate dev` (the migration-history divergence would make `migrate dev` try
to reset staging). `prisma migrate diff` from staging now reports "empty
migration". `backend/` tsc **234 → 91**; all **360** tests pass.

**Applied to production 2026-09-01**, after SQL review and explicit approval.
Same path as staging — `prisma db execute` + `prisma migrate resolve
--applied`, **not** `migrate deploy` (`backend/prisma/migrations/` is still
not a baseline of prod's 9 applied root migrations; it holds the 6 abandoned
consolidated migrations, applied nowhere — reconciling that folder is a
tracked follow-up, not required for this migration). Both commands run via
`railway run --service Postgres -- bash -c '… "$DATABASE_PUBLIC_URL" …'` so
the credential never touched a file or shell history. Pre-backup taken first:
`_db-backups/prod_20260901T151115Z.{dump,sql}` (outside the repo).

Post-apply verification against prod, all PASS:
- `prisma migrate diff --from-config-datasource --to-schema` → **empty
  migration** (prod now matches `schema.prisma` exactly).
- Table count 13 → **23** (all 10 new tables present: Warehouse, Inventory,
  StockMovement, OrderSequence, Payment, Invoice, Cart, CartItem,
  RefreshToken, Seller).
- Enum values: `OrderStatus` 5 → 7, `Role` 2 → 5.
- Existing row counts **unchanged**: Product 19, Brand 7, Category 56,
  User 4, AuditLog 69, Order 0, Customer 0 — identical to the pre-migration
  backup.

### 🔴 DISCOVERED — live production outage, pre-existing, unrelated to step 2 (2026-09-01)

While hitting a real endpoint to verify the migration (per this checklist's
own "after deploying" rule), `GET /api/catalog/products` on
`https://api.diesel-parts.uz` returned **500**. Railway logs
(`railway logs --service diesel-parts`) show the cause:
`relation "public.products" does not exist` (also `public.categories`,
`public.brands`) — the **currently deployed build** queries lowercase
`@@map`-ped table names from the old consolidated schema, but production's
real tables have always been PascalCase (`Product`, `Category`, `Brand` — the
root schema; see the 2026-08-23 incident above). `catalog/products/slugs` 500s
the same way; `catalog/products/stats` 400s (separate issue).

**This is not caused by today's migration** — confirmed independently:
- The live deployment (`72b73ab6`) **succeeded 2026-08-31 18:34:18**, hours
  before this session's step-1 schema rewrite (`5114bff`) or step-2 migration
  (`c6d8b96`) existed. It has never run code that matches this checklist's
  step-1 schema.
- Step 2 is purely additive (verified above) — an old Prisma client simply
  doesn't select columns/tables it doesn't know about; it cannot break from
  something being added.
- The failure mode (`table … does not exist`, lowercase name) is exactly the
  root-cause class this whole backend-schema-alignment effort exists to fix,
  just not yet deployed.

**Not fixed in this pass** — fixing it means finishing step 3 (the 10 files
in the table above) and shipping a new Railway deploy of `backend/`, which is
explicitly out of scope for this session. Flagging because the storefront's
public catalog API is down *right now* independent of anything done here.

### NEXT — step 3 (code adaptation to the new schema, no migration)

Wire the service layer onto the now-present models/columns and restore the
enum maps. tsc-erroring files after step 2:

| File | Errs | What it needs |
| --- | --- | --- |
| `src/analytics/analytics.service.ts` | 45 | `Order.total`→`totalAmount`; `OrderItem.quantity/price`→`qty/unitPrice`; `include` for `order.customer`/`order.seller`; `_sum`/`_count` undefined guards |
| `src/products/products.service.ts` (+ spec) | 17+1 | inventory-join result typed `never` — wire `availableQuantity`/`stockStatus` off the new `Inventory` model |
| `src/dashboard/dashboard.service.ts` | 14 | `Order.total`→`totalAmount`; `OrderItem.quantity`→`qty`; `_sum` guards |
| `src/reports/reports.service.ts` | 4 | `Order.total`→`totalAmount`; `_sum` guards |
| `src/payme/payme.service.ts` | 4 | `Order.total`→`totalAmount` |
| `prisma/seed.ts` | 2 | `User.create` needs `name`+`email`; `Product.create` shape |
| `src/payments/payments.service.ts` | 1 | `Order.total`→`totalAmount` |
| `src/checkout/checkout.service.ts` | 1 | `OrderItem` create uses `quantity/price/total`→`qty/unitPrice` |
| `src/common/roles.ts` | 1 | `Record<Role,number>` needs SUPER_ADMIN/MANAGER/VIEWER weights |
| `src/orders/order-status-transitions.ts` | 1 | `Record<OrderStatus,…>` needs NEW/PREPARING transitions (D3) |

`inventory.service.ts`, `warehouses.service.ts`, `carts.service.ts`,
`sellers.service.ts`, `invoices.service.ts`, `auth.service.ts`,
`users.service.ts` — **now tsc-clean**, no step-3 work.

## Open items (not fixed in this pass — flagging for a decision)

1. ~~**Dev and production may be sharing one Postgres.**~~ **RESOLVED
   2026-08-23** — confirmed `.env.local`'s `DATABASE_URL` _was_ byte-for-byte
   the same as production's `DATABASE_PUBLIC_URL` (this was the direct cause
   of today's 503 — see incident section above); `.env.local` now points at
   a local `diesel_parts_web_dev` database instead, and the real credential
   that was also hardcoded in `backend/.env.example` was removed. See "Local
   dev setup" above.
2. **No automatic `prisma migrate deploy` on deploy.** Right now nothing
   runs migrations as part of a deploy for either the root app or `backend/`
   — `postinstall` only runs `prisma generate`. This is very likely how the
   drift that caused today's 503 happened: a migration was authored and
   marked "applied" in some environment without its DDL actually reaching
   the database `.env.local` points at now. Recommend wiring
   `prisma migrate deploy` into the Railway build step (backend) and into
   whatever runs before `next build` /as a Vercel build step (root app),
   or into a manual pre-deploy step this checklist enforces.
3. **⚠️ TRACKED SEPARATELY — do not fold into incident/hygiene fixes above:**
   the repo currently has **two independent Prisma schemas** (`prisma/schema.prisma`
   at root, `backend/prisma/schema.prisma`) with overlapping models
   (`Product`, `Category`, `Order`, ...) that both ultimately target the same
   physical Railway Postgres database — root via the public proxy URL,
   `backend/` via the internal Railway URL once deployed. They have already
   diverged (different column names — `name` vs `nameUz`/`nameRu`/`nameEn`,
   `imageUrl` vs none, nullable `warehouseId`, new `DRAFT` order status, new
   `Review`/`Inquiry`/`DiscountRequest`/`AuditLog` tables only in `backend/`,
   etc.) and production's actual database is still on the **root** schema's
   shape — `backend/`'s consolidated migrations have not been applied to
   production yet. Running both schemas' migrations against the same
   production database without a coordinated cutover risks a second,
   larger-scale version of today's incident (column/table mismatches across
   _both_ apps at once, not just one).
   A full plan for merging these already exists:
   `docs/superpowers/plans/2026-08-23-backend-consolidation.md`. This is a
   big, separate piece of work — plan and execute it on its own, not as a
   follow-on to this incident response. Until it lands, don't over-invest in
   root-app migration tooling (item 2 above) for the root schema specifically.

   **Update 2026-09-01:** direction reversed — see "STATUS — backend schema
   alignment" above. Instead of migrating production forward to the
   consolidated schema, `backend/` is being adapted down to production's
   current shape, with a later purely-additive migration for what's genuinely
   missing. The consolidation plan is on hold, not being executed as written.
