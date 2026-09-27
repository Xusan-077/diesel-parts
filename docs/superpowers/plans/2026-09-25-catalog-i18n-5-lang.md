# Catalog 5-Language Translation (Product/Category/Brand + Gemini AI) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend Product/Category/Brand to 5 languages (uz, oz, ru, en, zh), add a backend Gemini AI service that spell-checks a director's source-language input and translates it to the other 4, rework the admin write forms to single-source-language entry, and move slug/id generation fully server-side with race-safe uniqueness.

**Architecture:** Continue the existing "one column per locale" storage pattern (no JSON, no new translation table) — add `Oz`/`Zh` columns beside the existing `Uz`/`Ru`/`En` ones. A new `AiModule` wraps Gemini's REST API (raw `fetch`, no SDK — matches the deleted `backend/src/ai` module's approach) behind one endpoint, `POST /ai/products/translate`, validated with Zod. `ProductsService.create()` (and the new `CategoriesService`/`BrandsService` create paths) call it synchronously when the caller hasn't already supplied full translations, then derive the slug from the *translated* English/Uzbek name via a new shared, race-safe slug utility. The frontend admin forms collapse from "fill 3 languages" to "fill 1 language, click AI, review 4 tabs."

**Tech Stack:** NestJS + Prisma (backend), Next.js + Zod + React Query (frontend), Gemini `gemini-flash-latest` via raw REST (`generateContent`, `responseMimeType: application/json` + `responseSchema`), `zod` (new backend dependency).

**Spec:** The task description pasted by the user at the start of this conversation (Uzbek-language spec, 18 numbered requirements plus header/data-model/slug/AI-service/form-UX/backfill sections). No separate file — reproduced/interpreted inline in each task below.

## Global Constraints

- Migration must be additive-only: every new column nullable or defaulted; existing `uz`/`ru`/`en` data untouched (spec §3).
- `Product.id === Product.slug` (and same for `Category`/`Brand`) is D1 (`docs/deploy-checklist.md`) — never becomes a `@default`, always explicit on create.
- Slug is always lowercase ASCII `[a-z0-9]` + `-`; never Cyrillic or Chinese, regardless of source locale (spec §4).
- Slug/id never changes on update, for any of Product/Category/Brand (spec §6, extended to Category/Brand for consistency — see Task 4's rationale note).
- AI failure must never block a create/update — the row always saves in the source locale with `translationStatus: FAILED` (spec §15).
- OEM/part numbers, brand/model names, numbers, and units are never altered by translation (spec §9); a translation that drops a number from the source text is rejected and marked `FAILED` (spec §9 last bullet).
- Deploy order: migration → backend → frontend → backfill script (matches existing convention in `docs/deploy-checklist.md`'s STATUS section).
- New backend dependency: `zod` (not currently in `backend/package.json`; frontend already has it). No Gemini SDK — raw `fetch`, matching the deleted module.

## Review Focus

- **AI returns a translation with a missing/garbled OEM number embedded in a name/description** (e.g. "10R-7225" becomes "10R7225" in `ru`) — must be caught by the post-response digit-token verification and flagged `FAILED`, not silently saved. Owned by Task 3.
- **Two directors create products with the same source name at the same moment** — slug uniqueness must survive a real race, not just a pre-check. Owned by Task 2 (insert-then-retry-on-conflict, not check-then-insert).
- **Gemini times out or returns 5xx** — create must still succeed (source locale only, `FAILED` status), not 500 the whole request. Owned by Task 3 (service-level try/catch) and Task 4 (`ProductsService.create` never rethrows AI errors).
- **Director edits an already-translated product and only touches the `ru` tab** — saving must not silently re-run AI and overwrite their `en`/`zh`/`oz` edits. Owned by Task 4/8 (`update()` never auto-translates; only the explicit "Qayta tarjima qilish" action does, with a confirmation warning).
- **Existing product/category rows have `oz`/`zh` NULL after migration** — every read path that selects `nameOz`/`nameZh` must tolerate `null` without crashing (frontend types, CSV export, sitemap). Owned by Task 1 (nullable columns) and Task 6 (frontend types default to `string | null`).

---

## Decisions made while researching (flagged per CLAUDE.md autonomous-mode rule — proceeding, not blocking)

1. **Storefront language switching is out of scope.** The spec's 18 numbered requirements are entirely about data model, AI service, slug generation, and the *admin* write forms. Nothing asks for a public locale switcher, `[locale]` routing, or hreflang tags on storefront pages — confirmed there is no `next-intl`/`middleware.ts`/`[locale]` segment today (`frontend/lib/seo.ts` even has a comment noting "the locale left the URL when it moved"). This plan stores `oz`/`zh` data and makes it readable via the API, but every existing storefront/admin-listing read path keeps reading `nameUz` exactly as it does today. Wiring a public 5-language switcher is a separate, much larger project.
2. **Brand gains full per-locale columns** (`nameUz/Oz/Ru/En/Zh`), even though spec §9 says brand/model *mentions inside other text* must never be translated. Those are different things: a real catalog *does* render "Cummins" as "Камминз"/"康明斯" in ru/zh while never altering "Cummins" when it appears inside a product description. The AI prompt (Task 3) instructs phonetic transliteration for brand-name fields specifically, not free translation. The existing single `Brand.name` column is kept (nothing else in the codebase can be trusted to have migrated off it in one pass) and is written as a mirror of `nameUz` on every create/update, with a comment marking it legacy.
3. **No admin UI for Brand exists at all today** (confirmed: no `brand-form`/`brand-manager` component, no `useCreateBrand` hook — brands are presumably seeded). Spec §17 requires "the same flow" for Brand forms, which requires a form to exist first. Task 10 builds a minimal one, mirroring `category-manager.tsx`.
4. **Product spec-table labels (`specs[].label.{uz,ru,en}`) are left untouched** (still 3-language, still required). The spec's multilingual-field list (§1: "name, description, qisqa tavsif va SEO meta") does not mention them, and neither short-description nor SEO-meta fields exist anywhere in the schema today, so those two are simply not part of this migration — nothing to add.
5. **Slug/id immutability-on-update is extended from Product (spec §6) to Category and Brand too.** Today `CategoriesService.update()` actually *does* let the slug change (via `assertSlugFree`) — an existing footgun, since `Category.id = slug` and the storefront URL depends on it. Fixing it now is in-scope because Task 2's slug utility replaces both services' slug handling anyway.

## File Structure

**Backend — new files:**
- `backend/prisma/migrations/20260925120000_catalog_i18n_translations/migration.sql` — additive columns + 2 new enums.
- `backend/src/common/slug.ts` — `toAsciiSlug()`, Cyrillic transliteration (ported + extended from `frontend/lib/catalog-tree.ts`'s table), `createWithUniqueSlug()` (race-safe insert-and-retry helper, generic over any Prisma delegate with an `id`/`slug` pair).
- `backend/src/ai/ai.module.ts`
- `backend/src/ai/ai.service.ts` — `AiTranslationService.translate()`.
- `backend/src/ai/gemini-client.ts` — timeout + retry `fetch` wrapper.
- `backend/src/ai/translation-schema.ts` — Zod schema + `Locale`/`TranslationResult` types, the Gemini `responseSchema`, and the OEM/number-preservation verifier.
- `backend/src/ai/ai.controller.ts` — `POST /ai/products/translate`.
- `backend/src/ai/dto/translate-request.dto.ts`
- `backend/src/ai/ai-rate-limit.ts` — in-memory fixed-window limiter, ported from `backend/src/auth/login-throttle.ts`.
- `backend/scripts/backfill-translations.ts`

**Backend — modified files:**
- `backend/prisma/schema.prisma` (Product/Category/Brand + 2 new enums).
- `backend/src/products/products.service.ts`, `dto/create-product.dto.ts`, `dto/update-product.dto.ts`, `products.controller.ts` (new `POST /products/:id/retranslate`).
- `backend/src/categories/categories.service.ts`, `dto/create-category.dto.ts`, `dto/update-category.dto.ts`, `categories.controller.ts`.
- `backend/src/brands/brands.service.ts`, `dto/create-brand.dto.ts`, `dto/update-brand.dto.ts`, `brands.controller.ts`.
- `backend/src/app.module.ts` (register `AiModule`).
- `backend/.env.example` (`GEMINI_API_KEY`, `GEMINI_MODEL`).
- `backend/package.json` (`zod` dependency).

**Frontend — new files:**
- `frontend/lib/api/ai-translate-repository.ts` — calls the new backend endpoint.
- `frontend/hooks/admin/use-ai-translate.ts`
- `frontend/components/admin/ai-translate-button.tsx` — shared button + corrections list + loading state, used by product/category/brand forms.
- `frontend/components/admin/brand-manager.tsx` — new, mirrors `category-manager.tsx`.
- `frontend/app/director/(panel)/brands/page.tsx` — new admin route.
- `frontend/hooks/admin/use-admin-brands.ts`

**Frontend — modified files:**
- `frontend/lib/schemas.ts` (`productWriteSchema`, `categoryWriteSchema`, new `brandWriteSchema` — all reworked for single-source-locale entry).
- `frontend/components/admin/product-form-modal.tsx` (source-locale selector, 5-tab name/description, remove slug input, wire AI button + retranslate).
- `frontend/components/admin/category-manager.tsx` (same rework, 5 tabs instead of 3).
- `frontend/lib/api/product-write-repository.ts`, `frontend/lib/api/catalog-repository.ts` (or wherever category writes live), `frontend/lib/catalog-tree.ts` (`slugify` becomes preview-only, comment updated).
- `frontend/components/admin/panel-sidebar.tsx` (add Brands nav entry).

---

## Task 1: Prisma schema + migration

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/20260925120000_catalog_i18n_translations/migration.sql`
- Test: `backend/src/products/products.service.spec.ts` (extend fixtures with new nullable fields so existing tests still typecheck)

**Interfaces:**
- Produces: Prisma enums `Locale { UZ OZ RU EN ZH }`, `TranslationStatus { PENDING COMPLETE FAILED }`; `Product.sourceLocale Locale @default(UZ)`, `Product.translationStatus TranslationStatus @default(PENDING)`, `Product.nameOz/nameZh/descriptionOz/descriptionZh String?`; same `sourceLocale`/`translationStatus`/`nameOz`/`nameZh` on `Category`; `Brand.nameUz/nameRu/nameEn/nameOz/nameZh String?` (nullable — see step 3) plus `sourceLocale`/`translationStatus`.

- [ ] **Step 1: Edit schema.prisma**

Add near the top (with the other enums):
```prisma
enum Locale {
  UZ
  OZ
  RU
  EN
  ZH
}

enum TranslationStatus {
  PENDING
  COMPLETE
  FAILED
}
```

On `Product` (after `descriptionEn`):
```prisma
  descriptionOz     String?
  descriptionZh     String?
  sourceLocale      Locale             @default(UZ)
  translationStatus TranslationStatus  @default(PENDING)
```
and after `nameEn`:
```prisma
  nameOz            String?
  nameZh            String?
```

On `Category` (after `nameEn`):
```prisma
  nameOz            String?
  nameZh            String?
  sourceLocale      Locale             @default(UZ)
  translationStatus TranslationStatus  @default(PENDING)
```

On `Brand` (replace the single `name` line's block):
```prisma
model Brand {
  id                String             @id
  slug              String             @unique
  /// Legacy — mirrors nameUz on every write. Kept because existing reads
  /// (orderBy, admin listing, product-write mapping) all use it; not worth a
  /// coordinated multi-file rename in the same migration that adds the
  /// per-locale columns. New code should read nameUz instead.
  name              String
  nameUz            String?
  nameRu            String?
  nameEn            String?
  nameOz            String?
  nameZh            String?
  sourceLocale      Locale             @default(UZ)
  translationStatus TranslationStatus  @default(PENDING)
  logoUrl           String?
  products          Product[]
}
```
`nameUz/Ru/En` are nullable here (unlike Product/Category) because existing Brand rows have no per-locale data at all yet — the backfill script (Task 11) is what populates them from `name`, not the migration's `ALTER TABLE ... SET DEFAULT`.

- [ ] **Step 2: Generate the migration**

Run: `cd backend && npx prisma migrate dev --name catalog_i18n_translations --create-only`
This produces the migration directory; do not let it auto-apply yet (`--create-only`) so step 3 can hand-edit the SQL for the Brand backfill.

- [ ] **Step 3: Hand-edit the generated SQL to backfill Brand.nameUz**

After the generated `ALTER TABLE "Brand" ADD COLUMN ...` statements, append:
```sql
UPDATE "Brand" SET "nameUz" = "name", "nameRu" = "name", "nameEn" = "name" WHERE "nameUz" IS NULL;
```
This is not a "real" translation (no Gemini call inside a migration) — it just seeds every locale with the existing Latin name so nothing reads `null` immediately after deploy; the backfill script (Task 11) later replaces `nameRu`/`nameEn`/`nameOz`/`nameZh` with actual transliterations where they'd differ, and sets `nameUz` for real if the source name wasn't already Uzbek-appropriate. (Brand names are usually the same across locales anyway per the Decisions section above.)

- [ ] **Step 4: Apply and regenerate the client**

Run: `cd backend && npx prisma migrate dev` (applies the now-edited migration against local dev DB), then `npx prisma generate`.

- [ ] **Step 5: tsc check**

Run: `cd backend && npx tsc --noEmit`
Expected: new errors only where later tasks will touch code (e.g. `products.service.ts` referencing `dto.slug`) — no errors from the schema/migration change itself. Note the error list for Tasks 4/5 rather than fixing here.

- [ ] **Step 6: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations
git commit -m "feat(db): add 5-language columns and translation status to Product/Category/Brand"
```

---

## Task 2: Shared slug utility

**Files:**
- Create: `backend/src/common/slug.ts`
- Test: `backend/src/common/slug.spec.ts`

**Interfaces:**
- Consumes: nothing outside this file (pure functions) except a Prisma delegate passed in by the caller for `createWithUniqueSlug`.
- Produces:
  - `toAsciiSlug(text: string): string`
  - `transliterateCyrillicToLatin(text: string): string` (exported separately — Task 3's AI-unavailable fallback needs it directly, before slugging)
  - `createWithUniqueSlug<T>(opts: { candidates: () => Generator<string>; attempt: (slug: string) => Promise<T>; maxAttempts?: number }): Promise<T>` — a generic "try insert, on unique-constraint conflict try the next candidate" runner.
  - `slugCandidates(base: string, disambiguators: string[]): Generator<string>` — yields `base`, then `${base}-${disambiguators[0]}`, `${base}-${disambiguators[1]}`, ..., then `${base}-2`, `${base}-3`, ... forever.

- [ ] **Step 1: Write the failing tests**

```typescript
// backend/src/common/slug.spec.ts
import { toAsciiSlug, transliterateCyrillicToLatin, slugCandidates, createWithUniqueSlug } from './slug';

describe('toAsciiSlug', () => {
  it('lowercases and hyphenates a Latin Uzbek name', () => {
    expect(toAsciiSlug("Yoqilg'i filtri Weichai WD615")).toBe('yoqilgi-filtri-weichai-wd615');
  });
  it('never leaves apostrophes, punctuation, or extra hyphens', () => {
    expect(toAsciiSlug('  --Caterpillar 3126!! ')).toBe('caterpillar-3126');
  });
});

describe('transliterateCyrillicToLatin', () => {
  it('handles the four Uzbek-specific Cyrillic letters', () => {
    expect(transliterateCyrillicToLatin('Ўзбек қияси ғилдирак ҳароратда')).toBe(
      "o'zbek qiyasi g'ildirak haroratda",
    );
  });
  it('composes with toAsciiSlug for a full Cyrillic source', () => {
    expect(toAsciiSlug(transliterateCyrillicToLatin('Топливный фильтр'))).toBe('toplivnyy-filtr');
  });
});

describe('slugCandidates', () => {
  it('yields the base first, then disambiguators, then numeric suffixes', () => {
    const gen = slugCandidates('yoqilgi-filtri', ['weichai-wd615']);
    expect(gen.next().value).toBe('yoqilgi-filtri');
    expect(gen.next().value).toBe('yoqilgi-filtri-weichai-wd615');
    expect(gen.next().value).toBe('yoqilgi-filtri-2');
    expect(gen.next().value).toBe('yoqilgi-filtri-3');
  });
});

describe('createWithUniqueSlug', () => {
  it('retries on conflict and returns the row created with the working slug', async () => {
    const taken = new Set(['x', 'x-2']);
    const attempt = jest.fn(async (slug: string) => {
      if (taken.has(slug)) throw Object.assign(new Error('conflict'), { code: 'P2002' });
      return { id: slug };
    });
    const result = await createWithUniqueSlug({
      candidates: () => slugCandidates('x', []),
      attempt,
    });
    expect(result).toEqual({ id: 'x-3' });
    expect(attempt).toHaveBeenCalledTimes(3);
  });

  it('rethrows a non-P2002 error immediately without retrying', async () => {
    const attempt = jest.fn(async () => { throw new Error('db is down'); });
    await expect(
      createWithUniqueSlug({ candidates: () => slugCandidates('x', []), attempt }),
    ).rejects.toThrow('db is down');
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  it('gives up after maxAttempts and rethrows the last conflict', async () => {
    const attempt = jest.fn(async () => { throw Object.assign(new Error('conflict'), { code: 'P2002' }); });
    await expect(
      createWithUniqueSlug({ candidates: () => slugCandidates('x', []), attempt, maxAttempts: 3 }),
    ).rejects.toMatchObject({ code: 'P2002' });
    expect(attempt).toHaveBeenCalledTimes(3);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd backend && npx jest src/common/slug.spec.ts`
Expected: FAIL — `Cannot find module './slug'`.

- [ ] **Step 3: Implement**

```typescript
// backend/src/common/slug.ts

/**
 * Ported from frontend/lib/catalog-tree.ts's TRANSLITERATION table and
 * extended with the four Uzbek-specific Cyrillic letters that table never
 * needed (it only ever saw Russian brand/spec text). This file is now the
 * server-side source of truth for slug generation — the frontend copy stays
 * only as a live-typing preview, never authoritative.
 */
const CYRILLIC_TRANSLITERATION: ReadonlyArray<[RegExp, string]> = [
  [/ў/g, "o'"], [/Ў/g, "O'"],
  [/қ/g, 'q'], [/Қ/g, 'Q'],
  [/ғ/g, "g'"], [/Ғ/g, "G'"],
  [/ҳ/g, 'h'], [/Ҳ/g, 'H'],
  [/щ/g, 'sh'], [/ш/g, 'sh'],
  [/ч/g, 'ch'], [/ж/g, 'j'],
  [/ю/g, 'yu'], [/я/g, 'ya'], [/ё/g, 'yo'],
  [/э/g, 'e'], [/ы/g, 'i'], [/х/g, 'h'],
  [/ц/g, 'ts'], [/[ъь]/g, ''],
  [/а/g, 'a'], [/б/g, 'b'], [/в/g, 'v'], [/г/g, 'g'],
  [/д/g, 'd'], [/е/g, 'e'], [/з/g, 'z'], [/и/g, 'i'],
  [/й/g, 'y'], [/к/g, 'k'], [/л/g, 'l'], [/м/g, 'm'],
  [/н/g, 'n'], [/о/g, 'o'], [/п/g, 'p'], [/р/g, 'r'],
  [/с/g, 's'], [/т/g, 't'], [/у/g, 'u'], [/ф/g, 'f'],
];

export function transliterateCyrillicToLatin(text: string): string {
  let result = text;
  for (const [pattern, replacement] of CYRILLIC_TRANSLITERATION) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

/** ASCII, lowercase, hyphen-separated. Never emits Cyrillic or CJK. */
export function toAsciiSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/o'/g, 'o')
    .replace(/g'/g, 'g')
    .replace(/[’‘`´ʻ]/g, '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function* slugCandidates(base: string, disambiguators: string[]): Generator<string> {
  yield base;
  for (const d of disambiguators) {
    const suffix = toAsciiSlug(d);
    if (suffix) yield `${base}-${suffix}`;
  }
  let n = 2;
  while (true) {
    yield `${base}-${n}`;
    n += 1;
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === 'P2002'
  );
}

/**
 * Race-safe by construction: does not pre-check availability (a TOCTOU gap
 * under concurrent creates), it inserts and lets Postgres's own unique
 * constraint be the arbiter, retrying the next candidate slug on conflict.
 */
export async function createWithUniqueSlug<T>(opts: {
  candidates: () => Generator<string>;
  attempt: (slug: string) => Promise<T>;
  maxAttempts?: number;
}): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? 25;
  const gen = opts.candidates();
  let lastError: unknown;
  for (let i = 0; i < maxAttempts; i++) {
    const { value: slug, done } = gen.next();
    if (done || slug === undefined) break;
    try {
      return await opts.attempt(slug);
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
      lastError = error;
    }
  }
  throw lastError;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `cd backend && npx jest src/common/slug.spec.ts`
Expected: PASS, all 7 tests.

- [ ] **Step 5: Commit**

```bash
git add backend/src/common/slug.ts backend/src/common/slug.spec.ts
git commit -m "feat(common): race-safe slug generation with Cyrillic transliteration"
```

---

## Task 3: AI translation module (Gemini)

**Files:**
- Create: `backend/src/ai/translation-schema.ts`, `backend/src/ai/gemini-client.ts`, `backend/src/ai/ai.service.ts`, `backend/src/ai/ai.module.ts`, `backend/src/ai/ai.controller.ts`, `backend/src/ai/dto/translate-request.dto.ts`, `backend/src/ai/ai-rate-limit.ts`
- Test: `backend/src/ai/ai.service.spec.ts`, `backend/src/ai/translation-schema.spec.ts`, `backend/src/ai/ai-rate-limit.spec.ts`

**Interfaces:**
- Produces:
  - `type Locale = 'UZ' | 'OZ' | 'RU' | 'EN' | 'ZH'` (mirrors the Prisma enum — re-exported from `translation-schema.ts` as the app-facing string union).
  - `interface TranslatableFields { name: string; description?: string }`
  - `interface TranslationResult { status: 'COMPLETE' | 'FAILED'; failureReason?: string; sourceLocale: Locale; corrections: Array<{ field: 'name' | 'description'; before: string; after: string }>; byLocale: Record<Locale, TranslatableFields> }` — `byLocale[sourceLocale]` holds the *corrected* source text.
  - `AiTranslationService.translate(input: { sourceLocale: Locale; fields: TranslatableFields; domainHint?: 'product' | 'category' | 'brand' }): Promise<TranslationResult>` — never throws; a Gemini failure resolves to `{ status: 'FAILED', ... , byLocale: { [sourceLocale]: fields, ...others empty } }`.
- Consumes: `ConfigService.getOrThrow('GEMINI_API_KEY')`, `ConfigService.get('GEMINI_MODEL') ?? 'gemini-flash-latest'`.

- [ ] **Step 1: Write the Zod schema + verifier + its failing tests**

```typescript
// backend/src/ai/translation-schema.ts
import { z } from 'zod';

export const LOCALES = ['UZ', 'OZ', 'RU', 'EN', 'ZH'] as const;
export type Locale = (typeof LOCALES)[number];

export interface TranslatableFields {
  name: string;
  description?: string;
}

const fieldsSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

/** What Gemini must return, shape-checked before anything touches the DB. */
export const geminiResponseSchema = z.object({
  correctedSource: fieldsSchema,
  corrections: z.array(
    z.object({
      field: z.enum(['name', 'description']),
      before: z.string(),
      after: z.string(),
    }),
  ),
  translations: z.object({
    OZ: fieldsSchema,
    RU: fieldsSchema,
    EN: fieldsSchema,
    ZH: fieldsSchema,
  }),
});
export type GeminiResponse = z.infer<typeof geminiResponseSchema>;

/** Gemini's `responseSchema` — the model-config-level enforcement, separate
 *  from (but shaped identically to) the Zod check above, which is what
 *  actually gates whether the app trusts the response. */
const LOCALIZED = {
  type: 'OBJECT',
  properties: { name: { type: 'STRING' }, description: { type: 'STRING' } },
  required: ['name'],
};
export const GEMINI_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    correctedSource: LOCALIZED,
    corrections: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          field: { type: 'STRING', enum: ['name', 'description'] },
          before: { type: 'STRING' },
          after: { type: 'STRING' },
        },
        required: ['field', 'before', 'after'],
      },
    },
    translations: {
      type: 'OBJECT',
      properties: { OZ: LOCALIZED, RU: LOCALIZED, EN: LOCALIZED, ZH: LOCALIZED },
      required: ['OZ', 'RU', 'EN', 'ZH'],
    },
  },
  required: ['correctedSource', 'corrections', 'translations'],
};

/**
 * Extracts every OEM/part-number-shaped or plain-numeric token from a piece
 * of source text — sequences that mix digits with letters/hyphens/slashes,
 * or bare numbers. "10R-7225", "WD615", "3126", "120K" all match.
 */
function numberTokens(text: string): Set<string> {
  const matches = text.match(/[A-Za-z]*\d[\dA-Za-z\-/]*/g) ?? [];
  return new Set(matches.map((m) => m.toUpperCase()));
}

/**
 * True if every number-like token in `source` still appears, verbatim, in
 * `translated`. A translation that drops or mangles a token fails this and
 * the caller marks that locale's translation as unusable (spec's OEM/number
 * preservation rule).
 */
export function preservesNumberTokens(source: string, translated: string): boolean {
  const sourceTokens = numberTokens(source);
  if (sourceTokens.size === 0) return true;
  const translatedUpper = translated.toUpperCase();
  for (const token of sourceTokens) {
    if (!translatedUpper.includes(token)) return false;
  }
  return true;
}
```

```typescript
// backend/src/ai/translation-schema.spec.ts
import { geminiResponseSchema, preservesNumberTokens } from './translation-schema';

describe('geminiResponseSchema', () => {
  it('accepts a well-formed response', () => {
    const ok = geminiResponseSchema.safeParse({
      correctedSource: { name: "Yoqilg'i filtri", description: 'Tavsif' },
      corrections: [],
      translations: {
        OZ: { name: 'Ёқилғи филтри' },
        RU: { name: 'Топливный фильтр' },
        EN: { name: 'Fuel filter' },
        ZH: { name: '燃油滤清器' },
      },
    });
    expect(ok.success).toBe(true);
  });
  it('rejects a response missing a locale', () => {
    const bad = geminiResponseSchema.safeParse({
      correctedSource: { name: 'x' },
      corrections: [],
      translations: { OZ: { name: 'x' }, RU: { name: 'x' }, EN: { name: 'x' } },
    });
    expect(bad.success).toBe(false);
  });
});

describe('preservesNumberTokens', () => {
  it('passes when every number token survives', () => {
    expect(preservesNumberTokens('Caterpillar 3126 injector 10R-7225', 'Инжектор Caterpillar 3126 10R-7225')).toBe(true);
  });
  it('fails when a token is dropped', () => {
    expect(preservesNumberTokens('Caterpillar 3126 10R-7225', 'Caterpillar 3126')).toBe(false);
  });
  it('fails when a token is mangled', () => {
    expect(preservesNumberTokens('10R-7225', '10R7225')).toBe(false);
  });
  it('passes trivially when the source has no numbers', () => {
    expect(preservesNumberTokens('yoqilgi filtri', 'fuel filter')).toBe(true);
  });
});
```

Run: `cd backend && npx jest src/ai/translation-schema.spec.ts` — expect FAIL (`Cannot find module`), then implement the two files above and re-run — expect PASS (6 tests).

- [ ] **Step 2: Gemini client wrapper with timeout + retry**

```typescript
// backend/src/ai/gemini-client.ts
import { Logger } from '@nestjs/common';

const logger = new Logger('GeminiClient');
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const TIMEOUT_MS = 30_000;
const RETRY_DELAYS_MS = [500, 1500]; // 2 retries after the first attempt

export interface GeminiCallInput {
  apiKey: string;
  model: string;
  systemInstruction: string;
  userText: string;
  responseSchema: unknown;
}

export class GeminiCallError extends Error {}

async function callOnce(input: GeminiCallInput): Promise<{ status: number; body: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${GEMINI_API_BASE}/${input.model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': input.apiKey },
      signal: controller.signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: input.systemInstruction }] },
        contents: [{ role: 'user', parts: [{ text: input.userText }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: input.responseSchema,
          temperature: 0.2,
        },
      }),
    });
    return { status: response.status, body: await response.text() };
  } finally {
    clearTimeout(timer);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Retries on 429 and 5xx only; a 4xx other than 429 fails immediately (a
 *  malformed request will not fix itself by trying again). */
export async function callGemini(input: GeminiCallInput): Promise<string> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      const { status, body } = await callOnce(input);
      if (status >= 200 && status < 300) return body;
      if (status === 429 || status >= 500) {
        lastError = new GeminiCallError(`Gemini ${status}: ${body.slice(0, 500)}`);
        logger.warn(`Gemini call failed (attempt ${attempt + 1}), status ${status}`);
      } else {
        throw new GeminiCallError(`Gemini ${status}: ${body.slice(0, 500)}`);
      }
    } catch (error) {
      if (error instanceof GeminiCallError) throw error;
      lastError = error; // network error / abort — retryable
      logger.warn(`Gemini call threw (attempt ${attempt + 1}): ${(error as Error).message}`);
    }
    if (attempt < RETRY_DELAYS_MS.length) await sleep(RETRY_DELAYS_MS[attempt]);
  }
  throw lastError instanceof Error ? lastError : new GeminiCallError('Gemini call failed');
}
```

No dedicated spec for this file (it is a thin `fetch` wrapper exercised through `ai.service.spec.ts`'s mocked-`fetch` tests in Step 4) — matches this codebase's convention of not unit-testing pure network plumbing in isolation elsewhere (e.g. `backend-client.ts` on the frontend has no direct spec either).

- [ ] **Step 3: The prompt, and `AiTranslationService`**

```typescript
// backend/src/ai/ai.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { callGemini } from './gemini-client';
import {
  geminiResponseSchema,
  GEMINI_RESPONSE_SCHEMA,
  preservesNumberTokens,
  LOCALES,
  type Locale,
  type TranslatableFields,
} from './translation-schema';

export interface TranslationResult {
  status: 'COMPLETE' | 'FAILED';
  failureReason?: string;
  sourceLocale: Locale;
  corrections: Array<{ field: 'name' | 'description'; before: string; after: string }>;
  byLocale: Record<Locale, TranslatableFields>;
}

const LOCALE_NAMES: Record<Locale, string> = {
  UZ: "o'zbek lotin",
  OZ: "o'zbek kirill",
  RU: 'rus',
  EN: 'ingliz',
  ZH: 'xitoy (soddalashtirilgan)',
};

/**
 * The prompt. Domain and rules come straight from the task spec (og'ir
 * texnika ehtiyot qismlari; OEM/brand/model/number preservation; o' g'
 * apostrophe normalization to U+02BB; formal Cyrillic Uzbek orthography).
 */
function buildSystemPrompt(sourceLocale: Locale, domainHint: string): string {
  return [
    "Sen og'ir texnika (dizel dvigatellar, ekskavator, buldozer, yuklagich, kran va sh.k.) ehtiyot qismlari katalogi uchun professional texnik tarjimon va muharrirsan.",
    '',
    `Senga ${LOCALE_NAMES[sourceLocale]} tilida ${domainHint} nomi (va, agar berilgan bo'lsa, tavsifi) beriladi. Ikki vazifang bor:`,
    '',
    "1-VAZIFA — manba matnni tuzat: imlo va grammatika xatolarini tuzat, lekin ma'noni o'zgartirma, yangi ma'lumot qo'shma, qator va formatlashni saqla. Har bir aniq tuzatishni \"corrections\" ro'yxatiga {field, before, after} sifatida yoz. Agar xato bo'lmasa, \"corrections\" bo'sh massiv bo'lsin va \"correctedSource\" manba matn bilan bir xil bo'lsin.",
    '',
    '2-VAZIFA — tuzatilgan matnni qolgan 4 tilga tarjima qil: o\'zbek lotin (agar manba shu bo\'lmasa), o\'zbek kirill, rus, ingliz, xitoy (soddalashtirilgan).',
    '',
    'QATʼIY QOIDALAR:',
    '- TARJIMA QILINMAYDI va O\'ZGARTIRILMAYDI: OEM va ehtiyot qism raqamlari, brend va model nomlari matn ichida uchraganda (masalan "Weichai WD615", "Cummins", "XCMG"), raqamlar, o\'lchov birliklari. Bular har bir tildagi matnda AYNAN bir xil ko\'rinishda qolishi shart.',
    "- O'zbek lotin tilida faqat bitta apostrof belgisi ishlat: U+02BB (ʻ) — o' va g' uchun ham. Boshqa tirnoqlar (', `, ‘, ’) uchramasin.",
    "- O'zbek kirill tilida rasmiy imlo qoidalariga amal qil: ў, қ, ғ, ҳ harflarini to'g'ri ishlat.",
    "- Uslub rasmiy va texnik bo'lsin. Texnik atamalarni to'g'ri tarjima qil (gidronasos, forsunka, turbokompressor, tishli g'ildirak va h.k.), marketing bezaklarisiz.",
    "- Ma'noni o'zgartirma, yangi ma'lumot to'qima, qator va formatlashni saqla.",
    domainHint === 'brend'
      ? "- Bu BREND NOMI: uni tarjima qilma, faqat har bir yozuv tizimiga FONETIK translyaratsiya qil (masalan \"Cummins\" → rus \"Камминз\", xitoy \"康明斯\"), lotin harflarini o'zgartirma (uz, en da original nom qoladi)."
      : '',
    '',
    "Javobni FAQAT berilgan JSON sxemasi bo'yicha qaytar.",
  ]
    .filter(Boolean)
    .join('\n');
}

const DOMAIN_HINTS = { product: 'mahsulot', category: 'kategoriya', brand: 'brend' } as const;

@Injectable()
export class AiTranslationService {
  private readonly logger = new Logger(AiTranslationService.name);
  constructor(private readonly config: ConfigService) {}

  async translate(input: {
    sourceLocale: Locale;
    fields: TranslatableFields;
    domainHint?: keyof typeof DOMAIN_HINTS;
  }): Promise<TranslationResult> {
    const fallback = (reason: string): TranslationResult => ({
      status: 'FAILED',
      failureReason: reason,
      sourceLocale: input.sourceLocale,
      corrections: [],
      byLocale: {
        [input.sourceLocale]: input.fields,
        ...Object.fromEntries(
          LOCALES.filter((l) => l !== input.sourceLocale).map((l) => [l, { name: '' }]),
        ),
      } as Record<Locale, TranslatableFields>,
    });

    let raw: string;
    try {
      const apiKey = this.config.getOrThrow<string>('GEMINI_API_KEY');
      const model = this.config.get<string>('GEMINI_MODEL') ?? 'gemini-flash-latest';
      raw = await callGemini({
        apiKey,
        model,
        systemInstruction: buildSystemPrompt(input.sourceLocale, DOMAIN_HINTS[input.domainHint ?? 'product']),
        userText: JSON.stringify(input.fields),
        responseSchema: GEMINI_RESPONSE_SCHEMA,
      });
    } catch (error) {
      this.logger.error(`Gemini call failed: ${(error as Error).message}`);
      return fallback('gemini_unavailable');
    }

    let candidateResponse: unknown;
    try {
      const data = JSON.parse(raw) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      const text = (data.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('');
      candidateResponse = JSON.parse(text);
    } catch (error) {
      this.logger.error(`Failed to parse Gemini response: ${(error as Error).message}`);
      return fallback('invalid_response_shape');
    }

    const parsed = geminiResponseSchema.safeParse(candidateResponse);
    if (!parsed.success) {
      this.logger.error(`Gemini response failed schema validation: ${parsed.error.message}`);
      return fallback('invalid_response_shape');
    }

    const { correctedSource, corrections, translations } = parsed.data;
    const byLocale: Record<Locale, TranslatableFields> = {
      [input.sourceLocale]: correctedSource,
      ...translations,
    } as Record<Locale, TranslatableFields>;

    // OEM/number preservation: check every non-source locale's name+description
    // against the corrected source. A single failure fails the whole batch —
    // partial-locale translations are not worth the confusion of a half-FAILED row.
    for (const locale of LOCALES) {
      if (locale === input.sourceLocale) continue;
      const target = byLocale[locale];
      const sourceText = `${correctedSource.name} ${correctedSource.description ?? ''}`;
      const targetText = `${target.name} ${target.description ?? ''}`;
      if (!preservesNumberTokens(sourceText, targetText)) {
        this.logger.warn(`Number-token mismatch in ${locale} translation`);
        return fallback('number_token_mismatch');
      }
    }

    return { status: 'COMPLETE', sourceLocale: input.sourceLocale, corrections, byLocale };
  }
}
```

- [ ] **Step 4: `ai.service.spec.ts`**

```typescript
// backend/src/ai/ai.service.spec.ts
import { ConfigService } from '@nestjs/config';
import { AiTranslationService } from './ai.service';

const validGeminiPayload = (overrides: Record<string, unknown> = {}) => ({
  correctedSource: { name: "Yoqilg'i filtri Weichai WD615" },
  corrections: [],
  translations: {
    OZ: { name: 'Ёқилғи филтри Weichai WD615' },
    RU: { name: 'Топливный фильтр Weichai WD615' },
    EN: { name: 'Fuel filter Weichai WD615' },
    ZH: { name: '燃油滤清器 Weichai WD615' },
  },
  ...overrides,
});

function mockFetchOnce(status: number, body: unknown) {
  global.fetch = jest.fn().mockResolvedValue({
    status,
    text: async () => JSON.stringify(body),
  }) as unknown as typeof fetch;
}

function geminiEnvelope(payload: unknown) {
  return { candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }] };
}

describe('AiTranslationService', () => {
  const config = { getOrThrow: () => 'fake-key', get: () => undefined } as unknown as ConfigService;

  it('returns COMPLETE with all 5 locales on a well-formed Gemini response', async () => {
    mockFetchOnce(200, geminiEnvelope(validGeminiPayload()));
    const service = new AiTranslationService(config);
    const result = await service.translate({ sourceLocale: 'UZ', fields: { name: "Yoqilg'i filtri Weichai WD615" } });
    expect(result.status).toBe('COMPLETE');
    expect(result.byLocale.EN.name).toContain('WD615');
    expect(result.byLocale.UZ.name).toBe("Yoqilg'i filtri Weichai WD615");
  });

  it('falls back to FAILED without throwing when Gemini is unreachable', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network down')) as unknown as typeof fetch;
    const service = new AiTranslationService(config);
    const result = await service.translate({ sourceLocale: 'UZ', fields: { name: 'x' } });
    expect(result.status).toBe('FAILED');
    expect(result.byLocale.UZ.name).toBe('x');
  });

  it('marks FAILED when a translation drops an OEM number', async () => {
    mockFetchOnce(
      200,
      geminiEnvelope(
        validGeminiPayload({ translations: { ...validGeminiPayload().translations, EN: { name: 'Fuel filter' } } }),
      ),
    );
    const service = new AiTranslationService(config);
    const result = await service.translate({ sourceLocale: 'UZ', fields: { name: "Yoqilg'i filtri Weichai WD615" } });
    expect(result.status).toBe('FAILED');
    expect(result.failureReason).toBe('number_token_mismatch');
  });

  it('marks FAILED when Gemini returns a shape that fails schema validation', async () => {
    mockFetchOnce(200, geminiEnvelope({ nonsense: true }));
    const service = new AiTranslationService(config);
    const result = await service.translate({ sourceLocale: 'UZ', fields: { name: 'x' } });
    expect(result.status).toBe('FAILED');
    expect(result.failureReason).toBe('invalid_response_shape');
  });
});
```

Run: `cd backend && npx jest src/ai/ai.service.spec.ts` — expect FAIL until Step 3's file exists, then PASS (4 tests).

- [ ] **Step 5: Rate limiter (ported pattern) + controller + module**

```typescript
// backend/src/ai/ai-rate-limit.ts
// Same fixed-window in-memory algorithm as backend/src/auth/login-throttle.ts.
export const MAX_AI_CALLS = 10;
export const AI_WINDOW_MS = 60_000;

interface Attempts { count: number; windowStartedAt: number }
const store = new Map<string, Attempts>();

function prune(now: number): void {
  for (const [key, entry] of store) {
    if (now - entry.windowStartedAt >= AI_WINDOW_MS) store.delete(key);
  }
}

export type AiRateLimitResult = { ok: true } | { ok: false; retryAfterSeconds: number };

export function checkAiRateLimit(actorId: string, now: number = Date.now()): AiRateLimitResult {
  prune(now);
  const entry = store.get(actorId);
  if (!entry || entry.count < MAX_AI_CALLS) return { ok: true };
  return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((entry.windowStartedAt + AI_WINDOW_MS - now) / 1000)) };
}

export function recordAiCall(actorId: string, now: number = Date.now()): void {
  const entry = store.get(actorId);
  const windowIsOpen = entry !== undefined && now - entry.windowStartedAt < AI_WINDOW_MS;
  store.set(actorId, { count: windowIsOpen ? entry.count + 1 : 1, windowStartedAt: windowIsOpen ? entry.windowStartedAt : now });
}
```

```typescript
// backend/src/ai/dto/translate-request.dto.ts
import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class TranslateRequestDto {
  @IsIn(['UZ', 'OZ', 'RU', 'EN', 'ZH'])
  sourceLocale: 'UZ' | 'OZ' | 'RU' | 'EN' | 'ZH';

  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(['product', 'category', 'brand'])
  domainHint?: 'product' | 'category' | 'brand';
}
```

```typescript
// backend/src/ai/ai.controller.ts
import { Body, Controller, HttpException, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { AiTranslationService } from './ai.service';
import { TranslateRequestDto } from './dto/translate-request.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { MANAGER_UP } from '../common/roles';
import { checkAiRateLimit, recordAiCall } from './ai-rate-limit';

/** Same role gate as product creation (MANAGER_UP) — anyone who can create a
 *  product can ask the AI to translate one. Rate-limited per actor. */
@Controller('ai/products')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...MANAGER_UP)
export class AiController {
  constructor(private readonly ai: AiTranslationService) {}

  @Post('translate')
  async translate(@CurrentUser('id') actorId: string, @Body() dto: TranslateRequestDto) {
    const limit = checkAiRateLimit(actorId);
    if (!limit.ok) {
      throw new HttpException(
        { error: 'rate_limited', retryAfterSeconds: limit.retryAfterSeconds },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    recordAiCall(actorId);
    return this.ai.translate({
      sourceLocale: dto.sourceLocale,
      fields: { name: dto.name, description: dto.description },
      domainHint: dto.domainHint,
    });
  }
}
```

```typescript
// backend/src/ai/ai.module.ts
import { Module } from '@nestjs/common';
import { AiTranslationService } from './ai.service';
import { AiController } from './ai.controller';

@Module({
  providers: [AiTranslationService],
  controllers: [AiController],
  exports: [AiTranslationService],
})
export class AiModule {}
```

- [ ] **Step 6: `ai-rate-limit.spec.ts`**

```typescript
// backend/src/ai/ai-rate-limit.spec.ts
import { checkAiRateLimit, recordAiCall, MAX_AI_CALLS, AI_WINDOW_MS } from './ai-rate-limit';

describe('ai rate limit', () => {
  it('allows up to MAX_AI_CALLS then blocks', () => {
    const actor = `actor-${Date.now()}`;
    const now = Date.now();
    for (let i = 0; i < MAX_AI_CALLS; i++) {
      expect(checkAiRateLimit(actor, now).ok).toBe(true);
      recordAiCall(actor, now);
    }
    const blocked = checkAiRateLimit(actor, now);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('resets after the window elapses', () => {
    const actor = `actor2-${Date.now()}`;
    const now = Date.now();
    for (let i = 0; i < MAX_AI_CALLS; i++) recordAiCall(actor, now);
    expect(checkAiRateLimit(actor, now + AI_WINDOW_MS + 1).ok).toBe(true);
  });
});
```

Run: `cd backend && npx jest src/ai` — expect all specs PASS.

- [ ] **Step 7: Register the module, add env vars**

Edit `backend/src/app.module.ts`: add `import { AiModule } from './ai/ai.module';` and `AiModule` to the `imports` array.

Edit `backend/.env.example`, append:
```
GEMINI_API_KEY=
GEMINI_MODEL=gemini-flash-latest
```

Edit `backend/package.json` — add `"zod": "^3.23.8"` to `dependencies` (match whatever version `frontend/package.json` pins, for consistency). Run: `cd backend && npm install`.

- [ ] **Step 8: Full backend test run + tsc**

Run: `cd backend && npx tsc --noEmit && npx jest`
Expected: 0 tsc errors introduced by this task; all specs pass (existing suite count + the ~13 new tests from this task).

- [ ] **Step 9: Commit**

```bash
git add backend/src/ai backend/src/app.module.ts backend/.env.example backend/package.json backend/package-lock.json
git commit -m "feat(ai): Gemini-backed spellcheck+translate service and POST /ai/products/translate"
```

---

## Task 4: `ProductsService` — server-side slug, AI integration, immutable id on update

**Files:**
- Modify: `backend/src/products/products.service.ts`, `backend/src/products/dto/create-product.dto.ts`, `backend/src/products/dto/update-product.dto.ts`, `backend/src/products/products.controller.ts`, `backend/src/products/products.module.ts`
- Test: `backend/src/products/products.service.spec.ts` (extend)

**Interfaces:**
- Consumes: `AiTranslationService.translate()` (Task 3), `createWithUniqueSlug`/`toAsciiSlug`/`transliterateCyrillicToLatin` (Task 2).
- Produces: `ProductsService.create(dto, actorId)` unchanged signature; `ProductsService.retranslate(id, overwriteLocales: Locale[], actorId)` — new method backing the new endpoint.

- [ ] **Step 1: Rework `CreateProductDto`**

Replace the `slug`/`nameUz`/`nameRu`/`nameEn`/`descriptionUz`/`descriptionRu`/`descriptionEn` block with:
```typescript
@IsIn(['UZ', 'OZ', 'RU', 'EN', 'ZH'])
sourceLocale: 'UZ' | 'OZ' | 'RU' | 'EN' | 'ZH';

@IsString()
@MinLength(1)
name: string;

@IsOptional()
@IsString()
description?: string;

/**
 * Present only when the caller already ran AI translation client-side (the
 * "AI bilan tekshirish" button) and is submitting the reviewed result —
 * every locale filled, possibly hand-edited. When absent, ProductsService
 * runs translation itself before persisting (spec #14).
 */
@IsOptional()
translations?: Partial<Record<'UZ' | 'OZ' | 'RU' | 'EN' | 'ZH', { name: string; description?: string }>>;
```
Remove `slug` entirely — it is never client-supplied anymore. Keep every other field (`sku`, `categoryId`, `brandId`, `price`, etc.) as-is.

- [ ] **Step 2: `UpdateProductDto`**

Change from `PartialType(CreateProductDto)` to an explicit class that excludes `sourceLocale` (a product's source locale is fixed at creation — editing in a different tab doesn't change which locale is "the source") and excludes any slug field (there isn't one anymore, so nothing to strip — this just documents the exclusion isn't needed). No `translations` full-object replace either — updates to individual locale fields go through the same flat `nameUz`/`nameOz`/... columns as always, via a new `localeFields` map:
```typescript
import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateProductDto } from './create-product.dto';

export class UpdateProductDto extends PartialType(OmitType(CreateProductDto, ['sourceLocale', 'translations'] as const)) {}
```
Editing a specific locale's name/description from the form (Task 8) is handled by the form sending the already-known flat columns (`nameRu`, `descriptionRu`, ...) directly — add those as optional fields on `UpdateProductDto` only (not `CreateProductDto`, where they come from the `translations` map instead):
```typescript
  @IsOptional() @IsString() nameUz?: string;
  @IsOptional() @IsString() nameOz?: string;
  @IsOptional() @IsString() nameRu?: string;
  @IsOptional() @IsString() nameEn?: string;
  @IsOptional() @IsString() nameZh?: string;
  @IsOptional() @IsString() descriptionUz?: string;
  @IsOptional() @IsString() descriptionOz?: string;
  @IsOptional() @IsString() descriptionRu?: string;
  @IsOptional() @IsString() descriptionEn?: string;
  @IsOptional() @IsString() descriptionZh?: string;
```

- [ ] **Step 3: Write the failing tests for `create()`**

Add to `products.service.spec.ts` (follow the existing mock-Prisma pattern already in that file):
```typescript
it('derives the slug from the English translation, not the source locale', async () => {
  aiTranslate.mockResolvedValue({
    status: 'COMPLETE', sourceLocale: 'UZ', corrections: [],
    byLocale: {
      UZ: { name: "Yoqilg'i filtri" }, OZ: { name: 'Ёқилғи филтри' },
      RU: { name: 'Топливный фильтр' }, EN: { name: 'Fuel filter Weichai WD615' }, ZH: { name: '燃油滤清器' },
    },
  });
  const result = await service.create({ sku: 'X1', sourceLocale: 'UZ', name: "Yoqilg'i filtri", categoryId: 'c1', brandId: 'b1' } as any, 'actor1');
  expect(result.id).toBe('fuel-filter-weichai-wd615');
  expect(result.slug).toBe('fuel-filter-weichai-wd615');
  expect(result.translationStatus).toBe('COMPLETE');
});

it('still creates the product in the source locale when AI fails, marked FAILED', async () => {
  aiTranslate.mockResolvedValue({ status: 'FAILED', failureReason: 'gemini_unavailable', sourceLocale: 'OZ', corrections: [], byLocale: { OZ: { name: 'Ёқилғи филтри' }, UZ: { name: '' }, RU: { name: '' }, EN: { name: '' }, ZH: { name: '' } } });
  const result = await service.create({ sku: 'X2', sourceLocale: 'OZ', name: 'Ёқилғи филтри', categoryId: 'c1', brandId: 'b1' } as any, 'actor1');
  expect(result.translationStatus).toBe('FAILED');
  // no EN/UZ translation available — slug falls back to transliterated Cyrillic source
  expect(result.id).toBe('yoqilgi-filtri');
});

it('skips calling AI when the caller already supplied full translations', async () => {
  await service.create({
    sku: 'X3', sourceLocale: 'UZ', name: "Yoqilg'i filtri", categoryId: 'c1', brandId: 'b1',
    translations: {
      UZ: { name: "Yoqilg'i filtri" }, OZ: { name: 'x' }, RU: { name: 'x' }, EN: { name: 'Fuel filter' }, ZH: { name: 'x' },
    },
  } as any, 'actor1');
  expect(aiTranslate).not.toHaveBeenCalled();
});

it('never lets an AI exception propagate out of create()', async () => {
  aiTranslate.mockRejectedValue(new Error('should never happen — service.translate() never throws, but guard anyway'));
  await expect(service.create({ sku: 'X4', sourceLocale: 'UZ', name: 'test', categoryId: 'c1', brandId: 'b1' } as any, 'actor1')).resolves.toBeDefined();
});

it('appends a disambiguator, then a numeric suffix, on slug collision', async () => {
  prismaMock.product.create
    .mockRejectedValueOnce(Object.assign(new Error('conflict'), { code: 'P2002' }))
    .mockResolvedValueOnce({ id: 'fuel-filter-2', slug: 'fuel-filter-2' /* ...rest */ });
  aiTranslate.mockResolvedValue({ status: 'COMPLETE', sourceLocale: 'UZ', corrections: [], byLocale: { UZ: { name: 'x' }, OZ: { name: 'x' }, RU: { name: 'x' }, EN: { name: 'Fuel filter' }, ZH: { name: 'x' } } });
  const result = await service.create({ sku: 'X5', sourceLocale: 'UZ', name: 'x', categoryId: 'c1', brandId: 'b1' } as any, 'actor1');
  expect(result.id).toBe('fuel-filter-2');
});
```
(Exact mock wiring — `aiTranslate` as a jest mock injected via the test module, `prismaMock.product.create` — must match whatever mocking convention the existing top of `products.service.spec.ts` already uses; read that file's existing `beforeEach`/module setup before adding these and adapt the mock shape to match rather than inventing a new one.)

- [ ] **Step 4: Run to verify failure**

Run: `cd backend && npx jest src/products/products.service.spec.ts`
Expected: FAIL (new tests reference behavior not yet implemented).

- [ ] **Step 5: Implement — inject `AiTranslationService`, rewrite `create()`**

```typescript
// backend/src/products/products.service.ts — constructor
constructor(
  private readonly prisma: PrismaService,
  private readonly audit: AuditService,
  private readonly ai: AiTranslationService,
) {}
```

```typescript
async create(dto: CreateProductDto, actorId: string) {
  const existingSku = await this.prisma.product.findUnique({ where: { sku: dto.sku } });
  if (existingSku) throw new ConflictException('SKU already exists');

  const { stock, translations: suppliedTranslations, sourceLocale, name, description, ...rest } = dto;

  let byLocale: Record<Locale, { name: string; description?: string }>;
  let translationStatus: 'COMPLETE' | 'FAILED';

  if (suppliedTranslations && LOCALES.every((l) => suppliedTranslations[l]?.name)) {
    // Caller already ran "AI bilan tekshirish" and is submitting the reviewed result.
    byLocale = suppliedTranslations as Record<Locale, { name: string; description?: string }>;
    translationStatus = 'COMPLETE';
  } else {
    const result = await this.ai.translate({ sourceLocale, fields: { name, description }, domainHint: 'product' });
    byLocale = result.byLocale;
    translationStatus = result.status;
  }

  const englishName = byLocale.EN?.name?.trim();
  const uzName = byLocale.UZ?.name?.trim();
  const slugBase = englishName
    ? toAsciiSlug(englishName)
    : uzName
      ? toAsciiSlug(uzName)
      : sourceLocale === 'OZ'
        ? toAsciiSlug(transliterateCyrillicToLatin(byLocale.OZ.name))
        : toAsciiSlug(dto.oemNumbers?.[0] ?? dto.sku);

  const created = await createWithUniqueSlug({
    candidates: () => slugCandidates(slugBase, [dto.compatibleModels?.[0] ?? '', dto.oemNumbers?.[0] ?? '']),
    attempt: (slug) =>
      this.prisma.product.create({
        data: {
          ...rest,
          id: slug,
          slug,
          sourceLocale,
          translationStatus,
          nameUz: byLocale.UZ?.name ?? '',
          nameOz: byLocale.OZ?.name ?? null,
          nameRu: byLocale.RU?.name ?? '',
          nameEn: byLocale.EN?.name ?? '',
          nameZh: byLocale.ZH?.name ?? null,
          descriptionUz: byLocale.UZ?.description ?? '',
          descriptionOz: byLocale.OZ?.description ?? null,
          descriptionRu: byLocale.RU?.description ?? '',
          descriptionEn: byLocale.EN?.description ?? '',
          descriptionZh: byLocale.ZH?.description ?? null,
          stockStatus: DB_STOCK_STATUS[deriveStockStatus(0, rest.minStock ?? 0)],
        } as Prisma.ProductUncheckedCreateInput,
      }),
  }).catch((error: unknown) => translateWriteError(error));

  if (stock !== undefined) {
    await this.setCatalogStock(created.id, await this.catalogWarehouseId(), stock);
  }
  await this.audit.record({ userId: actorId, action: AuditAction.CREATE, entityType: 'Product', entityId: created.id, after: auditSnapshot(created) });
  return created;
}
```
Note the `EN`/`UZ` fallback: `uzName` will always be present in practice (source is one of the 5 locales, and the translate call always returns *something* for every locale key even in `FAILED` fallback — see Task 3 Step 3's `fallback()` helper, which seeds `byLocale[sourceLocale]` with the real input and leaves the rest as `{ name: '' }`). If `sourceLocale === 'UZ'` and AI failed, `uzName` is the real typed name — good. If `sourceLocale === 'OZ'` and AI failed, `uzName` is `''` (empty), so the branch correctly falls through to the Cyrillic-transliteration case.

`import { AiTranslationService } from '../ai/ai.service';`, `import { createWithUniqueSlug, slugCandidates, toAsciiSlug, transliterateCyrillicToLatin } from '../common/slug';`, `import { LOCALES, type Locale } from '../ai/translation-schema';` at the top.

- [ ] **Step 6: `update()` — never touch slug/id, never auto-retranslate**

```typescript
async update(id: string, dto: UpdateProductDto, actorId: string) {
  const before = await this.getOrThrow(id);
  const { stock, ...write } = dto;
  // slug/id are immutable after create (spec #6) — there is no `slug` field
  // on UpdateProductDto any more, so nothing to strip; this comment marks
  // the invariant for the next person who's tempted to add one back.
  const after = await this.prisma.product.update({ where: { id }, data: write as Prisma.ProductUncheckedUpdateInput }).catch((error: unknown) => translateWriteError(error));
  if (stock !== undefined) await this.setCatalogStock(id, await this.catalogWarehouseId(), stock);
  await this.audit.record({ userId: actorId, action: AuditAction.UPDATE, entityType: 'Product', entityId: id, before: auditSnapshot(before), after: auditSnapshot(after) });
  return after;
}
```

- [ ] **Step 7: New `retranslate()` method + endpoint**

```typescript
async retranslate(id: string, overwriteLocales: Locale[], actorId: string) {
  const before = await this.getOrThrow(id);
  const result = await this.ai.translate({
    sourceLocale: before.sourceLocale as Locale,
    fields: { name: (before as any)[`name${capitalize(before.sourceLocale)}`], description: (before as any)[`description${capitalize(before.sourceLocale)}`] },
    domainHint: 'product',
  });
  const data: Prisma.ProductUncheckedUpdateInput = { translationStatus: result.status };
  for (const locale of overwriteLocales) {
    const suffix = capitalize(locale);
    (data as any)[`name${suffix}`] = result.byLocale[locale]?.name ?? '';
    (data as any)[`description${suffix}`] = result.byLocale[locale]?.description ?? '';
  }
  const after = await this.prisma.product.update({ where: { id }, data });
  await this.audit.record({ userId: actorId, action: AuditAction.UPDATE, entityType: 'Product', entityId: id, before: auditSnapshot(before), after: auditSnapshot(after) });
  return after;
}
```
(`capitalize('UZ') → 'Uz'` — a small local helper: `const capitalize = (l: string) => l[0] + l.slice(1).toLowerCase();`.) `overwriteLocales` is exactly which locales the frontend confirmed overwriting in the "Qayta tarjima qilish" warning dialog (Task 8) — locales the director hand-edited and did *not* confirm are left alone.

In `products.controller.ts`, add:
```typescript
@Post(':id/retranslate')
retranslate(@Param('id') id: string, @CurrentUser('id') actorId: string, @Body() dto: RetranslateDto) {
  return this.products.retranslate(id, dto.overwriteLocales, actorId);
}
```
with a small `RetranslateDto { @IsArray() @IsIn(['UZ','OZ','RU','EN','ZH'], { each: true }) overwriteLocales: Locale[] }` in `dto/retranslate.dto.ts`.

Register `AiModule` as an import in `products.module.ts` so `AiTranslationService` is injectable.

- [ ] **Step 8: Run tests, tsc, lint**

Run: `cd backend && npx jest src/products && npx tsc --noEmit && npx eslint src/products`
Expected: all green. Fix any typing fallout from `UpdateProductDto`'s new shape.

- [ ] **Step 9: Commit**

```bash
git add backend/src/products backend/src/app.module.ts
git commit -m "feat(products): server-side slug generation, AI translate-on-create, immutable slug on update"
```

---

## Task 5: `CategoriesService` + `BrandsService` — same treatment

**Files:**
- Modify: `backend/src/categories/categories.service.ts`, `dto/create-category.dto.ts`, `dto/update-category.dto.ts`, `categories.controller.ts`, `categories.module.ts`
- Modify: `backend/src/brands/brands.service.ts`, `dto/create-brand.dto.ts`, `dto/update-brand.dto.ts`, `brands.controller.ts`, `brands.module.ts`
- Test: `categories.service.spec.ts`, `brands.service.spec.ts` (extend, mirroring Task 4 Step 3's test shapes)

**Interfaces:**
- Consumes: same `AiTranslationService`, `createWithUniqueSlug`/`slugCandidates`/`toAsciiSlug` as Task 4.

- [ ] **Step 1: `CategoriesService`**

Same shape as Task 4: `CreateCategoryDto` drops `slug`/`nameUz`/`nameRu`/`nameEn`, gains `sourceLocale`/`name`/`translations?`. `assertSlugFree` is deleted — `createWithUniqueSlug` replaces the check-then-insert pattern. `update()` drops the `dto.slug ? assertSlugFree : skip` branch entirely (slug is no longer on `UpdateCategoryDto` — this is the fix noted in the Decisions section). Category has no `description` field, so `AiTranslationService.translate()` is called with `fields: { name }` only, `domainHint: 'category'`. Slug base: same `EN → UZ → transliterated-source` fallback chain as Product, but category has no OEM/model to use as a disambiguator, so `slugCandidates(base, [])` — collisions fall straight to `-2`, `-3`, ... (categories are a small, curated tree; a genuine name collision needing a smarter suffix is not expected).

- [ ] **Step 2: `BrandsService`**

`CreateBrandDto` drops `name`/`slug`, gains `sourceLocale`/`name` (source-locale display name)/`translations?`, keeps `logoUrl?`. `AiTranslationService.translate()` called with `domainHint: 'brand'` (triggers the transliteration-not-translation prompt branch from Task 3). On create, write both the legacy `name` column (= `byLocale.UZ.name`, per the Decisions section's mirroring rule) and all 5 `name{Locale}` columns. `assertNameFree` changes from checking `Brand.name` to checking `Brand.nameUz` (same non-unique-column, app-level-uniqueness semantics as today). `update()` never accepts a `slug`/`id` field (none exists on the DTO) — this closes the same footgun as Category.

- [ ] **Step 3: Write tests, verify failure, implement, verify pass**

Follow Task 4 Steps 3–6's pattern exactly, adapted to these two services' existing spec files' mocking conventions — one test each for: slug derived from EN-then-UZ-then-transliterated-source, AI failure still creates the row as `FAILED`, caller-supplied `translations` skips the AI call, and a slug collision retries.

Run: `cd backend && npx jest src/categories src/brands && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add backend/src/categories backend/src/brands
git commit -m "feat(categories,brands): server-side slug generation and AI translate-on-create"
```

---

## Task 6: Frontend schemas rework

**Files:**
- Modify: `frontend/lib/schemas.ts`
- Test: `frontend/lib/schemas.test.ts` (extend)

**Interfaces:**
- Produces: `productWriteSchema` (reworked), `categoryWriteSchema` (reworked, was previously untyped/inline — check `category-manager.tsx`'s existing local schema and formalize it here for consistency with `productWriteSchema`), new `brandWriteSchema`. All three share a `translationEntrySchema = z.object({ name: z.string(), description: z.string().optional() })` and a `sourceLocaleSchema = z.enum(['uz', 'oz', 'ru', 'en', 'zh'])` (lowercase on the frontend — mapped to the backend's uppercase `Locale` at the repository layer, matching how `product-write-repository.ts` already remaps every other field name).

- [ ] **Step 1: Write the failing tests**

```typescript
// frontend/lib/schemas.test.ts — additions
describe('productWriteSchema (5-language rework)', () => {
  it('requires only the source-locale name, not all five', () => {
    const result = productWriteSchema.safeParse({
      sku: 'X1', sourceLocale: 'uz', name: "Yoqilg'i filtri", description: '',
      oemNumbers: [], price: null, stock: 0, minStock: 0, categoryId: 'c1', brandId: 'b1',
      compatibleModels: [], specs: [], isActive: true,
    });
    expect(result.success).toBe(true);
  });

  it('rejects an empty source-locale name', () => {
    const result = productWriteSchema.safeParse({
      sku: 'X1', sourceLocale: 'uz', name: '', oemNumbers: [], price: null, stock: 0, minStock: 0,
      categoryId: 'c1', brandId: 'b1', compatibleModels: [], specs: [], isActive: true,
    });
    expect(result.success).toBe(false);
  });

  it('no longer accepts or requires a slug field', () => {
    const shape = productWriteSchema.shape as Record<string, unknown>;
    expect(shape.slug).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd frontend && npx vitest run lib/schemas.test.ts`
Expected: FAIL against the current 3-language-required schema.

- [ ] **Step 3: Implement**

```typescript
// frontend/lib/schemas.ts — replace localizedSchema usage in productWriteSchema
export const sourceLocaleSchema = z.enum(['uz', 'oz', 'ru', 'en', 'zh']);
export type SourceLocale = z.infer<typeof sourceLocaleSchema>;

export const translationEntrySchema = z.object({
  name: z.string(),
  description: z.string().optional(),
});
export const translationsSchema = z.object({
  uz: translationEntrySchema, oz: translationEntrySchema, ru: translationEntrySchema,
  en: translationEntrySchema, zh: translationEntrySchema,
});
export type Translations = z.infer<typeof translationsSchema>;

export const productWriteSchema = z.object({
  sku: z.string().min(1).max(64),
  sourceLocale: sourceLocaleSchema,
  name: z.string().min(1),
  description: z.string().optional(),
  /** Present once the director has run "AI bilan tekshirish" and reviewed
   *  the result (or on an existing product being re-edited) — all 5 filled. */
  translations: translationsSchema.partial().optional(),
  translationStatus: z.enum(['PENDING', 'COMPLETE', 'FAILED']).optional(),
  oemNumbers: z.array(z.string().min(1)).max(20),
  price: z.number().nonnegative().nullable(),
  stock: z.number().int().min(0).max(1_000_000),
  minStock: z.number().int().min(0).max(1_000_000),
  categoryId: z.string().min(1),
  brandId: z.string().min(1),
  compatibleModels: z.array(z.string().min(1)).max(50),
  specs: z.array(productSpecSchema).max(30),
  isActive: z.boolean(),
});
export type ProductWriteInput = z.infer<typeof productWriteSchema>;

export const categoryWriteSchema = z.object({
  sourceLocale: sourceLocaleSchema,
  name: z.string().min(1).max(120),
  translations: translationsSchema.partial().optional(),
  translationStatus: z.enum(['PENDING', 'COMPLETE', 'FAILED']).optional(),
  type: z.string().min(1).optional(),
  parentId: z.string().min(1).nullable(),
  icon: z.string().optional(),
  order: z.number().int().optional(),
});
export type CategoryWriteInput = z.infer<typeof categoryWriteSchema>;

export const brandWriteSchema = z.object({
  sourceLocale: sourceLocaleSchema,
  name: z.string().min(1).max(120),
  translations: translationsSchema.partial().optional(),
  translationStatus: z.enum(['PENDING', 'COMPLETE', 'FAILED']).optional(),
  logoUrl: z.string().optional(),
});
export type BrandWriteInput = z.infer<typeof brandWriteSchema>;
```
Remove the old `slug` field and its regex from `productWriteSchema` entirely (the slug is never client-supplied now — `product-form-modal.tsx`'s slug `Input` becomes a read-only display, Task 8). `productSpecSchema`/`localizedSchema` for spec labels stay exactly as they are (Decision 4 — out of scope).

Check `category-manager.tsx`'s current inline form-validation logic before this step (it may not use a formal Zod schema today, given no `categoryWriteSchema` existed in `schemas.ts` before) — if it validates ad hoc, this new `categoryWriteSchema` replaces that ad hoc logic in Task 9, not here; this task only adds the schema.

- [ ] **Step 4: Run to verify pass**

Run: `cd frontend && npx vitest run lib/schemas.test.ts`
Expected: PASS.

- [ ] **Step 5: Full frontend typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: errors surface in every file importing the old `ProductWriteInput` shape (`product-form-modal.tsx`, `product-write-repository.ts`) — expected, fixed in Tasks 7–8. Note the list, do not fix here.

- [ ] **Step 6: Commit**

```bash
git add frontend/lib/schemas.ts frontend/lib/schemas.test.ts
git commit -m "feat(schemas): single-source-locale product/category/brand write schemas"
```

---

## Task 7: AI-translate frontend plumbing (repository, hook, shared button component)

**Files:**
- Create: `frontend/lib/api/ai-translate-repository.ts`, `frontend/hooks/admin/use-ai-translate.ts`, `frontend/components/admin/ai-translate-button.tsx`
- Test: `frontend/lib/api/ai-translate-repository.test.ts`, `frontend/components/admin/ai-translate-button.test.tsx`

**Interfaces:**
- Produces: `translateFields(input: { sourceLocale: SourceLocale; name: string; description?: string; domainHint: 'product'|'category'|'brand' }): Promise<TranslateResult>` where `TranslateResult = { status: 'COMPLETE'|'FAILED'; corrections: Array<{field: 'name'|'description'; before: string; after: string}>; translations: Translations }`.
- `useAiTranslate()` — a React Query mutation wrapping it.
- `<AiTranslateButton onResult={(r: TranslateResult) => void} sourceLocale name description domainHint />` — button + loading spinner + corrections list, used identically by product/category/brand forms.

- [ ] **Step 1: Repository, with its test**

```typescript
// frontend/lib/api/ai-translate-repository.ts
import "server-only";
import { backendRequest } from "./backend-client";
import { getStaffSession } from "@/lib/auth/staff-session";
import type { SourceLocale, Translations } from "@/lib/schemas";

const LOCALE_TO_BACKEND: Record<SourceLocale, string> = { uz: "UZ", oz: "OZ", ru: "RU", en: "EN", zh: "ZH" };
const BACKEND_TO_LOCALE: Record<string, keyof Translations> = { UZ: "uz", OZ: "oz", RU: "ru", EN: "en", ZH: "zh" };

export interface TranslateResult {
  status: "COMPLETE" | "FAILED";
  corrections: Array<{ field: "name" | "description"; before: string; after: string }>;
  translations: Translations;
}

export async function translateFields(input: {
  sourceLocale: SourceLocale;
  name: string;
  description?: string;
  domainHint: "product" | "category" | "brand";
}): Promise<TranslateResult> {
  const session = await getStaffSession();
  const response = await backendRequest<{
    status: "COMPLETE" | "FAILED";
    corrections: Array<{ field: "name" | "description"; before: string; after: string }>;
    byLocale: Record<string, { name: string; description?: string }>;
  }>("/ai/products/translate", {
    method: "POST",
    accessToken: session?.accessToken,
    body: {
      sourceLocale: LOCALE_TO_BACKEND[input.sourceLocale],
      name: input.name,
      description: input.description,
      domainHint: input.domainHint,
    },
  });

  const translations = {} as Translations;
  for (const [backendLocale, entry] of Object.entries(response.byLocale)) {
    const locale = BACKEND_TO_LOCALE[backendLocale];
    if (locale) translations[locale] = { name: entry.name, description: entry.description };
  }
  return { status: response.status, corrections: response.corrections, translations };
}
```

This repository function is `server-only` (matches every other file in `frontend/lib/api/`) — it is called from a Next.js Route Handler, not directly from the client component. Add that route: `frontend/app/api/v1/ai/translate/route.ts`, a thin `POST` handler that reads the JSON body, calls `translateFields`, and returns JSON — mirroring the existing pattern in `frontend/app/api/v1/products/[id]/route.ts` for auth/error handling.

```typescript
// frontend/lib/api/ai-translate-repository.test.ts
import { describe, expect, it, vi } from "vitest";
vi.mock("./backend-client", () => ({ backendRequest: vi.fn() }));
vi.mock("@/lib/auth/staff-session", () => ({ getStaffSession: vi.fn().mockResolvedValue({ accessToken: "t" }) }));
import { backendRequest } from "./backend-client";
import { translateFields } from "./ai-translate-repository";

it("maps backend locale codes to lowercase frontend keys", async () => {
  vi.mocked(backendRequest).mockResolvedValue({
    status: "COMPLETE", corrections: [],
    byLocale: { UZ: { name: "a" }, OZ: { name: "b" }, RU: { name: "c" }, EN: { name: "d" }, ZH: { name: "e" } },
  });
  const result = await translateFields({ sourceLocale: "uz", name: "a", domainHint: "product" });
  expect(result.translations.en.name).toBe("d");
  expect(result.translations.zh.name).toBe("e");
});

it("sends the uppercase locale code to the backend", async () => {
  vi.mocked(backendRequest).mockResolvedValue({ status: "COMPLETE", corrections: [], byLocale: {} });
  await translateFields({ sourceLocale: "oz", name: "x", domainHint: "category" });
  expect(vi.mocked(backendRequest)).toHaveBeenCalledWith("/ai/products/translate", expect.objectContaining({ body: expect.objectContaining({ sourceLocale: "OZ" }) }));
});
```

Run: `cd frontend && npx vitest run lib/api/ai-translate-repository.test.ts` — FAIL then PASS after implementing.

- [ ] **Step 2: Hook**

```typescript
// frontend/hooks/admin/use-ai-translate.ts
import { useMutation } from "@tanstack/react-query";
import type { SourceLocale } from "@/lib/schemas";
import type { TranslateResult } from "@/lib/api/ai-translate-repository";

export function useAiTranslate() {
  return useMutation({
    mutationFn: async (input: { sourceLocale: SourceLocale; name: string; description?: string; domainHint: "product" | "category" | "brand" }): Promise<TranslateResult> => {
      const response = await fetch("/api/v1/ai/translate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
  });
}
```
(Follow whatever exact fetch-wrapper convention `hooks/admin/use-admin-products.ts` already uses for its mutations — read that file first and match its error handling rather than inventing a new one; the sketch above is the logical shape, not necessarily the literal code.)

- [ ] **Step 3: Shared button component, with its test**

```typescript
// frontend/components/admin/ai-translate-button.tsx
"use client";
import { useState } from "react";
import { Sparkles } from "lucide-react";
import { useAiTranslate } from "@/hooks/admin/use-ai-translate";
import type { SourceLocale, Translations } from "@/lib/schemas";
import { Icon } from "@/components/ui/icon";

export function AiTranslateButton({
  sourceLocale, name, description, domainHint, onResult,
}: {
  sourceLocale: SourceLocale;
  name: string;
  description?: string;
  domainHint: "product" | "category" | "brand";
  onResult: (result: { status: "COMPLETE" | "FAILED"; translations: Translations; corrections: Array<{ field: string; before: string; after: string }> }) => void;
}) {
  const translate = useAiTranslate();
  const [corrections, setCorrections] = useState<Array<{ field: string; before: string; after: string }>>([]);

  async function run() {
    const result = await translate.mutateAsync({ sourceLocale, name, description, domainHint });
    setCorrections(result.corrections);
    onResult(result);
  }

  return (
    <div className="space-y-2">
      <button type="button" onClick={run} disabled={translate.isPending || !name.trim()} className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-surface-hover disabled:opacity-50">
        <Icon icon={Sparkles} size="sm" />
        {translate.isPending ? "Tekshirilmoqda…" : "AI bilan tekshirish va tarjima"}
      </button>
      {corrections.length > 0 ? (
        <ul className="space-y-1 text-xs text-muted">
          {corrections.map((c, i) => (
            <li key={i}>
              <span className="font-medium">{c.field}:</span> {c.before} → {c.after}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
```

```typescript
// frontend/components/admin/ai-translate-button.test.tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AiTranslateButton } from "./ai-translate-button";
vi.mock("@/hooks/admin/use-ai-translate", () => ({
  useAiTranslate: () => ({ isPending: false, mutateAsync: vi.fn().mockResolvedValue({ status: "COMPLETE", corrections: [{ field: "name", before: "x", after: "y" }], translations: {} }) }),
}));

it("shows corrections and calls onResult after a successful translate", async () => {
  const onResult = vi.fn();
  render(<AiTranslateButton sourceLocale="uz" name="x" domainHint="product" onResult={onResult} />);
  fireEvent.click(screen.getByText("AI bilan tekshirish va tarjima"));
  await waitFor(() => expect(onResult).toHaveBeenCalled());
  expect(screen.getByText(/x → y/)).toBeInTheDocument();
});

it("disables the button when name is empty", () => {
  render(<AiTranslateButton sourceLocale="uz" name="" domainHint="product" onResult={vi.fn()} />);
  expect(screen.getByText("AI bilan tekshirish va tarjima")).toBeDisabled();
});
```

Run: `cd frontend && npx vitest run components/admin/ai-translate-button.test.tsx` — FAIL then PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/lib/api/ai-translate-repository.ts frontend/hooks/admin/use-ai-translate.ts frontend/components/admin/ai-translate-button.tsx frontend/app/api/v1/ai frontend/lib/api/ai-translate-repository.test.ts frontend/components/admin/ai-translate-button.test.tsx
git commit -m "feat(admin): AI translate repository, hook, and shared button component"
```

---

## Task 8: `product-form-modal.tsx` rework

**Files:**
- Modify: `frontend/components/admin/product-form-modal.tsx`, `frontend/lib/api/product-write-repository.ts`
- Test: no new spec file exists for this component today (confirmed by its absence in the file list) — add `frontend/components/admin/product-form-modal.test.tsx` covering the two behavioral changes that matter most: single-locale-required validation, and the retranslate confirmation gate.

**Interfaces:**
- Consumes: `AiTranslateButton` (Task 7), `productWriteSchema`/`SourceLocale`/`Translations` (Task 6).
- Produces: same external props (`ProductFormModalProps` unchanged) — this is a rewrite of internals, not the public interface.

- [ ] **Step 1: `toBody()` in `product-write-repository.ts`**

```typescript
function toBody(input: ProductWriteInput) {
  return {
    sku: input.sku.trim().toUpperCase(),
    oemNumbers: input.oemNumbers.map((oem) => oem.trim().toUpperCase()),
    sourceLocale: input.sourceLocale.toUpperCase(),
    name: input.name,
    description: input.description,
    translations: input.translations
      ? Object.fromEntries(Object.entries(input.translations).map(([k, v]) => [k.toUpperCase(), v]))
      : undefined,
    price: input.price,
    stock: input.stock,
    minStock: input.minStock,
    categoryId: input.categoryId,
    brandId: input.brandId,
    compatibleModels: input.compatibleModels,
    specs: input.specs,
    isActive: input.isActive,
  };
}
```
`getProductForEdit()`'s `BackendEditRow` gains `nameOz`/`nameZh`/`descriptionOz`/`descriptionZh`/`sourceLocale`/`translationStatus`, and its return maps them into a `translations` object keyed by lowercase locale (mirroring the mapping already done in Task 7's repository) plus top-level `name`/`description`/`sourceLocale` set from whichever locale the row's `sourceLocale` says is authoritative.

- [ ] **Step 2: Write the component tests first**

```typescript
// frontend/components/admin/product-form-modal.test.tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ProductFormModal } from "./product-form-modal";
// mock useCreateProduct/useUpdateProduct/useReplaceProductImage as no-ops, following
// whatever mocking pattern this codebase's other admin-modal tests already use
// (check components/admin/review-queue.test.tsx or category-manager.test.tsx first).

it("only requires the source-locale name field, not ru/en", () => {
  render(<ProductFormModal open onOpenChange={vi.fn()} categories={[]} brands={[]} />);
  fireEvent.click(screen.getByText("Mahsulot qo'shish"));
  expect(screen.queryByText(/Ruscha.*required/i)).not.toBeInTheDocument();
});

it("shows a confirmation before Qayta tarjima qilish overwrites a hand-edited locale", () => {
  // render with `initial` where translations.ru.name differs from what a fresh
  // retranslate would produce (simulated via a dirty-locale flag the component tracks);
  // click "Qayta tarjima qilish"; expect a confirm dialog naming "ru" before it fires.
});
```
(These two tests pin the two behaviors the Review Focus section calls out for this task — exact selectors/mocking to be filled in against the component as actually written in Step 3, since the precise DOM structure isn't fixed yet.)

- [ ] **Step 3: Rewrite the form**

Key structural changes to `product-form-modal.tsx`:
- `EMPTY` becomes `{ sku: "", sourceLocale: "uz", name: "", description: "", translations: undefined, ... }` (no `slug`).
- Add a "Kiritish tili" `<select>` (or reuse `Combobox`) bound to `form.sourceLocale`, options uz/oz/ru/en/zh, default `"uz"` — matches spec §12.
- The "Nomi"/"Tavsif" `Group`s become: one required `Input`/`Textarea` bound to `form.name`/`form.description` (the *source*-locale value), followed by an `AiTranslateButton` (Task 7), followed by 4 tabs (or a simple 4-column grid, matching the existing 3-column layout's visual weight) for the *other* 4 locales, each optional-but-editable, pulling from `form.translations?.[locale]`.
- `AiTranslateButton`'s `onResult` callback: `setForm({ ...form, translations: result.translations, name: result.translations[form.sourceLocale].name })` — this is the "manba maydonlar tuzatilgan matn bilan yangilanadi" behavior from spec §13 (the corrected source text replaces what the director typed).
- The "Slug (URL)" `FormField` in the "Identifikatsiya" group becomes read-only, populated only once the product exists (`productId` present, showing `initial?.slug`); on create, replace it with static help text: `"Slug avtomatik yaratiladi"`.
- Track which of the 4 non-source locales the director has manually edited since the last AI run, in a `dirtyLocales: Set<SourceLocale>` piece of state (set on any `onChange` to a translation-tab field). A new "Qayta tarjima qilish" button (visible only when `productId` is set — retranslating only makes sense on an existing product) calls `POST /products/:id/retranslate`; if `dirtyLocales` is non-empty, first show a confirm dialog listing those locales ("Quyidagi tillar qo'lda tahrirlangan: ru, en. Ustidan yozilsinmi?") before sending `overwriteLocales` (all 5 minus source if confirmed "hammasi", or only the untouched ones if declined — exact UX choice: default to overwriting only non-dirty locales unless the director explicitly confirms "hammasini almashtirish").
- `specsIncomplete` validation, OEM/compatible-models fields, price/stock fields, image field: unchanged.
- `field.errorFor("name." + lang)` style per-locale error lookups (used for the old 3-tab required validation) are removed; only `field.errorFor("name")` (the single source field) remains required.

- [ ] **Step 4: Run tests, verify pass**

Run: `cd frontend && npx vitest run components/admin/product-form-modal.test.tsx`

- [ ] **Step 5: Full frontend check**

Run: `cd frontend && npx tsc --noEmit && npx eslint components/admin/product-form-modal.tsx lib/api/product-write-repository.ts && npx vitest run`
Expected: all green; this is the point where Task 6 Step 5's deferred tsc errors get resolved.

- [ ] **Step 6: Manual browser verification**

Per this project's standing instruction to verify UI changes in a real browser before declaring done: start the dev server (`cd frontend && npm run dev`), sign in as a MANAGER_UP staff user, open `/director/products`, open "Yangi mahsulot qo'shish", fill only the uz name, click "AI bilan tekshirish va tarjima", confirm the 4 other tabs populate and corrections (if any) display, save, confirm the product appears in the list with a generated slug. Also open an existing product for edit and confirm the slug field is read-only and unaffected by save.

- [ ] **Step 7: Commit**

```bash
git add frontend/components/admin/product-form-modal.tsx frontend/lib/api/product-write-repository.ts frontend/components/admin/product-form-modal.test.tsx
git commit -m "feat(admin): single-source-locale product form with AI translate and retranslate flow"
```

---

## Task 9: `category-manager.tsx` rework

**Files:**
- Modify: `frontend/components/admin/category-manager.tsx`, `frontend/components/admin/category-manager.test.tsx`, whichever `lib/api/*.ts` file holds `createCategory`/`updateCategory` (confirm exact path — likely `catalog-repository.ts` per the file list gathered in research; if it turns out to be elsewhere, that's the file to modify instead).

**Interfaces:**
- Consumes: `AiTranslateButton`, `categoryWriteSchema` (Tasks 6–7).

- [ ] **Step 1–4: Mirror Task 8's steps exactly**, scaled to Category's simpler shape (no description field, no image, no stock/price):
  - Add "Kiritish tili" selector.
  - Replace the current always-3-tabs `name.uz`/`name.ru`/`name.en` inputs (seen in research: `name: { ...current.name, uz: value }` etc.) with one required source-locale input + `AiTranslateButton` + 4 optional tabs.
  - The existing client-side `slugify(value)` call (`frontend/lib/catalog-tree.ts`) that live-previews the slug as the director types stays as a *preview only* — update its comment to say so — but the actual submitted payload carries no `slug` field at all (backend derives it, per Task 5).
  - Slug display in the edit view (`category.slug` shown read-only, per the existing `/{category.slug}` rendering already in the list) is unaffected — it already only ever displays, never edits, an existing category's slug.
  - Write the two pinned tests (single-locale-required validation; a slug-collision case is less relevant here since it's server-side now, so this task's second test instead covers: editing an existing category's `ru` tab and saving does not touch `slug`).

- [ ] **Step 5: Run tests, tsc, eslint**

Run: `cd frontend && npx vitest run components/admin/category-manager.test.tsx && npx tsc --noEmit && npx eslint components/admin/category-manager.tsx`

- [ ] **Step 6: Manual browser verification**

Open `/director/categories` (or wherever `category-manager.tsx` is mounted — confirm the route during implementation), create a category with only a uz name, run AI translate, save, confirm it appears correctly in the tree.

- [ ] **Step 7: Commit**

```bash
git add frontend/components/admin/category-manager.tsx frontend/components/admin/category-manager.test.tsx frontend/lib/api/catalog-repository.ts
git commit -m "feat(admin): single-source-locale category form with AI translate"
```

---

## Task 10: New Brand admin UI

**Files:**
- Create: `frontend/components/admin/brand-manager.tsx`, `frontend/app/director/(panel)/brands/page.tsx`, `frontend/hooks/admin/use-admin-brands.ts`, `frontend/lib/api/brand-write-repository.ts`
- Modify: `frontend/components/admin/panel-sidebar.tsx` (add nav entry)
- Test: `frontend/components/admin/brand-manager.test.tsx`, `frontend/lib/api/brand-write-repository.test.ts`

**Interfaces:**
- Produces: `createBrand`/`updateBrand`/`listBrandsForAdmin` in `brand-write-repository.ts`, mirroring `product-write-repository.ts`'s `WriteResult<T>` union exactly (reuse that type, don't redefine it).
- `<BrandManager />` — same list-plus-modal shape as `category-manager.tsx`, minus the tree/parent concepts (brands are a flat list).

- [ ] **Step 1: Repository**

Model this directly on `product-write-repository.ts`'s `createProduct`/`updateProduct`/`listProductsForAdmin` functions (same `WriteResult<T>` handling, same `writeFailure()` 409/400 mapping), scoped to `/brands`:
```typescript
export interface AdminBrandRow { id: string; slug: string; name: string; nameOz: string | null; nameRu: string | null; nameEn: string | null; nameZh: string | null; sourceLocale: string; translationStatus: "PENDING"|"COMPLETE"|"FAILED"; logoUrl: string | null; }
export async function listBrandsForAdmin(): Promise<AdminBrandRow[]> { /* GET /brands, accessToken from getStaffSession() */ }
export async function createBrand(input: BrandWriteInput): Promise<WriteResult<{ id: string }>> { /* POST /brands */ }
export async function updateBrand(id: string, input: BrandWriteInput): Promise<WriteResult<{ id: string }>> { /* PATCH /brands/:id */ }
export async function deleteBrand(id: string): Promise<WriteResult<{ id: string }>> { /* DELETE /brands/:id */ }
```

- [ ] **Step 2: Hook**

`use-admin-brands.ts` — `useAdminBrands()` (React Query `useQuery`), `useCreateBrand()`/`useUpdateBrand()`/`useDeleteBrand()` (mutations invalidating the brands query key), mirroring whatever `hooks/admin/use-admin-categories.ts` does structurally (read that file first and match its exact React Query setup — query keys, `staleTime`, invalidation calls — rather than inventing new conventions).

- [ ] **Step 3: `BrandManager` component**

A trimmed `category-manager.tsx`: table (name, slug, logo thumbnail, translation-status badge, edit/delete actions) + a form modal (source-locale selector, name input, `AiTranslateButton`, 4 translation tabs, logo-URL field). No parent/tree UI. Route it at `frontend/app/director/(panel)/brands/page.tsx`, a thin server component that fetches the reference data (or none, if the list loads client-side via the hook — match whatever `frontend/app/director/(panel)/products/page.tsx` does for its top-level data-loading pattern) and renders `<BrandManager />`.

- [ ] **Step 4: Sidebar nav entry**

In `panel-sidebar.tsx`, add a "Brendlar" entry next to the existing "Kategoriyalar"/"Mahsulotlar" entries, linking to `/director/brands`, gated the same way those existing entries are (check what role-gating, if any, wraps them today and match it).

- [ ] **Step 5: Tests**

Mirror `category-manager.test.tsx`'s structure: renders the list, opens the create modal, requires only the source-locale name, calls `createBrand` on submit. Run: `cd frontend && npx vitest run components/admin/brand-manager.test.tsx lib/api/brand-write-repository.test.ts` — write failing first, then implement Steps 1–4, then re-run for PASS.

- [ ] **Step 6: tsc, eslint, manual browser check**

Run: `cd frontend && npx tsc --noEmit && npx eslint frontend/components/admin/brand-manager.tsx frontend/lib/api/brand-write-repository.ts`
Then open `/director/brands` in a real browser session, create a brand, confirm it appears and is selectable in the product form's brand `Combobox`.

- [ ] **Step 7: Commit**

```bash
git add frontend/components/admin/brand-manager.tsx frontend/app/director/\(panel\)/brands frontend/hooks/admin/use-admin-brands.ts frontend/lib/api/brand-write-repository.ts frontend/components/admin/panel-sidebar.tsx
git commit -m "feat(admin): new Brand management UI (list, create/edit, AI translate)"
```

---

## Task 11: Backfill script

**Files:**
- Create: `backend/scripts/backfill-translations.ts`
- Test: none (matches `smoke-order-seller-fk.ts`'s convention — a manual script, not unit-tested; it is exercised via `--dry-run` against a real dev database instead).

**Interfaces:**
- Consumes: `AiTranslationService` (instantiated directly, not through Nest DI, matching `smoke-order-seller-fk.ts`'s style of a bare `PrismaClient` — or, simpler, construct `AiTranslationService` with a hand-rolled `ConfigService`-shaped object reading `process.env` directly, to avoid bootstrapping the whole Nest app for a script).

- [ ] **Step 1: Implement**

```typescript
// backend/scripts/backfill-translations.ts
/**
 * Fills nameOz/nameZh (and descriptionOz/descriptionZh on Product) for every
 * Product/Category/Brand row where they are still NULL, via Gemini. Never
 * touches existing uz/ru/en data.
 *
 * Run:  npx tsx scripts/backfill-translations.ts [--dry-run] [--batch-size=20]
 * Resumable: re-running only ever selects rows still missing oz/zh, so an
 * interrupted run picks up wherever it left off with no separate checkpoint file.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { AiTranslationService } from '../src/ai/ai.service';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
const ai = new AiTranslationService({
  getOrThrow: (key: string) => { const v = process.env[key]; if (!v) throw new Error(`Missing env ${key}`); return v; },
  get: (key: string) => process.env[key],
} as any);

const dryRun = process.argv.includes('--dry-run');
const batchSizeArg = process.argv.find((a) => a.startsWith('--batch-size='));
const batchSize = batchSizeArg ? Number(batchSizeArg.split('=')[1]) : 20;
const DELAY_BETWEEN_CALLS_MS = 1200; // stays comfortably under Gemini's free-tier RPM

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

async function backfillProducts() {
  let cursor: string | undefined;
  let total = 0;
  while (true) {
    const rows = await prisma.product.findMany({
      where: { OR: [{ nameOz: null }, { nameZh: null }] },
      take: batchSize,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { id: 'asc' },
    });
    if (rows.length === 0) break;
    for (const row of rows) {
      const sourceLocale = row.sourceLocale as 'UZ' | 'OZ' | 'RU' | 'EN' | 'ZH';
      const sourceField = { UZ: 'Uz', OZ: 'Oz', RU: 'Ru', EN: 'En', ZH: 'Zh' }[sourceLocale];
      const name = (row as any)[`name${sourceField}`] || row.nameUz;
      const description = (row as any)[`description${sourceField}`] || row.descriptionUz;
      console.log(`${dryRun ? '[dry-run] ' : ''}Product ${row.id}: translating from ${sourceLocale}`);
      if (!dryRun) {
        const result = await ai.translate({ sourceLocale, fields: { name, description }, domainHint: 'product' });
        await prisma.product.update({
          where: { id: row.id },
          data: {
            nameOz: row.nameOz ?? result.byLocale.OZ?.name,
            nameZh: row.nameZh ?? result.byLocale.ZH?.name,
            descriptionOz: row.descriptionOz ?? result.byLocale.OZ?.description,
            descriptionZh: row.descriptionZh ?? result.byLocale.ZH?.description,
            translationStatus: result.status,
          },
        });
        await sleep(DELAY_BETWEEN_CALLS_MS);
      }
      total += 1;
    }
    cursor = rows[rows.length - 1].id;
  }
  console.log(`Products: ${total} rows processed.`);
}

// backfillCategories() and backfillBrands() follow the identical shape —
// same cursor pagination, same OR-null-check, same dry-run gate — scoped to
// { nameOz: null } OR { nameZh: null } on Category, and Brand respectively
// (Brand's fields also touch nameRu/nameEn if still null, since Brand start
// nullable per Task 1).

async function main() {
  await backfillProducts();
  // await backfillCategories();
  // await backfillBrands();
  await prisma.$disconnect();
}

main().catch((error) => { console.error(error); process.exit(1); });
```
(The comment stubs for `backfillCategories`/`backfillBrands` are filled in as full functions during implementation — identical structure to `backfillProducts`, adjusted field names; omitted here only to keep this plan's code block from repeating itself three times.)

- [ ] **Step 2: Manual dry-run verification**

Run: `cd backend && npx tsx scripts/backfill-translations.ts --dry-run --batch-size=5`
Expected: prints the rows it *would* translate, touches nothing. Confirm row count roughly matches `SELECT count(*) FROM "Product" WHERE "nameOz" IS NULL OR "nameZh" IS NULL` run manually against dev DB.

- [ ] **Step 3: Small real run against dev DB**

Run: `cd backend && npx tsx scripts/backfill-translations.ts --batch-size=3` (no `--dry-run`, capped small) against local dev DB only — **never against the Railway production database directly, per this project's standing `docs/deploy-checklist.md` warning** (production backfill happens post-deploy, via the same script run against `DATABASE_URL` pointed at prod through Railway's own environment, not a locally-exported prod connection string).
Confirm 3 rows got real `nameOz`/`nameZh` values and `translationStatus: COMPLETE` (or `FAILED` with the source data intact, if Gemini genuinely failed on one).

- [ ] **Step 4: Commit**

```bash
git add backend/scripts/backfill-translations.ts
git commit -m "feat(scripts): resumable, rate-limited AI backfill for oz/zh translations"
```

---

## Task 12: Deploy checklist update

**Files:**
- Modify: `docs/deploy-checklist.md`

- [ ] **Step 1: Add a STATUS entry**

Append a new dated section documenting: the migration name (`20260925120000_catalog_i18n_translations`), the two new required env vars (`GEMINI_API_KEY`, `GEMINI_MODEL`) that must be set on Railway *before* the backend redeploy (AI calls will 500 without `GEMINI_API_KEY`, though creates/updates still succeed with `translationStatus: FAILED` — not a deploy blocker, but worth setting immediately), and the exact deploy order: `prisma migrate deploy` (Railway build step, already wired per existing STATUS notes) → backend redeploy → frontend redeploy → run `backfill-translations.ts` once against prod via Railway's internal `DATABASE_URL` (not a local proxy connection, per the file's existing warning banner).

- [ ] **Step 2: Commit**

```bash
git add docs/deploy-checklist.md
git commit -m "docs(deploy): record catalog-i18n migration, env vars, and deploy order"
```

---

## Task 13: Whole-branch verification

**Files:** none (verification only).

- [ ] **Step 1: Full backend suite**

Run: `cd backend && npx tsc --noEmit && npx eslint src && npx jest`
Expected: 0 errors, 0 lint violations, all tests pass (existing count + ~35 new tests across Tasks 2–5).

- [ ] **Step 2: Full frontend suite**

Run: `cd frontend && npx tsc --noEmit && npx eslint . && npx vitest run && npm run build`
Expected: 0 errors, 0 lint violations, all tests pass, production build succeeds.

- [ ] **Step 3: End-to-end manual pass in a real browser**

Using the browser tooling available in this session: sign in as a director, create one product uz-only → AI translate → verify all 5 tabs, verify the generated slug is ASCII, verify it appears correctly on the storefront product page (still rendering `nameUz`, per Decision 1 — confirm nothing broke there). Create one category and one brand the same way. Edit the product's `ru` tab by hand, then use "Qayta tarjima qilish" and confirm the warning names `ru` before overwriting. Turn off `GEMINI_API_KEY` (or point it at an invalid key) and confirm a create still succeeds with a visible `FAILED` badge and a working "Tarjimani qayta urinish" action.

- [ ] **Step 4: Report**

Summarize: what changed, why the key decisions (Decisions section above) were made, verification results (test counts, build status), and the one open item every session in this project's memory flags at the end — here: **storefront public-facing language switching (URL routing, hreflang tags) is intentionally not built by this plan and remains a separate future project.**
