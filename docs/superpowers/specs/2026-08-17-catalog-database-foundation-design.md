# Catalog Database Foundation — Design Spec

Date: 2026-08-17
Status: Approved
Branch: `feat/catalog-database-foundation`

## 1. Why this is one sub-project and not the whole request

The originating brief (2026-08-17) asked for three pillars at once: a Railway-hosted
API, DIRECTOR/SELLER roles with two admin panels, and a site-wide visual redesign.
That is three independent subsystems plus a redesign, and it was decomposed. This
spec covers **only the first piece**: moving catalog data out of TypeScript literals
and into Postgres, and persisting the customer inquiries that are currently lost.

Roles, panels, and the redesign each get their own spec later. Section 9 lists what
this spec deliberately excludes.

### Corrections to the brief's premises

The brief was written without the repo in hand and three of its assumptions are stale:

1. **Auth already exists.** `lib/auth/` implements Eskiz.uz SMS OTP plus a `jose`
   JWT in an httpOnly cookie. The brief proposed adding NextAuth.js, which would
   collide with it. The roles sub-project will instead extend `Session`
   (`lib/auth/session-token.ts`, currently `{ phone }`) with `userId` and `role`.
2. **`middleware.ts` does not exist in this Next version.** It is `proxy.ts`
   (renamed in Next.js 16). More importantly, the Next docs state Proxy
   "should not be used as a full session management or authorization solution" —
   only optimistic checks. `/admin/**` protection will therefore be two layers:
   an optimistic redirect in `proxy.ts` plus real authorization in layouts and in
   every route handler. This constrains the roles sub-project, not this one.
3. **`product-repository.ts` is not a sufficient seam.** Its own comment claims
   "replacing the mock catalog with a database means changing only this file."
   That is wrong: `lib/product-lookup.ts` builds module-level `Map`s from the
   static arrays at import time, and four **client** components call
   `resolveProduct`/`resolveProducts` synchronously during render. See section 5.

## 2. Scope

- Prisma ORM against Railway Postgres, five models: `Brand`, `Category`,
  `Product`, `User`, `Inquiry`.
- Catalog reads (`/products`, `/products/[slug]`, `/categories/[slug]`,
  `/brands/[slug]`, home rows, `sitemap.ts`) served from the database.
- Filtering, sorting, and pagination executed in SQL.
- `POST /api/inquiry` and `POST /api/quote-request` persist an `Inquiry` row
  instead of calling `console.log`.
- Seed script: the existing 15 products, 10 categories, 7 brands, and one
  DIRECTOR user.
- Railway project + Postgres provisioned via the CLI; migration and seed
  commands documented in the README.

## 3. Data model

Provider `postgresql`, Prisma **7.9.1**. Its conventions were checked against the
Prisma 7 upgrade guide rather than assumed, and four of them change this plan:

1. The generator provider is `prisma-client` (not `prisma-client-js`) and **`output`
   is mandatory** — the client is no longer generated into `node_modules`. It goes
   to `prisma/generated/prisma`, is gitignored as build output, and is regenerated
   by a `postinstall` script so `next build` never runs against a stale client.
2. The client is imported from that output path, not from `@prisma/client`.
3. **A driver adapter is required.** PostgreSQL uses `@prisma/adapter-pg`:
   `new PrismaClient({ adapter: new PrismaPg({ connectionString }) })`.
4. Seeding is no longer automatic during `migrate dev`/`migrate reset`; it runs only
   on an explicit `prisma db seed`, configured as `migrations.seed` in
   **`prisma.config.ts`** (not `package.json`).

This supersedes an earlier note in this spec that no `next.config.ts` change would
be needed because `@prisma/client` and `prisma` sit in Next's default
`serverExternalPackages` opt-out list. That list does not cover a client generated
to a custom path, nor `@prisma/adapter-pg`, so `serverExternalPackages` is set
explicitly rather than relied on by default.

### 3.1 Design decisions

**Localized text becomes three scalar columns, not a Json column.**
`nameUz` / `nameRu` / `nameEn`, `descriptionUz` / `descriptionRu` / `descriptionEn`.
Because search and locale-ordered sort now run in SQL, these columns must be
indexable and usable in `ORDER BY`. A Json column would require expression
indexes on `name->>'uz'` and would lose Prisma's type safety. The
`LocalizedText` interface in `lib/types.ts` is unchanged — the repository maps
columns to it, so no component sees the difference.

**`specs` stays Json.** It is never filtered or sorted on, only rendered.

**Existing string IDs are preserved** (`"cat-injector-3126"`, `"injector"`,
`"cat"`) rather than switching to cuid. `lib/data/catalog-menu.ts`, filter query
strings, and existing tests reference them by name; changing them would ripple
through routing and test fixtures for no benefit. Rows created after seeding use
cuid.

**`price` is `Decimal(14,2)`, not Float**, because it is money. Prisma returns a
`Decimal` object, so the repository calls `.toNumber()` when mapping to the
`Product` type — `price: number | null` downstream is unchanged. UZS magnitudes
(e.g. 18 900 000) fit comfortably.

**Stock is numeric in the database and derived for the public API.** `stock` and
`minStock` are the source of truth, which the future director dashboard needs for
low-stock alerts and total inventory value. The public API exposes only a derived
`stockStatus`:

```
stock <= 0            → "out_of_stock"
stock <= minStock     → "limited"
otherwise             → "available"
```

**The derivation is persisted at write time, not evaluated at query time.** A
`stockStatus` enum column is written by every path that changes `stock` or
`minStock`, using one shared pure helper `deriveStockStatus(stock, minStock)`.

The reason is that the alternative — computing it in the `where` clause — requires
comparing `stock` against `minStock`, two columns of the same row. Whether Prisma
supports column-to-column comparison could not be confirmed from its documentation,
and a core catalog filter must not rest on an unconfirmed capability. Persisting the
derived value removes the question entirely, and is also strictly faster: the
availability filter becomes an indexed equality test instead of an arithmetic
predicate that no index can serve.

The cost of denormalization is drift, and it is contained by funnelling every write
through the repository, which recomputes the column rather than accepting it from a
caller. In this sub-project the only writer is the seed script. When the director
panel gains product editing, it uses the same helper.

Two consequences, both wanted: exact inventory counts are never published to
competitors, and every *presentational* consumer of `stockStatus` — `StockBadge`,
the compare table, cart, wishlist, `product-json-ld.tsx`, the availability
`<select>` in `product-filters.tsx` — is untouched, because the field they read
still arrives with the same three values. The two *logic* consumers do change, and
both move to numeric stock: the availability predicate (section 4.1) and
`getBestSellerProducts` (`lib/product-collections.ts`). Staff endpoints in a later
sub-project will read the raw numbers.

**`oemNumber: string` becomes `oemNumbers: string[]`**, per the brief. This is the
one breaking change to `lib/types.ts`, touching three render sites — the product
detail page, `product-json-ld.tsx` (`mpn`), and the compare table row — plus the
search predicate, which now matches any element of the array rather than one
string.

### 3.2 Schema

```prisma
enum Role          { DIRECTOR SELLER }
enum InquiryStatus { NEW IN_PROGRESS WON LOST }
enum InquirySource { PRODUCT_DIALOG QUOTE_FORM CONTACT_FORM }

// Values match the existing StockStatus union in lib/types.ts exactly, so the
// column maps to the domain type with no translation table.
enum StockStatus   { available limited out_of_stock }

model Brand {
  id       String    @id
  slug     String    @unique
  name     String
  logoUrl  String?
  products Product[]
}

model Category {
  id       String     @id
  slug     String     @unique
  nameUz   String
  nameRu   String
  nameEn   String
  parentId String?
  parent   Category?  @relation("CategoryTree", fields: [parentId], references: [id])
  children Category[] @relation("CategoryTree")
  products Product[]
}

model Product {
  id               String    @id
  slug             String    @unique
  sku              String    @unique
  oemNumbers       String[]
  nameUz           String
  nameRu           String
  nameEn           String
  descriptionUz    String
  descriptionRu    String
  descriptionEn    String
  price            Decimal?  @db.Decimal(14, 2)
  currency         String    @default("UZS")
  stock            Int       @default(0)
  minStock         Int       @default(0)
  // Derived from stock/minStock by deriveStockStatus() on every write. Never
  // accepted from a caller — the repository recomputes it. See section 3.1.
  stockStatus      StockStatus
  categoryId       String
  brandId          String
  category         Category  @relation(fields: [categoryId], references: [id])
  brand            Brand     @relation(fields: [brandId], references: [id])
  compatibleModels String[]
  specs            Json      // ProductSpec[]
  imageLabels      String[]  // placeholder gallery; real images are out of scope
  isActive         Boolean   @default(true)
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt
  inquiries        Inquiry[]

  @@index([categoryId])
  @@index([brandId])
  @@index([stockStatus])
  @@index([stock])            // director low-stock reports, later sub-project
  @@index([isActive, createdAt])
}

model User {
  id            String    @id @default(cuid())
  name          String
  email         String    @unique
  phone         String?   @unique
  passwordHash  String
  role          Role
  isActive      Boolean   @default(true)
  discountLimit Int       @default(0)   // percent a SELLER may grant unaided
  createdAt     DateTime  @default(now())
  inquiries     Inquiry[] @relation("AssignedInquiries")
}

model Inquiry {
  id                String        @id @default(cuid())
  customerName      String
  phone             String
  email             String?
  message           String
  productId         String?
  product           Product?      @relation(fields: [productId], references: [id], onDelete: SetNull)
  productSku        String?       // snapshot: the record survives product deletion
  quantity          Int?
  status            InquiryStatus @default(NEW)
  source            InquirySource
  assignedSellerId  String?
  assignedSeller    User?         @relation("AssignedInquiries", fields: [assignedSellerId], references: [id], onDelete: SetNull)
  createdAt         DateTime      @default(now())

  @@index([status, createdAt])
  @@index([assignedSellerId])
}
```

`User` and the `assignedSellerId` relation exist now because the seed must create
the initial DIRECTOR account and because `Inquiry` rows written from today should
be assignable without a later migration. No authentication uses `User` in this
sub-project.

`Category.parentId` is nullable and unused by the seed — the 10 seeded categories
are flat. It exists so the catalog tree can be introduced without a migration.

## 4. Repository layer

`lib/api/product-repository.ts` stays the single read path and becomes async:

| Function | Returns |
|---|---|
| `queryProducts(query)` | `Promise<Page<Product>>` |
| `getProductBySlug(slug)` | `Promise<Product \| null>` |
| `getProductsByIds(ids, lang)` | `Promise<ResolvedProduct[]>` |
| `listBrands()` | `Promise<Brand[]>` |
| `listCategories()` | `Promise<Category[]>` |
| `getProductsForHomeRows(count)` | `Promise<{ popular: Product[]; newest: Product[]; bestSellers: Product[] }>` |
| `listProductSlugs()` | `Promise<string[]>` |

`getProductsForHomeRows` takes an explicit count and applies it as a SQL `take`.
It must not load the whole table — that would reintroduce exactly the problem the
SQL-native approach was chosen to avoid. The three home rows need distinct slices,
so it returns all three from one call, issuing one bounded query per row shape
(head of catalog order, newest first, in-stock first) rather than one unbounded
query sliced in JavaScript.

`listProductSlugs` exists for `app/sitemap.ts`, which legitimately wants every
active product and only its slug. Paging through `queryProducts` to build a sitemap
would map full rows for no reason.

A single Prisma client instance lives in `lib/db.ts`, guarded against
hot-reload duplication in development by a `globalThis` cache.

### 4.1 Keeping test coverage through the SQL move

`filterProducts`, `sortProducts`, and `paginate` are called **only** from
`product-repository.ts` — never client-side. Moving their work into SQL would
therefore make them dead code and delete their regression coverage along with them.

To avoid that, a pure function sits in between:

```ts
buildProductWhere(query: ProductQuery): {
  where: Prisma.ProductWhereInput
  orderBy: Prisma.ProductOrderByWithRelationInput
}
```

It takes the same `ProductQuery` the old functions took and returns a plain object,
so every existing behavioural case — search matching name/sku/OEM, locale-aware
name sort, availability filtering, `categoryIds` scoping — is asserted against the
returned `where`/`orderBy` with no database involved. The tests transpose rather
than evaporate.

`total` comes from `prisma.product.count()` with the same `where`. Page clamping
(currently in `paginate`) moves to a small `buildPage` helper that keeps the
existing `Page<T>` shape and the "clamp the page number to what exists" behaviour.

Availability filtering becomes an indexed equality test on the persisted
`stockStatus` column — `{ stockStatus: "available" }` — for the reason given in
section 3.1. `all` omits the clause entirely.

### 4.2 What happens to the modules being displaced

Neither file is deleted outright; each keeps what is still referenced elsewhere.

- **`lib/filters.ts`** loses `filterProducts` and `sortProducts` (their behaviour
  moves into `buildProductWhere`) but **keeps the `SortKey` and
  `AvailabilityFilter` type exports**, which `lib/api/product-query.ts` and
  `components/product/product-filters.tsx` both depend on. Removing the types would
  break the filter UI for no reason.
- **`lib/product-lookup.ts`** loses the module-level `Map`s and the synchronous
  `resolveProduct` / `resolveProducts` (section 5) but **keeps the
  `ResolvedProduct` interface**, which is the return shape of
  `getProductsByIds` and is consumed by the cart, wishlist, compare, and
  quote-form components.
- **`lib/product-collections.ts`** keeps its documented role as the home-row
  selector. `getBestSellerProducts` switches from `stockStatus` to numeric stock.
- **`lib/data/products.ts`, `categories.ts`, `brands.ts`** stop being imported by
  application code and become seed input only. They move to `prisma/seed-data/`.
  `lib/data/blog.ts`, `catalog-menu.ts`, and `regions.ts` stay put — blog posts and
  navigation config are not part of this sub-project.

  A file move alone does not prevent re-import; it only makes it less likely, and
  nothing would flag a new import from the new path. The guarantee is therefore
  enforced in `eslint.config.mjs` with a `no-restricted-imports` rule banning
  `prisma/seed-data/*` from `app/**`, `components/**`, and `lib/**`, with an
  override permitting it in `prisma/**` and in `*.test.ts`. The rule message names
  the repository as the correct alternative, so the failure teaches the fix.

  Six test files legitimately use the mock arrays as fixtures and keep doing so via
  the override: `app/sitemap.test.ts`, `lib/cart-summary.test.ts`,
  `lib/filters.test.ts`, `lib/product-collections.test.ts`,
  `lib/product-lookup.test.ts`, and `lib/catalog-menu.test.ts`. Their imports are
  repointed at the new path. `lib/catalog-menu.test.ts` is the one to watch: it
  cross-checks catalog-menu category ids against the category list, so it must be
  updated in step with the seed data, not just its import path. `lib/data/data.test.ts`
  moves alongside the data it validates.

## 5. Client components — the real work

Four client components resolve localStorage-held product IDs synchronously against
module-level `Map`s: `cart-client.tsx`, `wishlist-client.tsx`, `compare-client.tsx`,
and `quote-form-with-cart.tsx`. That cannot survive the move to a database, because
the browser has no Prisma client and the call cannot be synchronous.

**Fix:** a new public endpoint `GET /api/products/by-ids?ids=a,b,c` plus a
`useResolvedProducts(ids, lang)` hook built on React Query, which is already
installed and already wired up (`components/providers/query-provider.tsx`). The
synchronous `resolveProduct`/`resolveProducts` exports are removed.

The endpoint caps the number of IDs per request (60, matching `MAX_PAGE_SIZE`) and
silently drops unknown IDs, preserving the current documented behaviour: "the
wishlist and cart live in localStorage and can outlive a catalog change."

Side benefit, and something the brief explicitly asked for: these four screens gain
genuine loading states instead of rendering instantly from a static array.

`product-catalog-client.tsx` imports `categories` and `brands` for its filter UI.
It receives them as props from the server page instead — no endpoint needed, since
that page already loads them.

Server components need only `await`: `brand-grid.tsx`, `category-grid.tsx`,
`product-row.tsx`, `related-products.tsx`, `app/sitemap.ts`, `app/[lang]/page.tsx`,
and the `products/[slug]`, `categories/[slug]`, `brands/[slug]` pages.

`lib/data/catalog-menu.ts` stays a static module. It is navigation configuration
keyed to icon components, not catalog data, and nothing in it belongs in a table.

## 6. Route handlers and caching

Existing routes keep their paths and response shapes; only their internals change
to call the repository.

- `GET /api/products`, `GET /api/products/[slug]` — unchanged contracts.
- `GET /api/products/by-ids` — new, section 5.
- `POST /api/inquiry` — writes `Inquiry` with `source: PRODUCT_DIALOG`.
- `POST /api/quote-request` — writes `Inquiry` with `source: QUOTE_FORM`;
  cart contents are serialized into `message` alongside the customer's own text,
  since `OrderItem` is out of scope. This closes the `TODO(Xusan)` at
  `app/api/quote-request/route.ts`.

Both POST handlers keep their current Zod validation and their existing
malformed-JSON handling, and keep returning `{ success: true }` so no form
component changes.

Catalog pages are cached with `revalidate`. Inquiry writes do not invalidate
catalog caches — they touch no catalog data.

## 7. Railway, migrations, seed

The Railway CLI is installed (5.30.1) and authenticated as Xusan. No project is
linked yet. Docker and `psql` are absent from the machine, so Railway Postgres is
also the development database; `railway run` injects `DATABASE_URL` into local
commands.

Steps, to be scripted and documented in the README:

1. `railway init` — create the project.
2. Add the Postgres plugin.
3. `railway variables` to read `DATABASE_URL`; write it to `.env.local`
   (gitignored) for Prisma CLI use.
4. `prisma migrate dev` for the initial migration.
5. `prisma db seed` for reference data.

`.env.example` gains `DATABASE_URL` and `SEED_DIRECTOR_PASSWORD` alongside the
existing auth variables.

The seed is idempotent (`upsert` by id) so it can be re-run safely. It creates the
10 categories, 7 brands, 15 products, and one DIRECTOR user whose password comes
from `SEED_DIRECTOR_PASSWORD` — never a hardcoded literal, and the script fails
loudly if the variable is missing.

Seeded stock numbers are derived from the current `stockStatus` values so the site
looks identical after migration: `available` → 25, `limited` → 3, `out_of_stock`
→ 0, with `minStock` 5.

**Prices remain placeholders, and this must be impossible to miss.**
`lib/data/products.ts` already says so in a `TODO(Xusan)`, but a buried comment is
not enough once the numbers are sitting in a real database and look authoritative.
Three places carry the warning:

1. A header comment at the top of `prisma/seed-data/products.ts`.
2. A header comment at the top of the seed script, plus a line the seed **prints to
   stdout on every run**: a explicit warning that the seeded prices are placeholders
   in UZS and must be replaced before the catalog is shown to customers. A warning
   that appears each time the command is run cannot be scrolled past once and
   forgotten.
3. A short, clearly marked warning block in the README's database section — not a
   footnote at the bottom.

Three products keep `price: null` to exercise the "price not set" path.

## 8. Testing and verification

- `buildProductWhere` — pure unit tests, ported from the existing
  `lib/filters.test.ts` and `product-query.test.ts` cases.
- `deriveStockStatus` — unit tests at each boundary (0, `minStock`,
  `minStock + 1`).
- `buildPage` — page clamping, retained from `paginate`'s tests.
- Repository mapping — `Decimal` → `number`, three columns → `LocalizedText`,
  `stock` → `stockStatus`, and the assertion that no public payload contains
  `stock` or `minStock`.
- Route handler tests (`app/api/inquiry/route.test.ts`,
  `app/api/quote-request/route.test.ts`) updated with a mocked Prisma client;
  their existing validation and malformed-JSON cases are kept.
- Seed idempotency — running it twice produces the same row counts.

Gate at the end of each step: `tsc --noEmit`, `eslint`, `vitest run`, `next build`.

## 9. Out of scope

Deliberately excluded, each to be specified separately:

- `Order`, `OrderItem`, `Customer`, `DiscountRequest`, `Notification`, `AuditLog`.
- Staff authentication, `Session.role`, RBAC, `proxy.ts` changes, `/admin/**`.
- Director and seller dashboards; analytics queries; seller leaderboard.
- Excel/CSV import and export.
- The UI/UX redesign.
- Real product image upload. `imageLabels` stays a placeholder gallery; no file
  storage is provisioned.
- Deploying the Next.js app itself to Railway. This spec provisions a database and
  runs migrations against it; it does not put the site on a public domain.

## 10. Carried-forward obligations

### 10.1 The three deferred auth limitations

Accepted during the phase-4 auth work (2026-08-16) on the explicit condition of
being raised again before the first production deploy to a real domain. Written out
in full here rather than left as a pointer, because the deploy step is exactly when
a pointer gets skipped.

1. **The OTP store is in-memory.** `lib/auth/otp-store.ts` holds pending login codes
   in a module-level `Map`. Every pending code is lost on restart, and on any
   multi-instance or serverless host a user can receive a code from one instance and
   have it verified by another, which fails. Railway makes this acute rather than
   theoretical: restarts on redeploy are routine and replicas are a configuration
   toggle. The originally planned fix was Redis; now that Postgres is in the stack,
   a table with a hashed code and an expiry column is simpler and needs no new
   service. Either way the exported function signatures can stay identical, so this
   is a contained change.

2. **There is no user database behind the customer session.** The session JWT
   carries only a phone number. There is no `users` table for customers, so the
   account page's order history is a permanent empty state and nothing links a
   returning customer to their earlier inquiries. Note that the `User` table added
   in this spec is for **staff** (DIRECTOR / SELLER), not customers — it does not
   close this gap.

3. **`AUTH_SECRET` must be set in the production environment**, at least 32
   characters. `lib/auth/session-token.ts` deliberately throws when it is missing in
   production rather than silently falling back to the development secret, so a
   deploy without it fails at runtime rather than shipping forgeable sessions.
   `ESKIZ_EMAIL` and `ESKIZ_PASSWORD` are additionally required for real SMS
   delivery; without them the login code is printed to the server console, which is
   correct for development and unacceptable in production.

Still open alongside these: the contact phone numbers in `lib/site-config.ts` are
deliberately fake placeholders and must be replaced with real numbers before launch.

Provisioning Postgres and running migrations, as this spec does, is **not** that
production deploy. The reminder remains owed.
- Introducing Postgres opens a simpler fix for the first of those than the Redis
  move originally planned: the OTP store can become a table with an expiry column.
  The exported function signatures in `lib/auth/otp-store.ts` can stay identical.
  This belongs to the roles sub-project.
- The placeholder contact phone numbers in `lib/site-config.ts` remain
  intentionally fake and are untouched here.
