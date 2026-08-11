# DieselParts Marketing Website — Design Spec (Phase 1)

Date: 2026-08-11
Status: Approved

## 1. Scope

Build the public marketing website described in the project TZ (`AGENTS.md` root spec), Phase 1 only:

- All pages: Home, Product Catalog, Product Detail, Categories, Brands, About, Blog (list + detail), Contact, Request Quote.
- Full `uz` / `ru` / `en` locale routing.
- No backend/DB/auth. Product/category/brand/blog data is local, typed mock data shaped to match the future Prisma schema (see root TZ §5) so it can be swapped for real API calls later without restructuring components.
- Request Quote / Send Inquiry forms submit to local Next.js Route Handlers that validate and log the payload, then return success — no persistence.

Out of scope for this iteration: ERP admin app, real backend/DB, auth, monorepo restructuring, real product data/images, ru/en translation review (placeholder-quality copy is acceptable to refine later).

## 2. Tech decisions

- **Framework**: Next.js 16 App Router (existing repo), TypeScript, React 19.
- **Styling**: Tailwind v4 + shadcn/ui primitives, restyled to the TZ's dark Industrial Premium tokens.
- **Forms**: React Hook Form + Zod.
- **i18n — deviation from the root TZ**: the TZ names `next-intl`; this spec uses Next.js 16's **native** `app/[lang]` + JSON dictionary pattern instead (documented under `node_modules/next/dist/docs/01-app/02-guides/internationalization.md`). Reasoning: zero third-party dependency risk against a brand-new Next major version, and the marketing copy here doesn't need ICU/pluralization complexity. If real ICU-grade i18n is needed later (e.g. for the ERP admin), `next-intl` can still be introduced then.
- **Routing/redirect file**: `proxy.ts` (not `middleware.ts` — deprecated and renamed in Next.js 16, same behavior).
- Route params (`params`, `searchParams`) are async (`Promise`) per Next.js 16 conventions — every page/layout reading `params` must `await` it.

## 3. Routing structure

```
app/
  proxy.ts                          — locale detection/redirect (bare path → /{lang}/path)
  [lang]/
    layout.tsx                      — root layout, <html lang>, Header, Footer
    page.tsx                        — Home
    products/
      page.tsx                     — Catalog (search, filters, sort, grid/list)
      [slug]/page.tsx               — Product Detail
    categories/[slug]/page.tsx
    brands/[slug]/page.tsx
    about/page.tsx
    blog/
      page.tsx
      [slug]/page.tsx
    contact/page.tsx
    request-quote/page.tsx
  api/
    quote-request/route.ts          — validates + logs, returns { ok: true }
    inquiry/route.ts                — same, for product "Send Inquiry"
  sitemap.ts
  robots.ts

dictionaries/
  uz.json, ru.json, en.json

lib/
  data/
    products.ts, categories.ts, brands.ts, blog.ts   — typed mock datasets
  types.ts                          — Product, Category, Brand, BlogPost, StockStatus, etc.

components/
  layout/Header.tsx, Footer.tsx, MobileNav.tsx
  marketing/Hero.tsx, CategoryCard.tsx, BrandLogo.tsx, ProductCard.tsx, TestimonialSection.tsx (if used), CtaBanner.tsx
  product/ProductGallery.tsx, ProductFilters.tsx, CompatibleModelsList.tsx, SpecsTable.tsx
  forms/QuoteForm.tsx, InquiryForm.tsx
  ui/  — shadcn/ui components restyled to project tokens
```

Default locale `uz`; supported locales `uz`, `ru`, `en`. Every route is always locale-prefixed (`/uz`, `/ru`, `/en` — no un-prefixed public route), matching the route list in the root TZ §3.

## 4. Design system

Tailwind v4 theme tokens, taken directly from the root TZ §8:

| Token | Value |
|---|---|
| `--background` | `#0D0E11` |
| `--accent` | `#F77D2A` |
| `--text-primary` | `#F5F5F5` |
| `--text-muted` | `#9CA3AF` |
| `--border` | `#1F2126` |

Base components come from shadcn/ui (Button, Card, Input, Select, Sheet, Dialog, Tabs) restyled to these tokens rather than defaults.

### 4.1 Navigation — Tesla-style header

Distinct spec for `Header.tsx` / `MobileNav.tsx`, per explicit direction:

- **Palette constraint**: the nav itself uses only black, white, and the accent orange (`#F77D2A`) — no grays/borders from the wider token set bleed into it.
- **Transparent → solid on scroll**: on page load (scroll position 0, only meaningful over a hero), the header background is transparent with white text/logo. Past a scroll threshold (e.g. 40–80px), it transitions (animated, ~200ms) to a solid black background.
- **Hide-on-scroll-down / reveal-on-scroll-up**: scrolling down past the threshold hides the header (translateY off-screen); scrolling up reveals it immediately, regardless of scroll position. Implemented as a small client component tracking scroll direction + position.
- **Mobile**: hamburger toggle opens a fullscreen black overlay menu (covers full viewport, not a side drawer) with nav links, locale switcher, and the primary CTA, in large type; closes on link click or explicit close tap.
- Desktop nav stays minimal: logo, a handful of top-level links (Products, Categories/Brands, About, Blog, Contact), locale switcher, one primary CTA button ("Request Quote"), accent-colored.

## 5. Pages summary

- **Home**: Hero (styled gradient/panel placeholder, no video file), trust badges, About teaser, category card grid, brand logo grid (linked), featured products, CTA banner. Content per root TZ §3.
- **Catalog** (`/products`): search (name/SKU/OEM), filters (brand, category, price range, availability), sort, grid/list toggle, pagination — all client-side over the mock dataset.
- **Product Detail**: image gallery (placeholder panels), SKU/OEM/brand/compatible models, stock status badge (`available` / `limited` / `out_of_stock` — no exact quantity), "Request Price" CTA (no auth yet, so always shown), Send Inquiry form (opens dialog, posts to `/api/inquiry`), related products, specs table if present.
- **Categories/Brands detail**: filtered product listing reusing the catalog grid.
- **About, Contact, Blog (list/detail)**: static/content pages per root TZ, using the written uz/ru/en copy.
- **Request Quote** (`/request-quote`): full form (name, company, phone, email, country, products free-text/multi-select, quantity, message) → `/api/quote-request`, success confirmation state.

## 6. Mock data

Hand-written, modest in size (not exhaustive):
- 7 brands from root TZ §3 (CAT, Komatsu, Volvo, Hitachi, JCB, Hyundai, Doosan).
- ~10 categories from root TZ §3 (Engine Parts, Turbocharger, Injector, Piston, Cylinder, Hydraulic System, Hydraulic Pump, Valve, Seal Kit, Transmission, Gearbox, Converter, Undercarriage, Track Chain, Roller, Sprocket — pick a representative ~10).
- ~12–15 products spread across brands/categories, each with: id, slug, name, sku, oemNumber, categoryId, brandId, images (placeholder refs), compatibleModels (string list), stockStatus, description, specs (key/value list, optional).
- 2–3 blog posts with title/slug/excerpt/body/date per locale.

Data lives in `lib/data/*.ts` typed against `lib/types.ts`, structured so a future swap to real API calls (Phase 2+) only touches the data-fetching layer, not components.

## 7. Forms & stub API

- Zod schemas define both client validation and the Route Handler's server-side validation (shared schema file).
- `QuoteForm` and `InquiryForm` use React Hook Form; on submit, POST JSON to the relevant route.
- Route Handlers (`api/quote-request`, `api/inquiry`) validate with the shared Zod schema, `console.log` the payload (clearly marked as a stub awaiting real CRM/lead integration), and return `{ ok: true }` or a 400 with field errors.
- UI shows an inline success confirmation (not a redirect) on `{ ok: true }`.

## 8. SEO

- `generateMetadata` per page (title, description, OpenGraph) using dictionary content.
- JSON-LD `Product` schema on product detail pages.
- `sitemap.ts` and `robots.ts` route conventions, covering all locales × all static/mock slugs.
- Static generation via `generateStaticParams` for known locales and mock slugs (products, categories, brands, blog posts).

## 9. Explicit deviations from the root TZ (and why)

1. **i18n library**: native Next.js dictionary pattern instead of `next-intl` — avoids third-party/Next-16 compatibility risk; revisit if ICU features are needed later.
2. **No monorepo yet**: single Next.js app, not the `apps/marketing` + `apps/admin` structure — premature until the ERP admin app (Phase 2+) actually exists.
3. **No auth-gated pricing**: since there's no backend/auth in this phase, all products show "Request Price" rather than the TZ's logged-in-wholesale-sees-price behavior — revisit once auth exists.
4. **`proxy.ts` not `middleware.ts`**: Next.js 16 renamed the convention; behavior is identical.

## 10. Testing

- Type-checking (`tsc`) and lint (`next lint`) must pass.
- Manual verification via dev server: navigate all page types in all 3 locales, submit both forms (success + validation-error paths), verify header scroll behavior (transparent→solid, hide/reveal) and mobile fullscreen overlay.
