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
successfully applied. The migration *history* and the *actual database* had
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
formally author a migration that drops it again *after* confirming the
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

| App | `DATABASE_URL` (local) | Database |
|---|---|---|
| Root (Next.js, `.env.local`) | `postgresql://postgres:postgres@localhost:5432/diesel_parts_web_dev?schema=public` | `diesel_parts_web_dev` |
| `backend/` (NestJS, `backend/.env`) | `postgresql://postgres:postgres@localhost:5432/diesel_parts_erp?schema=public` | `diesel_parts_erp` |

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

- Fixed in this pass: `main.ts` used `app.enableCors({ origin: true, credentials: true })`, which reflects *any* request's `Origin` header back as allowed — with `credentials: true` that's a real CORS misconfiguration (any site can make credentialed requests). Replaced with an explicit allowlist read from `CORS_ORIGINS` (see table above), defaulting to `localhost:3000` only when unset.

## Open items (not fixed in this pass — flagging for a decision)

1. ~~**Dev and production may be sharing one Postgres.**~~ **RESOLVED
   2026-08-23** — confirmed `.env.local`'s `DATABASE_URL` *was* byte-for-byte
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
   *both* apps at once, not just one).
   A full plan for merging these already exists:
   `docs/superpowers/plans/2026-08-23-backend-consolidation.md`. This is a
   big, separate piece of work — plan and execute it on its own, not as a
   follow-on to this incident response. Until it lands, don't over-invest in
   root-app migration tooling (item 2 above) for the root schema specifically.
