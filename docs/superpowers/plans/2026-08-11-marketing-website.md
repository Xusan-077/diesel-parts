# DieselParts Marketing Website Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the full Phase 1 DieselParts marketing website (all pages, uz/ru/en locale routing, mock data, stub lead-capture forms) as specified in `docs/superpowers/specs/2026-08-11-marketing-website-design.md`.

**Architecture:** Single Next.js 16 App Router app (existing repo, no monorepo yet). Locale-prefixed routes under `app/[lang]/`, a `proxy.ts` for locale redirects, typed local mock data under `lib/data/`, a hand-written dictionary-based i18n layer (no `next-intl`), Tailwind v4 theme tokens for the dark Industrial Premium design system, and React Hook Form + Zod forms posting to local stub Route Handlers.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind v4, Radix UI (Dialog only), React Hook Form, Zod, Vitest (unit tests for logic-bearing modules), lucide-react (icons).

## Global Constraints

- Default locale `uz`; supported locales `uz`, `ru`, `en`. Every public route is locale-prefixed (spec §3).
- Route convention is `proxy.ts`, not `middleware.ts` (deprecated/renamed in Next.js 16, same behavior).
- `params` and `searchParams` in pages/layouts/route handlers are `Promise`s — always `await` them. Type them with explicit inline `Promise<{...}>` types (not the generated `PageProps<>`/`LayoutProps<>` helper) so code type-checks correctly regardless of whether `next typegen`/`next dev`/`next build` has run yet for a brand-new route literal. (The pre-existing root `app/layout.tsx` uses `LayoutProps<"/">` for the static `/` route — that file is deleted in Task 2, so this doesn't conflict.)
- Design tokens (spec §4): `--background: #0d0e11`, `--foreground/text-primary: #f5f5f5`, `--muted: #9ca3af`, `--border: #1f2126`, `--accent: #f77d2a`. Dark-first only — no light theme variant.
- Nav-specific palette constraint (spec §4.1): `Header`/`MobileNav` use only black (`#000000`), white (`#ffffff`), and the accent orange — no gray/border tokens inside those two components.
- No exact stock quantities anywhere in UI — only `available` / `limited` / `out_of_stock` status.
- No auth in this phase — every product always shows a "Request Price" CTA (spec §9.3).
- Test strategy: **unit test (Vitest, node environment) every module with real branching logic** — pure utility functions, Zod schemas, dictionary lookups, mock-data referential integrity, Route Handlers. **Do not unit test presentational-only React components** (no conditional logic beyond simple prop rendering) — those are verified manually via the dev server and by `tsc`/`next lint`/`next build` passing, per spec §10. Every task that touches a page must end with `npm run build` succeeding.
- Package manager: `npm` (existing `package-lock.json`).
- All new source files use the `@/*` path alias already configured in `tsconfig.json` (maps to repo root).

---

## Task 1: Project setup & dependencies

**Files:**
- Modify: `package.json`
- Modify: `app/globals.css`
- Create: `vitest.config.ts`
- Create: `lib/utils.ts`
- Test: `lib/utils.test.ts`

**Interfaces:**
- Produces: `cn(...inputs: ClassValue[]): string` from `@/lib/utils`, used by every styled component task from here on to merge Tailwind classes.
- Produces: working `npm run test` (Vitest), `npm run lint`, `npx tsc --noEmit`, `npm run build` commands — every later task's verification steps assume these all work.
- Produces: Tailwind v4 theme tokens available as utility classes: `bg-background`, `text-foreground`, `text-muted`, `border-border`, `bg-accent`, `text-accent`, `border-accent` (and opacity variants like `bg-accent/90`).

- [ ] **Step 1: Install runtime and dev dependencies**

Run:
```bash
npm install zod react-hook-form @hookform/resolvers clsx tailwind-merge class-variance-authority lucide-react @radix-ui/react-dialog
npm install -D vitest
```

- [ ] **Step 2: Write the failing test for the `cn` helper**

Create `lib/utils.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("joins plain class strings", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("drops falsy values", () => {
    expect(cn("a", false && "b", undefined, null, "c")).toBe("a c");
  });

  it("merges conflicting Tailwind utility classes, keeping the last one", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });

  it("applies conditional classes from an object", () => {
    expect(cn("base", { active: true, hidden: false })).toBe("base active");
  });
});
```

- [ ] **Step 2b: Add the test script to `package.json`**

In `package.json`, inside `"scripts"`, add:
```json
"test": "vitest run"
```

- [ ] **Step 3: Create the Vitest config**

Create `vitest.config.ts`:
```ts
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules", ".next"],
  },
});
```

Note: the `@` alias mirrors `tsconfig.json`'s path mapping. It isn't exercised by this task's own test (`lib/utils.test.ts` uses a relative import), but Task 2 onward imports across `lib/`, `dictionaries/`, and `app/` via `@/*`, so it must be in place before those tests can resolve.

- [ ] **Step 4: Run the test and verify it fails**

Run: `npm run test`
Expected: FAIL — `lib/utils.ts` does not exist / `cn` is not exported.

- [ ] **Step 5: Implement `cn`**

Create `lib/utils.ts`:
```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 6: Run the test and verify it passes**

Run: `npm run test`
Expected: PASS (4 tests).

- [ ] **Step 7: Apply the dark Industrial Premium theme tokens**

Replace the full contents of `app/globals.css`:
```css
@import "tailwindcss";

:root {
  --background: #0d0e11;
  --foreground: #f5f5f5;
  --muted: #9ca3af;
  --border-color: #1f2126;
  --accent: #f77d2a;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-muted: var(--muted);
  --color-border: var(--border-color);
  --color-accent: var(--accent);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}

body {
  background: var(--color-background);
  color: var(--color-foreground);
  font-family: var(--font-sans), Arial, Helvetica, sans-serif;
}
```

- [ ] **Step 8: Verify lint, typecheck, and build still succeed**

Run: `npm run lint`
Expected: no errors.

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run build`
Expected: build succeeds (the existing default `app/page.tsx`/`app/layout.tsx` still exist at this point — they're replaced in Task 2 — so the build has a valid root route).

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json app/globals.css vitest.config.ts lib/utils.ts lib/utils.test.ts
git commit -m "chore: add project dependencies, theme tokens, and Vitest setup"
```

---

## Task 2: i18n foundation (locale routing + full dictionaries)

**Files:**
- Create: `lib/i18n/locales.ts`
- Test: `lib/i18n/locales.test.ts`
- Create: `dictionaries/uz.json`, `dictionaries/ru.json`, `dictionaries/en.json`
- Create: `lib/i18n/dictionaries.ts`
- Test: `lib/i18n/dictionaries.test.ts`
- Create: `proxy.ts` (project root, not under `app/` — Next.js 16 only recognizes `proxy.ts` at the repo root or `src/`; confirmed against `node_modules/next/dist/build/utils.js`'s `isProxyFile`)
- Delete: `app/layout.tsx`, `app/page.tsx`
- Create: `app/[lang]/layout.tsx`, `app/[lang]/page.tsx`

**Interfaces:**
- Produces (`@/lib/i18n/locales`): `SUPPORTED_LOCALES: readonly ["uz","ru","en"]`, `type Locale = "uz"|"ru"|"en"`, `DEFAULT_LOCALE: Locale = "uz"`, `isLocale(value: string): value is Locale`, `switchLocalePath(pathname: string, targetLocale: Locale): string`.
- Produces (`@/lib/i18n/dictionaries`): `type Dictionary` (inferred from `dictionaries/uz.json`), `hasLocale(locale: string): locale is Locale`, `getDictionary(locale: string): Dictionary`. **Only import this module from Server Components** (pages/layouts) — it statically imports all three JSON files. Client Components must receive the specific dictionary slice they need as a prop instead.
- Produces: the complete dictionary key schema every later task's copy comes from. Full namespace list (identical shape in all 3 locale files): `meta.{siteName,tagline}`; `common.{requestQuote,sendInquiry,readMore,viewAll,loading,close,submit,back,requestPrice,stock.{available,limited,outOfStock}}`; `nav.{products,categories,brands,about,blog,contact,requestQuote,menu}`; `footer.{description,linksTitle,contactTitle,addressLabel,address,phoneLabel,email,rights}`; `home.{heroTitle,heroSubtitle,heroCtaCatalog,heroCtaQuote,trustBadges[].{title,description},aboutTitle,aboutText,categoriesTitle,categoriesSubtitle,brandsTitle,featuredTitle,ctaBannerTitle,ctaBannerText,ctaBannerButton}`; `catalog.{title,subtitle,searchPlaceholder,filterBrandLabel,filterCategoryLabel,filterAvailabilityLabel,allBrands,allCategories,allAvailability,sortLabel,sortNewest,sortNameAsc,sortNameDesc,gridView,listView,noResults,resultsCount}` (no price filter/sort — the mock data has no price field, since this phase has no auth and every product always shows "Request Price"); `product.{skuLabel,oemLabel,brandLabel,categoryLabel,compatibleModelsTitle,specificationsTitle,relatedProductsTitle,galleryAlt}`; `categories.{title,subtitle,productsInCategory}`; `brands.{title,subtitle,productsFromBrand}`; `about.{title,storyTitle,storyParagraphs[],statsTitle,stats[].{value,label}}`; `blog.{title,subtitle,readMore,publishedOn}`; `contact.{title,subtitle,addressTitle,address,phoneTitle,phone,emailTitle,email,hoursTitle,hours}`; `requestQuote.{title,subtitle,fieldName,fieldCompany,fieldPhone,fieldEmail,fieldCountry,fieldProducts,fieldProductsPlaceholder,fieldQuantity,fieldMessage,fieldMessagePlaceholder,submit,submitting,successTitle,successText,errorGeneric,errorRequired,errorEmail}`; `inquiry.{title,subtitle,fieldName,fieldEmail,fieldPhone,fieldMessage,fieldMessagePlaceholder,submit,submitting,successTitle,successText,errorGeneric,errorRequired,errorEmail,openButton}`.
- Produces: `app/[lang]/layout.tsx` root layout (renders `<html lang>`/`<body>` — no `<Header>`/`<Footer>` yet, added in Tasks 5 & 6) and a minimal `app/[lang]/page.tsx` (fully replaced with the real Home page in Task 7).

- [ ] **Step 1: Write the failing test for `locales.ts`**

Create `lib/i18n/locales.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { DEFAULT_LOCALE, isLocale, SUPPORTED_LOCALES, switchLocalePath } from "./locales";

describe("locales", () => {
  it("lists uz, ru, en as supported, with uz as default", () => {
    expect(SUPPORTED_LOCALES).toEqual(["uz", "ru", "en"]);
    expect(DEFAULT_LOCALE).toBe("uz");
  });

  it("isLocale accepts only supported locales", () => {
    expect(isLocale("uz")).toBe(true);
    expect(isLocale("ru")).toBe(true);
    expect(isLocale("fr")).toBe(false);
    expect(isLocale("")).toBe(false);
  });

  it("switchLocalePath replaces the locale segment of a prefixed path", () => {
    expect(switchLocalePath("/uz/products", "en")).toBe("/en/products");
    expect(switchLocalePath("/uz/products/turbo-1", "ru")).toBe("/ru/products/turbo-1");
    expect(switchLocalePath("/uz", "en")).toBe("/en");
  });

  it("switchLocalePath prefixes a path with no locale segment", () => {
    expect(switchLocalePath("/products", "en")).toBe("/en/products");
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npm run test`
Expected: FAIL — `lib/i18n/locales.ts` does not exist.

- [ ] **Step 3: Implement `locales.ts`**

Create `lib/i18n/locales.ts`:
```ts
export const SUPPORTED_LOCALES = ["uz", "ru", "en"] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "uz";

export function isLocale(value: string): value is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export function switchLocalePath(pathname: string, targetLocale: Locale): string {
  const segments = pathname.split("/");

  if (segments.length > 1 && isLocale(segments[1])) {
    segments[1] = targetLocale;
    return segments.join("/");
  }

  return `/${targetLocale}${pathname}`;
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `npm run test`
Expected: PASS.

- [ ] **Step 5: Create the three dictionary files**

Create `dictionaries/uz.json`:
```json
{
  "meta": {
    "siteName": "DieselParts",
    "tagline": "Og'ir texnika uchun ishonchli ehtiyot qismlar"
  },
  "common": {
    "requestQuote": "Narx so'rash",
    "sendInquiry": "So'rov yuborish",
    "readMore": "Batafsil",
    "viewAll": "Barchasini ko'rish",
    "loading": "Yuklanmoqda...",
    "close": "Yopish",
    "submit": "Yuborish",
    "back": "Orqaga",
    "requestPrice": "Narxni so'rang",
    "stock": {
      "available": "Mavjud",
      "limited": "Cheklangan",
      "outOfStock": "Tugagan"
    }
  },
  "nav": {
    "products": "Mahsulotlar",
    "categories": "Kategoriyalar",
    "brands": "Brendlar",
    "about": "Biz haqimizda",
    "blog": "Blog",
    "contact": "Aloqa",
    "requestQuote": "Narx so'rash",
    "menu": "Menyu"
  },
  "footer": {
    "description": "30 yildan ortiq tajriba bilan og'ir texnika uchun OEM sifatidagi ehtiyot qismlarni dunyo bo'ylab yetkazib beramiz.",
    "linksTitle": "Havolalar",
    "contactTitle": "Aloqa",
    "addressLabel": "Manzil",
    "address": "Toshkent sh., Chilonzor tumani, Bunyodkor shoh ko'chasi 12",
    "phoneLabel": "Telefon",
    "email": "info@dieselparts.uz",
    "rights": "Barcha huquqlar himoyalangan."
  },
  "home": {
    "heroTitle": "Og'ir texnika uchun ishonchli ehtiyot qismlar",
    "heroSubtitle": "10,000 dan ortiq mahsulot, jahon bo'ylab yetkazib berish va OEM sifatiga kafolat",
    "heroCtaCatalog": "Katalogni ko'rish",
    "heroCtaQuote": "Narx so'rash",
    "trustBadges": [
      { "title": "30+ yil tajriba", "description": "Sohada uzoq yillik tajriba va ishonch" },
      { "title": "10,000+ mahsulot", "description": "Keng assortimentdagi ehtiyot qismlar" },
      { "title": "Jahon bo'ylab yetkazib berish", "description": "Xalqaro mijozlarga tez va ishonchli logistika" },
      { "title": "OEM sifat", "description": "Barcha mahsulotlar OEM standartlariga mos" }
    ],
    "aboutTitle": "Biz haqimizda",
    "aboutText": "DieselParts — mining va construction texnikasi uchun ehtiyot qismlar yetkazib beruvchi kompaniya. Biz dilerlar va yakuniy foydalanuvchilarga sifatli, ishonchli va tez yetkazib beriladigan mahsulotlarni taqdim etamiz.",
    "categoriesTitle": "Kategoriyalar bo'yicha ko'rish",
    "categoriesSubtitle": "Kerakli ehtiyot qismni toifasi bo'yicha toping",
    "brandsTitle": "Ishlaydigan brendlarimiz",
    "featuredTitle": "Tavsiya etilgan mahsulotlar",
    "ctaBannerTitle": "Ehtiyot qism kerakmi?",
    "ctaBannerText": "Bepul konsultatsiya oling — mutaxassislarimiz sizga mos qismni topishga yordam beradi.",
    "ctaBannerButton": "Bog'lanish"
  },
  "catalog": {
    "title": "Mahsulotlar katalogi",
    "subtitle": "Nom, SKU yoki OEM raqami bo'yicha qidiring",
    "searchPlaceholder": "Nom, SKU yoki OEM raqami...",
    "filterBrandLabel": "Brend",
    "filterCategoryLabel": "Kategoriya",
    "filterAvailabilityLabel": "Mavjudlik",
    "allBrands": "Barcha brendlar",
    "allCategories": "Barcha kategoriyalar",
    "allAvailability": "Barchasi",
    "sortLabel": "Saralash",
    "sortNewest": "Eng yangi",
    "sortNameAsc": "Nomi: A-Z",
    "sortNameDesc": "Nomi: Z-A",
    "gridView": "Katak ko'rinish",
    "listView": "Ro'yxat ko'rinishi",
    "noResults": "Hech narsa topilmadi",
    "resultsCount": "{count} ta mahsulot topildi",
    "prevPage": "Oldingi",
    "nextPage": "Keyingi",
    "pageIndicator": "{current} / {total}"
  },
  "product": {
    "skuLabel": "SKU",
    "oemLabel": "OEM raqami",
    "brandLabel": "Brend",
    "categoryLabel": "Kategoriya",
    "compatibleModelsTitle": "Mos keladigan modellar",
    "specificationsTitle": "Texnik xususiyatlari",
    "relatedProductsTitle": "O'xshash mahsulotlar",
    "galleryAlt": "Mahsulot rasmi"
  },
  "categories": {
    "title": "Kategoriya",
    "subtitle": "Ushbu kategoriyadagi mahsulotlar",
    "productsInCategory": "ta mahsulot"
  },
  "brands": {
    "title": "Brend",
    "subtitle": "Ushbu brenddagi mahsulotlar",
    "productsFromBrand": "ta mahsulot"
  },
  "about": {
    "title": "Biz haqimizda",
    "storyTitle": "Bizning tariximiz",
    "storyParagraphs": [
      "DieselParts 2010 yilda tashkil etilgan bo'lib, o'shandan beri mining va construction texnikasi uchun ehtiyot qismlar sohasida yetakchi yetkazib beruvchilardan biriga aylandi.",
      "Bugungi kunda biz o'nlab mamlakatlardagi dilerlar va kompaniyalarga CAT, Komatsu, Volvo, Hitachi, JCB, Hyundai va Doosan texnikasi uchun OEM sifatidagi qismlarni yetkazib beramiz."
    ],
    "statsTitle": "Raqamlarda biz",
    "stats": [
      { "value": "30+", "label": "yillik tajriba" },
      { "value": "10,000+", "label": "mahsulot" },
      { "value": "30+", "label": "mamlakat" },
      { "value": "500+", "label": "hamkor" }
    ]
  },
  "blog": {
    "title": "Blog",
    "subtitle": "Ehtiyot qismlar va texnika parvarishi haqida maqolalar",
    "readMore": "Maqolani o'qish",
    "publishedOn": "Nashr etilgan sana"
  },
  "contact": {
    "title": "Aloqa",
    "subtitle": "Biz bilan bog'laning — savollaringizga javob beramiz",
    "addressTitle": "Manzil",
    "address": "Toshkent sh., Chilonzor tumani, Bunyodkor shoh ko'chasi 12",
    "phoneTitle": "Telefon",
    "phone": "+998 97 425 27 00",
    "emailTitle": "Email",
    "email": "info@dieselparts.uz",
    "hoursTitle": "Ish vaqti",
    "hours": "Dushanba - Shanba, 09:00 - 23:00"
  },
  "requestQuote": {
    "title": "Narx so'rash",
    "subtitle": "Formani to'ldiring — menejerlarimiz tez orada siz bilan bog'lanadi",
    "fieldName": "Ism",
    "fieldCompany": "Kompaniya",
    "fieldPhone": "Telefon",
    "fieldEmail": "Email",
    "fieldCountry": "Mamlakat",
    "fieldProducts": "Kerakli mahsulot(lar)",
    "fieldProductsPlaceholder": "Mahsulot nomi, SKU yoki OEM raqamini kiriting",
    "fieldQuantity": "Miqdor",
    "fieldMessage": "Xabar",
    "fieldMessagePlaceholder": "Qo'shimcha ma'lumot...",
    "submit": "Yuborish",
    "submitting": "Yuborilmoqda...",
    "successTitle": "So'rovingiz qabul qilindi",
    "successText": "Rahmat! Menejerlarimiz tez orada siz bilan bog'lanadi.",
    "errorGeneric": "Xatolik yuz berdi. Iltimos, qaytadan urinib ko'ring.",
    "errorRequired": "Bu maydon to'ldirilishi shart",
    "errorEmail": "To'g'ri email manzilini kiriting"
  },
  "inquiry": {
    "title": "So'rov yuborish",
    "subtitle": "Ushbu mahsulot haqida menejerimizga savol yuboring",
    "fieldName": "Ism",
    "fieldEmail": "Email",
    "fieldPhone": "Telefon",
    "fieldMessage": "Xabar",
    "fieldMessagePlaceholder": "Savolingizni yozing...",
    "submit": "Yuborish",
    "submitting": "Yuborilmoqda...",
    "successTitle": "So'rovingiz qabul qilindi",
    "successText": "Rahmat! Menejerlarimiz tez orada siz bilan bog'lanadi.",
    "errorGeneric": "Xatolik yuz berdi. Iltimos, qaytadan urinib ko'ring.",
    "errorRequired": "Bu maydon to'ldirilishi shart",
    "errorEmail": "To'g'ri email manzilini kiriting",
    "openButton": "So'rov yuborish"
  }
}
```

Create `dictionaries/ru.json`:
```json
{
  "meta": {
    "siteName": "DieselParts",
    "tagline": "Надёжные запчасти для тяжёлой техники"
  },
  "common": {
    "requestQuote": "Запросить цену",
    "sendInquiry": "Отправить запрос",
    "readMore": "Подробнее",
    "viewAll": "Смотреть все",
    "loading": "Загрузка...",
    "close": "Закрыть",
    "submit": "Отправить",
    "back": "Назад",
    "requestPrice": "Запросить цену",
    "stock": {
      "available": "В наличии",
      "limited": "Ограничено",
      "outOfStock": "Нет в наличии"
    }
  },
  "nav": {
    "products": "Продукция",
    "categories": "Категории",
    "brands": "Бренды",
    "about": "О нас",
    "blog": "Блог",
    "contact": "Контакты",
    "requestQuote": "Запросить цену",
    "menu": "Меню"
  },
  "footer": {
    "description": "Более 30 лет поставляем запчасти OEM-качества для тяжёлой техники по всему миру.",
    "linksTitle": "Ссылки",
    "contactTitle": "Контакты",
    "addressLabel": "Адрес",
    "address": "г. Ташкент, Чиланзарский район, проспект Бунёдкор 12",
    "phoneLabel": "Телефон",
    "email": "info@dieselparts.uz",
    "rights": "Все права защищены."
  },
  "home": {
    "heroTitle": "Надёжные запчасти для тяжёлой техники",
    "heroSubtitle": "Более 10 000 товаров, доставка по всему миру и гарантия OEM-качества",
    "heroCtaCatalog": "Смотреть каталог",
    "heroCtaQuote": "Запросить цену",
    "trustBadges": [
      { "title": "30+ лет опыта", "description": "Многолетний опыт и доверие в отрасли" },
      { "title": "10 000+ товаров", "description": "Широкий ассортимент запчастей" },
      { "title": "Доставка по всему миру", "description": "Быстрая и надёжная логистика для клиентов" },
      { "title": "OEM-качество", "description": "Все товары соответствуют стандартам OEM" }
    ],
    "aboutTitle": "О нас",
    "aboutText": "DieselParts — поставщик запчастей для горнодобывающей и строительной техники. Мы предлагаем дилерам и конечным заказчикам качественную, надёжную и быструю поставку продукции.",
    "categoriesTitle": "Просмотр по категориям",
    "categoriesSubtitle": "Найдите нужную запчасть по категории",
    "brandsTitle": "Бренды, с которыми мы работаем",
    "featuredTitle": "Рекомендуемые товары",
    "ctaBannerTitle": "Нужна запчасть?",
    "ctaBannerText": "Получите бесплатную консультацию — наши специалисты помогут подобрать нужную деталь.",
    "ctaBannerButton": "Связаться"
  },
  "catalog": {
    "title": "Каталог продукции",
    "subtitle": "Ищите по названию, SKU или номеру OEM",
    "searchPlaceholder": "Название, SKU или номер OEM...",
    "filterBrandLabel": "Бренд",
    "filterCategoryLabel": "Категория",
    "filterAvailabilityLabel": "Наличие",
    "allBrands": "Все бренды",
    "allCategories": "Все категории",
    "allAvailability": "Все",
    "sortLabel": "Сортировка",
    "sortNewest": "Сначала новые",
    "sortNameAsc": "По названию: А-Я",
    "sortNameDesc": "По названию: Я-А",
    "gridView": "Сетка",
    "listView": "Список",
    "noResults": "Ничего не найдено",
    "resultsCount": "Найдено товаров: {count}",
    "prevPage": "Назад",
    "nextPage": "Далее",
    "pageIndicator": "{current} / {total}"
  },
  "product": {
    "skuLabel": "SKU",
    "oemLabel": "Номер OEM",
    "brandLabel": "Бренд",
    "categoryLabel": "Категория",
    "compatibleModelsTitle": "Совместимые модели",
    "specificationsTitle": "Технические характеристики",
    "relatedProductsTitle": "Похожие товары",
    "galleryAlt": "Изображение товара"
  },
  "categories": {
    "title": "Категория",
    "subtitle": "Товары в этой категории",
    "productsInCategory": "товаров"
  },
  "brands": {
    "title": "Бренд",
    "subtitle": "Товары этого бренда",
    "productsFromBrand": "товаров"
  },
  "about": {
    "title": "О нас",
    "storyTitle": "Наша история",
    "storyParagraphs": [
      "DieselParts была основана в 2010 году и с тех пор стала одним из ведущих поставщиков запчастей для горнодобывающей и строительной техники.",
      "Сегодня мы поставляем запчасти OEM-качества для техники CAT, Komatsu, Volvo, Hitachi, JCB, Hyundai и Doosan дилерам и компаниям в десятках стран."
    ],
    "statsTitle": "Мы в цифрах",
    "stats": [
      { "value": "30+", "label": "лет опыта" },
      { "value": "10 000+", "label": "товаров" },
      { "value": "30+", "label": "стран" },
      { "value": "500+", "label": "партнёров" }
    ]
  },
  "blog": {
    "title": "Блог",
    "subtitle": "Статьи о запчастях и обслуживании техники",
    "readMore": "Читать статью",
    "publishedOn": "Дата публикации"
  },
  "contact": {
    "title": "Контакты",
    "subtitle": "Свяжитесь с нами — мы ответим на любые вопросы",
    "addressTitle": "Адрес",
    "address": "г. Ташкент, Чиланзарский район, проспект Бунёдкор 12",
    "phoneTitle": "Телефон",
    "phone": "+998 97 425 27 00",
    "emailTitle": "Email",
    "email": "info@dieselparts.uz",
    "hoursTitle": "Часы работы",
    "hours": "Понедельник - Суббота, 09:00 - 23:00"
  },
  "requestQuote": {
    "title": "Запросить цену",
    "subtitle": "Заполните форму — наши менеджеры свяжутся с вами в ближайшее время",
    "fieldName": "Имя",
    "fieldCompany": "Компания",
    "fieldPhone": "Телефон",
    "fieldEmail": "Email",
    "fieldCountry": "Страна",
    "fieldProducts": "Нужные товары",
    "fieldProductsPlaceholder": "Введите название, SKU или номер OEM",
    "fieldQuantity": "Количество",
    "fieldMessage": "Сообщение",
    "fieldMessagePlaceholder": "Дополнительная информация...",
    "submit": "Отправить",
    "submitting": "Отправка...",
    "successTitle": "Ваш запрос принят",
    "successText": "Спасибо! Наши менеджеры скоро свяжутся с вами.",
    "errorGeneric": "Произошла ошибка. Попробуйте ещё раз.",
    "errorRequired": "Это поле обязательно",
    "errorEmail": "Введите корректный email"
  },
  "inquiry": {
    "title": "Отправить запрос",
    "subtitle": "Задайте вопрос менеджеру об этом товаре",
    "fieldName": "Имя",
    "fieldEmail": "Email",
    "fieldPhone": "Телефон",
    "fieldMessage": "Сообщение",
    "fieldMessagePlaceholder": "Напишите ваш вопрос...",
    "submit": "Отправить",
    "submitting": "Отправка...",
    "successTitle": "Ваш запрос принят",
    "successText": "Спасибо! Наши менеджеры скоро свяжутся с вами.",
    "errorGeneric": "Произошла ошибка. Попробуйте ещё раз.",
    "errorRequired": "Это поле обязательно",
    "errorEmail": "Введите корректный email",
    "openButton": "Отправить запрос"
  }
}
```

Create `dictionaries/en.json`:
```json
{
  "meta": {
    "siteName": "DieselParts",
    "tagline": "Reliable spare parts for heavy machinery"
  },
  "common": {
    "requestQuote": "Request Quote",
    "sendInquiry": "Send Inquiry",
    "readMore": "Read More",
    "viewAll": "View All",
    "loading": "Loading...",
    "close": "Close",
    "submit": "Submit",
    "back": "Back",
    "requestPrice": "Request Price",
    "stock": {
      "available": "Available",
      "limited": "Limited",
      "outOfStock": "Out of Stock"
    }
  },
  "nav": {
    "products": "Products",
    "categories": "Categories",
    "brands": "Brands",
    "about": "About",
    "blog": "Blog",
    "contact": "Contact",
    "requestQuote": "Request Quote",
    "menu": "Menu"
  },
  "footer": {
    "description": "Delivering OEM-quality spare parts for heavy machinery worldwide for over 30 years.",
    "linksTitle": "Links",
    "contactTitle": "Contact",
    "addressLabel": "Address",
    "address": "12 Bunyodkor Ave, Chilonzor District, Tashkent",
    "phoneLabel": "Phone",
    "email": "info@dieselparts.uz",
    "rights": "All rights reserved."
  },
  "home": {
    "heroTitle": "Reliable Spare Parts for Heavy Machinery",
    "heroSubtitle": "10,000+ products, worldwide delivery, and guaranteed OEM quality",
    "heroCtaCatalog": "Browse Catalog",
    "heroCtaQuote": "Request Quote",
    "trustBadges": [
      { "title": "30+ Years Experience", "description": "Long-standing experience and trust in the industry" },
      { "title": "10,000+ Products", "description": "A wide assortment of spare parts" },
      { "title": "Worldwide Delivery", "description": "Fast, reliable logistics for international customers" },
      { "title": "OEM Quality", "description": "Every product meets OEM standards" }
    ],
    "aboutTitle": "About Us",
    "aboutText": "DieselParts supplies spare parts for mining and construction machinery. We provide dealers and end users with quality, reliable, and fast-delivered products.",
    "categoriesTitle": "Browse by Category",
    "categoriesSubtitle": "Find the part you need by category",
    "brandsTitle": "Brands We Work With",
    "featuredTitle": "Featured Products",
    "ctaBannerTitle": "Need a Spare Part?",
    "ctaBannerText": "Get a free consultation — our specialists will help you find the right part.",
    "ctaBannerButton": "Get in Touch"
  },
  "catalog": {
    "title": "Product Catalog",
    "subtitle": "Search by name, SKU, or OEM number",
    "searchPlaceholder": "Name, SKU, or OEM number...",
    "filterBrandLabel": "Brand",
    "filterCategoryLabel": "Category",
    "filterAvailabilityLabel": "Availability",
    "allBrands": "All Brands",
    "allCategories": "All Categories",
    "allAvailability": "All",
    "sortLabel": "Sort",
    "sortNewest": "Newest",
    "sortNameAsc": "Name: A-Z",
    "sortNameDesc": "Name: Z-A",
    "gridView": "Grid View",
    "listView": "List View",
    "noResults": "No products found",
    "resultsCount": "{count} products found",
    "prevPage": "Previous",
    "nextPage": "Next",
    "pageIndicator": "{current} / {total}"
  },
  "product": {
    "skuLabel": "SKU",
    "oemLabel": "OEM Number",
    "brandLabel": "Brand",
    "categoryLabel": "Category",
    "compatibleModelsTitle": "Compatible Models",
    "specificationsTitle": "Specifications",
    "relatedProductsTitle": "Related Products",
    "galleryAlt": "Product image"
  },
  "categories": {
    "title": "Category",
    "subtitle": "Products in this category",
    "productsInCategory": "products"
  },
  "brands": {
    "title": "Brand",
    "subtitle": "Products from this brand",
    "productsFromBrand": "products"
  },
  "about": {
    "title": "About Us",
    "storyTitle": "Our Story",
    "storyParagraphs": [
      "DieselParts was founded in 2010 and has since become one of the leading suppliers of spare parts for mining and construction machinery.",
      "Today we supply OEM-quality parts for CAT, Komatsu, Volvo, Hitachi, JCB, Hyundai, and Doosan machinery to dealers and companies across dozens of countries."
    ],
    "statsTitle": "By the Numbers",
    "stats": [
      { "value": "30+", "label": "years of experience" },
      { "value": "10,000+", "label": "products" },
      { "value": "30+", "label": "countries" },
      { "value": "500+", "label": "partners" }
    ]
  },
  "blog": {
    "title": "Blog",
    "subtitle": "Articles on spare parts and equipment maintenance",
    "readMore": "Read Article",
    "publishedOn": "Published on"
  },
  "contact": {
    "title": "Contact",
    "subtitle": "Get in touch — we'll answer any questions",
    "addressTitle": "Address",
    "address": "12 Bunyodkor Ave, Chilonzor District, Tashkent",
    "phoneTitle": "Phone",
    "phone": "+998 97 425 27 00",
    "emailTitle": "Email",
    "email": "info@dieselparts.uz",
    "hoursTitle": "Business Hours",
    "hours": "Monday - Saturday, 9:00 AM - 6:00 PM"
  },
  "requestQuote": {
    "title": "Request a Quote",
    "subtitle": "Fill out the form and our managers will contact you shortly",
    "fieldName": "Name",
    "fieldCompany": "Company",
    "fieldPhone": "Phone",
    "fieldEmail": "Email",
    "fieldCountry": "Country",
    "fieldProducts": "Product(s) Needed",
    "fieldProductsPlaceholder": "Enter product name, SKU, or OEM number",
    "fieldQuantity": "Quantity",
    "fieldMessage": "Message",
    "fieldMessagePlaceholder": "Additional details...",
    "submit": "Submit",
    "submitting": "Submitting...",
    "successTitle": "Your Request Has Been Received",
    "successText": "Thank you! Our managers will contact you shortly.",
    "errorGeneric": "Something went wrong. Please try again.",
    "errorRequired": "This field is required",
    "errorEmail": "Enter a valid email address"
  },
  "inquiry": {
    "title": "Send Inquiry",
    "subtitle": "Ask our manager a question about this product",
    "fieldName": "Name",
    "fieldEmail": "Email",
    "fieldPhone": "Phone",
    "fieldMessage": "Message",
    "fieldMessagePlaceholder": "Write your question...",
    "submit": "Submit",
    "submitting": "Submitting...",
    "successTitle": "Your Request Has Been Received",
    "successText": "Thank you! Our managers will contact you shortly.",
    "errorGeneric": "Something went wrong. Please try again.",
    "errorRequired": "This field is required",
    "errorEmail": "Enter a valid email address",
    "openButton": "Send Inquiry"
  }
}
```

- [ ] **Step 6: Write the failing test for the dictionary loader**

Create `lib/i18n/dictionaries.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { getDictionary, hasLocale } from "./dictionaries";

function collectKeyPaths(value: unknown, prefix = ""): string[] {
  if (Array.isArray(value)) {
    return collectKeyPaths(value[0] ?? {}, prefix);
  }
  if (value !== null && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, v]) =>
      collectKeyPaths(v, prefix ? `${prefix}.${key}` : key)
    );
  }
  return [prefix];
}

describe("dictionaries", () => {
  it("hasLocale narrows supported locale strings", () => {
    expect(hasLocale("uz")).toBe(true);
    expect(hasLocale("xx")).toBe(false);
  });

  it("getDictionary returns the matching locale's content", () => {
    expect(getDictionary("en").meta.siteName).toBe("DieselParts");
    expect(getDictionary("uz").nav.products).toBe("Mahsulotlar");
    expect(getDictionary("ru").nav.products).toBe("Продукция");
  });

  it("falls back to the default locale for an unsupported locale", () => {
    expect(getDictionary("xx").meta.siteName).toBe("DieselParts");
  });

  it("uz, ru, and en dictionaries have identical key structure", () => {
    const uzKeys = collectKeyPaths(getDictionary("uz")).sort();
    const ruKeys = collectKeyPaths(getDictionary("ru")).sort();
    const enKeys = collectKeyPaths(getDictionary("en")).sort();
    expect(ruKeys).toEqual(uzKeys);
    expect(enKeys).toEqual(uzKeys);
  });
});
```

- [ ] **Step 7: Run the test and verify it fails**

Run: `npm run test`
Expected: FAIL — `lib/i18n/dictionaries.ts` does not exist.

- [ ] **Step 8: Implement the dictionary loader**

Create `lib/i18n/dictionaries.ts`:
```ts
import uz from "@/dictionaries/uz.json";
import ru from "@/dictionaries/ru.json";
import en from "@/dictionaries/en.json";
import { DEFAULT_LOCALE, isLocale, type Locale } from "./locales";

export type Dictionary = typeof uz;

const dictionaries: Record<Locale, Dictionary> = { uz, ru, en };

export function hasLocale(locale: string): locale is Locale {
  return isLocale(locale);
}

export function getDictionary(locale: string): Dictionary {
  const resolved = hasLocale(locale) ? locale : DEFAULT_LOCALE;
  return dictionaries[resolved];
}
```

- [ ] **Step 9: Run the test and verify it passes**

Run: `npm run test`
Expected: PASS.

- [ ] **Step 10: Create the locale redirect proxy**

Create `proxy.ts` at the project root (NOT `app/proxy.ts` — Next.js 16 only loads `proxy.ts` from the repo root or `src/`; a copy under `app/` is silently ignored and every route would 404):
```ts
import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/locales";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const firstSegment = pathname.split("/")[1] ?? "";

  if (isLocale(firstSegment)) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = `/${DEFAULT_LOCALE}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next|api|.*\\..*).*)"],
};
```

- [ ] **Step 11: Remove the default `create-next-app` root layout/page**

```bash
rm app/layout.tsx app/page.tsx
```

- [ ] **Step 12: Create the locale-scoped root layout**

Create `app/[lang]/layout.tsx`:
```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "../globals.css";
import { SUPPORTED_LOCALES } from "@/lib/i18n/locales";
import { getDictionary } from "@/lib/i18n/dictionaries";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((lang) => ({ lang }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const dict = getDictionary(lang);
  return {
    title: dict.meta.siteName,
    description: dict.meta.tagline,
  };
}

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;

  return (
    <html
      lang={lang}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 13: Create a minimal locale-scoped home page (replaced in full by Task 7)**

Create `app/[lang]/page.tsx`:
```tsx
import { getDictionary } from "@/lib/i18n/dictionaries";

export default async function HomePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const dict = getDictionary(lang);

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-24 text-center">
      <div>
        <h1 className="text-3xl font-semibold">{dict.home.heroTitle}</h1>
        <p className="mt-4 text-muted">{dict.home.heroSubtitle}</p>
      </div>
    </main>
  );
}
```

- [ ] **Step 14: Verify lint, typecheck, build, and manual routing**

Run: `npm run lint` — expected: no errors.
Run: `npx tsc --noEmit` — expected: no errors.
Run: `npm run build` — expected: succeeds, with `/uz`, `/ru`, `/en` static routes listed in the output.

Run: `npm run dev`, then in a browser:
- Visit `http://localhost:3000/` → expect redirect to `http://localhost:3000/uz`.
- Visit `http://localhost:3000/ru` → expect the Russian hero text.
- Visit `http://localhost:3000/en` → expect the English hero text.
Stop the dev server afterward.

- [ ] **Step 15: Commit**

```bash
git add lib/i18n dictionaries proxy.ts "app/[lang]" app/layout.tsx app/page.tsx
git commit -m "feat: add uz/ru/en locale routing and full site dictionaries"
```

---

## Task 3: Types and mock data (brands, categories, products, blog)

**Files:**
- Create: `lib/types.ts`
- Create: `lib/data/brands.ts`, `lib/data/categories.ts`, `lib/data/products.ts`, `lib/data/blog.ts`
- Test: `lib/data/data.test.ts`

**Interfaces:**
- Produces (`@/lib/types`): `type LocalizedText = { uz: string; ru: string; en: string }`, `type StockStatus = "available" | "limited" | "out_of_stock"`, `interface Brand { id: string; slug: string; name: string }`, `interface Category { id: string; slug: string; name: LocalizedText }`, `interface ProductSpec { label: LocalizedText; value: string }`, `interface Product { id: string; slug: string; name: LocalizedText; sku: string; oemNumber: string; categoryId: string; brandId: string; description: LocalizedText; compatibleModels: string[]; stockStatus: StockStatus; specs: ProductSpec[]; imageLabels: string[] }`, `interface BlogPost { id: string; slug: string; title: LocalizedText; excerpt: LocalizedText; body: LocalizedText[]; publishedAt: string }`.
- Produces (`@/lib/data/brands`): `export const brands: Brand[]` (7 items: cat, komatsu, volvo, hitachi, jcb, hyundai, doosan).
- Produces (`@/lib/data/categories`): `export const categories: Category[]` (10 items).
- Produces (`@/lib/data/products`): `export const products: Product[]` (15 items, every brand and category id used at least once).
- Produces (`@/lib/data/blog`): `export const blogPosts: BlogPost[]` (3 items).
- All later tasks that need product/category/brand/blog data import from these four modules — no other task defines mock data.

- [ ] **Step 1: Write the failing referential-integrity tests**

Create `lib/data/data.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { brands } from "./brands";
import { categories } from "./categories";
import { products } from "./products";
import { blogPosts } from "./blog";

function expectUniqueSlugs(items: { slug: string }[]) {
  const slugs = items.map((item) => item.slug);
  expect(new Set(slugs).size).toBe(slugs.length);
}

describe("mock data integrity", () => {
  it("has 7 brands with unique ids and slugs", () => {
    expect(brands).toHaveLength(7);
    expectUniqueSlugs(brands);
    expect(new Set(brands.map((b) => b.id)).size).toBe(brands.length);
  });

  it("has 10 categories with unique ids, slugs, and localized names", () => {
    expect(categories).toHaveLength(10);
    expectUniqueSlugs(categories);
    for (const category of categories) {
      expect(category.name.uz).toBeTruthy();
      expect(category.name.ru).toBeTruthy();
      expect(category.name.en).toBeTruthy();
    }
  });

  it("has 15 products with unique ids and slugs", () => {
    expect(products).toHaveLength(15);
    expectUniqueSlugs(products);
    expect(new Set(products.map((p) => p.id)).size).toBe(products.length);
  });

  it("every product references a real brand and category", () => {
    const brandIds = new Set(brands.map((b) => b.id));
    const categoryIds = new Set(categories.map((c) => c.id));
    for (const product of products) {
      expect(brandIds.has(product.brandId)).toBe(true);
      expect(categoryIds.has(product.categoryId)).toBe(true);
    }
  });

  it("every brand and category is used by at least one product", () => {
    const usedBrandIds = new Set(products.map((p) => p.brandId));
    const usedCategoryIds = new Set(products.map((p) => p.categoryId));
    for (const brand of brands) {
      expect(usedBrandIds.has(brand.id)).toBe(true);
    }
    for (const category of categories) {
      expect(usedCategoryIds.has(category.id)).toBe(true);
    }
  });

  it("every product has at least one compatible model, one spec, and one image label", () => {
    for (const product of products) {
      expect(product.compatibleModels.length).toBeGreaterThan(0);
      expect(product.specs.length).toBeGreaterThan(0);
      expect(product.imageLabels.length).toBeGreaterThan(0);
    }
  });

  it("has 3 blog posts with unique slugs and non-empty bodies in all locales", () => {
    expect(blogPosts).toHaveLength(3);
    expectUniqueSlugs(blogPosts);
    for (const post of blogPosts) {
      expect(post.body.uz.length).toBeGreaterThan(0);
      expect(post.body.ru.length).toBeGreaterThan(0);
      expect(post.body.en.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `npm run test`
Expected: FAIL — `lib/data/brands.ts` (and siblings) do not exist.

- [ ] **Step 3: Create `lib/types.ts`**

```ts
export interface LocalizedText {
  uz: string;
  ru: string;
  en: string;
}

export type StockStatus = "available" | "limited" | "out_of_stock";

export interface Brand {
  id: string;
  slug: string;
  name: string;
}

export interface Category {
  id: string;
  slug: string;
  name: LocalizedText;
}

export interface ProductSpec {
  label: LocalizedText;
  value: string;
}

export interface Product {
  id: string;
  slug: string;
  name: LocalizedText;
  sku: string;
  oemNumber: string;
  categoryId: string;
  brandId: string;
  description: LocalizedText;
  compatibleModels: string[];
  stockStatus: StockStatus;
  specs: ProductSpec[];
  imageLabels: string[];
}

export interface BlogPost {
  id: string;
  slug: string;
  title: LocalizedText;
  excerpt: LocalizedText;
  body: LocalizedText;
  publishedAt: string;
}
```

Note: `BlogPost.body` is a single `LocalizedText` whose `uz`/`ru`/`en` values are the full article text (each a multi-paragraph string, paragraphs separated by `\n\n`) — the integrity test above checks `.length > 0` on these strings, not on an array.

- [ ] **Step 4: Create `lib/data/brands.ts`**

```ts
import type { Brand } from "@/lib/types";

export const brands: Brand[] = [
  { id: "cat", slug: "cat", name: "CAT" },
  { id: "komatsu", slug: "komatsu", name: "Komatsu" },
  { id: "volvo", slug: "volvo", name: "Volvo" },
  { id: "hitachi", slug: "hitachi", name: "Hitachi" },
  { id: "jcb", slug: "jcb", name: "JCB" },
  { id: "hyundai", slug: "hyundai", name: "Hyundai" },
  { id: "doosan", slug: "doosan", name: "Doosan" },
];
```

- [ ] **Step 5: Create `lib/data/categories.ts`**

```ts
import type { Category } from "@/lib/types";

export const categories: Category[] = [
  {
    id: "engine-parts",
    slug: "engine-parts",
    name: { uz: "Dvigatel qismlari", ru: "Запчасти двигателя", en: "Engine Parts" },
  },
  {
    id: "turbocharger",
    slug: "turbocharger",
    name: { uz: "Turbokompressor", ru: "Турбокомпрессор", en: "Turbocharger" },
  },
  {
    id: "injector",
    slug: "injector",
    name: { uz: "Forsunka", ru: "Форсунка", en: "Injector" },
  },
  {
    id: "piston",
    slug: "piston",
    name: { uz: "Porshen", ru: "Поршень", en: "Piston" },
  },
  {
    id: "hydraulic-pump",
    slug: "hydraulic-pump",
    name: { uz: "Gidravlik nasos", ru: "Гидравлический насос", en: "Hydraulic Pump" },
  },
  {
    id: "valve",
    slug: "valve",
    name: { uz: "Klapan", ru: "Клапан", en: "Valve" },
  },
  {
    id: "seal-kit",
    slug: "seal-kit",
    name: { uz: "Zichlagich to'plami", ru: "Комплект уплотнений", en: "Seal Kit" },
  },
  {
    id: "transmission",
    slug: "transmission",
    name: { uz: "Transmissiya", ru: "Трансмиссия", en: "Transmission" },
  },
  {
    id: "undercarriage",
    slug: "undercarriage",
    name: { uz: "Yurish qismi", ru: "Ходовая часть", en: "Undercarriage" },
  },
  {
    id: "track-chain",
    slug: "track-chain",
    name: { uz: "Gusenitsa zanjiri", ru: "Гусеничная цепь", en: "Track Chain" },
  },
];
```

- [ ] **Step 6: Create `lib/data/products.ts`**

```ts
import type { Product } from "@/lib/types";

export const products: Product[] = [
  {
    id: "cat-injector-3126",
    slug: "cat-fuel-injector-3126",
    name: { uz: "CAT 3126 yonilg'i forsunkasi", ru: "Топливная форсунка CAT 3126", en: "CAT 3126 Fuel Injector" },
    sku: "DP-INJ-3126",
    oemNumber: "127-8213",
    categoryId: "injector",
    brandId: "cat",
    description: {
      uz: "CAT 3126 seriyali dvigatellar uchun OEM sifatidagi yonilg'i forsunkasi.",
      ru: "Топливная форсунка OEM-качества для двигателей серии CAT 3126.",
      en: "OEM-quality fuel injector for CAT 3126 series engines.",
    },
    compatibleModels: ["CAT 320D", "CAT 325D", "CAT 330D"],
    stockStatus: "available",
    specs: [
      { label: { uz: "Materiali", ru: "Материал", en: "Material" }, value: "Steel alloy" },
      { label: { uz: "Kafolat", ru: "Гарантия", en: "Warranty" }, value: "12 months" },
    ],
    imageLabels: ["Front", "Side", "Package"],
  },
  {
    id: "komatsu-turbo-pc200",
    slug: "komatsu-turbocharger-pc200-8",
    name: { uz: "Komatsu PC200-8 turbokompressori", ru: "Турбокомпрессор Komatsu PC200-8", en: "Komatsu PC200-8 Turbocharger" },
    sku: "DP-TRB-PC200",
    oemNumber: "6754-81-8097",
    categoryId: "turbocharger",
    brandId: "komatsu",
    description: {
      uz: "Komatsu PC200-8 ekskavatorlari uchun ishonchli turbokompressor.",
      ru: "Надёжный турбокомпрессор для экскаваторов Komatsu PC200-8.",
      en: "Reliable turbocharger for Komatsu PC200-8 excavators.",
    },
    compatibleModels: ["Komatsu PC200-8", "Komatsu PC220-8"],
    stockStatus: "limited",
    specs: [
      { label: { uz: "Tur", ru: "Тип", en: "Type" }, value: "Wastegate" },
      { label: { uz: "Kafolat", ru: "Гарантия", en: "Warranty" }, value: "6 months" },
    ],
    imageLabels: ["Front", "Side"],
  },
  {
    id: "volvo-hyp-ec210",
    slug: "volvo-hydraulic-pump-ec210",
    name: { uz: "Volvo EC210 gidravlik nasosi", ru: "Гидравлический насос Volvo EC210", en: "Volvo EC210 Hydraulic Pump" },
    sku: "DP-HYP-EC210",
    oemNumber: "VOE14514151",
    categoryId: "hydraulic-pump",
    brandId: "volvo",
    description: {
      uz: "Volvo EC210 ekskavatorlari uchun asosiy gidravlik nasos.",
      ru: "Основной гидравлический насос для экскаваторов Volvo EC210.",
      en: "Main hydraulic pump for Volvo EC210 excavators.",
    },
    compatibleModels: ["Volvo EC210B", "Volvo EC210C"],
    stockStatus: "available",
    specs: [
      { label: { uz: "Bosim", ru: "Давление", en: "Pressure" }, value: "350 bar" },
      { label: { uz: "Kafolat", ru: "Гарантия", en: "Warranty" }, value: "12 months" },
    ],
    imageLabels: ["Front", "Side", "Package"],
  },
  {
    id: "hitachi-piston-zx330",
    slug: "hitachi-piston-kit-zx330",
    name: { uz: "Hitachi ZX330 porshen to'plami", ru: "Комплект поршней Hitachi ZX330", en: "Hitachi ZX330 Piston Kit" },
    sku: "DP-PST-ZX330",
    oemNumber: "4306413",
    categoryId: "piston",
    brandId: "hitachi",
    description: {
      uz: "Hitachi ZX330 dvigatellari uchun to'liq porshen to'plami.",
      ru: "Полный комплект поршней для двигателей Hitachi ZX330.",
      en: "Complete piston kit for Hitachi ZX330 engines.",
    },
    compatibleModels: ["Hitachi ZX330", "Hitachi ZX350"],
    stockStatus: "out_of_stock",
    specs: [
      { label: { uz: "Diametri", ru: "Диаметр", en: "Diameter" }, value: "108 mm" },
      { label: { uz: "Kafolat", ru: "Гарантия", en: "Warranty" }, value: "6 months" },
    ],
    imageLabels: ["Front", "Package"],
  },
  {
    id: "jcb-engine-3cx",
    slug: "jcb-engine-gasket-set-3cx",
    name: { uz: "JCB 3CX dvigatel prokladkalari to'plami", ru: "Комплект прокладок двигателя JCB 3CX", en: "JCB 3CX Engine Gasket Set" },
    sku: "DP-ENG-3CX",
    oemNumber: "320/09501",
    categoryId: "engine-parts",
    brandId: "jcb",
    description: {
      uz: "JCB 3CX ekskavator-yuklagichlar uchun to'liq prokladkalar to'plami.",
      ru: "Полный комплект прокладок для экскаваторов-погрузчиков JCB 3CX.",
      en: "Full gasket set for JCB 3CX backhoe loaders.",
    },
    compatibleModels: ["JCB 3CX", "JCB 4CX"],
    stockStatus: "available",
    specs: [
      { label: { uz: "Material", ru: "Материал", en: "Material" }, value: "Reinforced composite" },
      { label: { uz: "Kafolat", ru: "Гарантия", en: "Warranty" }, value: "12 months" },
    ],
    imageLabels: ["Front", "Package"],
  },
  {
    id: "hyundai-track-r210",
    slug: "hyundai-track-chain-r210",
    name: { uz: "Hyundai R210 gusenitsa zanjiri", ru: "Гусеничная цепь Hyundai R210", en: "Hyundai R210 Track Chain" },
    sku: "DP-TRC-R210",
    oemNumber: "81N6-15030",
    categoryId: "track-chain",
    brandId: "hyundai",
    description: {
      uz: "Hyundai R210 ekskavatorlari uchun bardoshli gusenitsa zanjiri.",
      ru: "Прочная гусеничная цепь для экскаваторов Hyundai R210.",
      en: "Heavy-duty track chain for Hyundai R210 excavators.",
    },
    compatibleModels: ["Hyundai R210", "Hyundai R220"],
    stockStatus: "available",
    specs: [
      { label: { uz: "Bo'g'inlar soni", ru: "Количество звеньев", en: "Link Count" }, value: "45" },
      { label: { uz: "Kafolat", ru: "Гарантия", en: "Warranty" }, value: "12 months" },
    ],
    imageLabels: ["Front", "Side"],
  },
  {
    id: "doosan-seal-dx225",
    slug: "doosan-seal-kit-dx225",
    name: { uz: "Doosan DX225 zichlagich to'plami", ru: "Комплект уплотнений Doosan DX225", en: "Doosan DX225 Seal Kit" },
    sku: "DP-SEL-DX225",
    oemNumber: "2454-1030A",
    categoryId: "seal-kit",
    brandId: "doosan",
    description: {
      uz: "Doosan DX225 gidravlik silindrlari uchun zichlagich to'plami.",
      ru: "Комплект уплотнений для гидроцилиндров Doosan DX225.",
      en: "Seal kit for Doosan DX225 hydraulic cylinders.",
    },
    compatibleModels: ["Doosan DX225", "Doosan DX235"],
    stockStatus: "limited",
    specs: [
      { label: { uz: "Material", ru: "Материал", en: "Material" }, value: "Polyurethane" },
      { label: { uz: "Kafolat", ru: "Гарантия", en: "Warranty" }, value: "6 months" },
    ],
    imageLabels: ["Front", "Package"],
  },
  {
    id: "cat-turbo-c15",
    slug: "cat-turbocharger-c15",
    name: { uz: "CAT C15 turbokompressori", ru: "Турбокомпрессор CAT C15", en: "CAT C15 Turbocharger" },
    sku: "DP-TRB-C15",
    oemNumber: "179-9210",
    categoryId: "turbocharger",
    brandId: "cat",
    description: {
      uz: "CAT C15 dvigatellari uchun yuqori samarali turbokompressor.",
      ru: "Высокоэффективный турбокомпрессор для двигателей CAT C15.",
      en: "High-performance turbocharger for CAT C15 engines.",
    },
    compatibleModels: ["CAT C15", "CAT C13"],
    stockStatus: "available",
    specs: [
      { label: { uz: "Tur", ru: "Тип", en: "Type" }, value: "Variable geometry" },
      { label: { uz: "Kafolat", ru: "Гарантия", en: "Warranty" }, value: "12 months" },
    ],
    imageLabels: ["Front", "Side", "Package"],
  },
  {
    id: "komatsu-injector-pc300",
    slug: "komatsu-fuel-injector-pc300",
    name: { uz: "Komatsu PC300 yonilg'i forsunkasi", ru: "Топливная форсунка Komatsu PC300", en: "Komatsu PC300 Fuel Injector" },
    sku: "DP-INJ-PC300",
    oemNumber: "6156-11-3300",
    categoryId: "injector",
    brandId: "komatsu",
    description: {
      uz: "Komatsu PC300 ekskavatorlari uchun yonilg'i forsunkasi.",
      ru: "Топливная форсунка для экскаваторов Komatsu PC300.",
      en: "Fuel injector for Komatsu PC300 excavators.",
    },
    compatibleModels: ["Komatsu PC300-7", "Komatsu PC300-8"],
    stockStatus: "available",
    specs: [
      { label: { uz: "Materiali", ru: "Материал", en: "Material" }, value: "Steel alloy" },
      { label: { uz: "Kafolat", ru: "Гарантия", en: "Warranty" }, value: "12 months" },
    ],
    imageLabels: ["Front", "Side"],
  },
  {
    id: "volvo-valve-l120",
    slug: "volvo-transmission-valve-l120",
    name: { uz: "Volvo L120 transmissiya klapani", ru: "Клапан трансмиссии Volvo L120", en: "Volvo L120 Transmission Valve" },
    sku: "DP-VLV-L120",
    oemNumber: "VOE11192370",
    categoryId: "valve",
    brandId: "volvo",
    description: {
      uz: "Volvo L120 yuklagichlari uchun transmissiya boshqaruv klapani.",
      ru: "Клапан управления трансмиссией для погрузчиков Volvo L120.",
      en: "Transmission control valve for Volvo L120 loaders.",
    },
    compatibleModels: ["Volvo L120E", "Volvo L120F"],
    stockStatus: "limited",
    specs: [
      { label: { uz: "Tur", ru: "Тип", en: "Type" }, value: "Solenoid" },
      { label: { uz: "Kafolat", ru: "Гарантия", en: "Warranty" }, value: "6 months" },
    ],
    imageLabels: ["Front", "Package"],
  },
  {
    id: "hitachi-hyp-ex200",
    slug: "hitachi-hydraulic-pump-ex200",
    name: { uz: "Hitachi EX200 gidravlik nasosi", ru: "Гидравлический насос Hitachi EX200", en: "Hitachi EX200 Hydraulic Pump" },
    sku: "DP-HYP-EX200",
    oemNumber: "9148983",
    categoryId: "hydraulic-pump",
    brandId: "hitachi",
    description: {
      uz: "Hitachi EX200 ekskavatorlari uchun asosiy gidravlik nasos.",
      ru: "Основной гидравлический насос для экскаваторов Hitachi EX200.",
      en: "Main hydraulic pump for Hitachi EX200 excavators.",
    },
    compatibleModels: ["Hitachi EX200-3", "Hitachi EX200-5"],
    stockStatus: "available",
    specs: [
      { label: { uz: "Bosim", ru: "Давление", en: "Pressure" }, value: "320 bar" },
      { label: { uz: "Kafolat", ru: "Гарантия", en: "Warranty" }, value: "12 months" },
    ],
    imageLabels: ["Front", "Side", "Package"],
  },
  {
    id: "jcb-undercarriage-js220",
    slug: "jcb-undercarriage-roller-js220",
    name: { uz: "JCB JS220 yurish g'ildiragi", ru: "Ходовой каток JCB JS220", en: "JCB JS220 Undercarriage Roller" },
    sku: "DP-UNC-JS220",
    oemNumber: "333/G6154",
    categoryId: "undercarriage",
    brandId: "jcb",
    description: {
      uz: "JCB JS220 ekskavatorlari uchun yurish qismi g'ildiragi.",
      ru: "Ходовой каток для экскаваторов JCB JS220.",
      en: "Undercarriage roller for JCB JS220 excavators.",
    },
    compatibleModels: ["JCB JS220", "JCB JS210"],
    stockStatus: "available",
    specs: [
      { label: { uz: "Og'irligi", ru: "Вес", en: "Weight" }, value: "38 kg" },
      { label: { uz: "Kafolat", ru: "Гарантия", en: "Warranty" }, value: "12 months" },
    ],
    imageLabels: ["Front", "Side"],
  },
  {
    id: "hyundai-piston-r220",
    slug: "hyundai-piston-ring-r220",
    name: { uz: "Hyundai R220 porshen halqasi", ru: "Поршневое кольцо Hyundai R220", en: "Hyundai R220 Piston Ring" },
    sku: "DP-PSR-R220",
    oemNumber: "21N6-32020",
    categoryId: "piston",
    brandId: "hyundai",
    description: {
      uz: "Hyundai R220 dvigatellari uchun porshen halqalari to'plami.",
      ru: "Комплект поршневых колец для двигателей Hyundai R220.",
      en: "Piston ring set for Hyundai R220 engines.",
    },
    compatibleModels: ["Hyundai R220", "Hyundai R210"],
    stockStatus: "out_of_stock",
    specs: [
      { label: { uz: "Diametri", ru: "Диаметр", en: "Diameter" }, value: "102 mm" },
      { label: { uz: "Kafolat", ru: "Гарантия", en: "Warranty" }, value: "6 months" },
    ],
    imageLabels: ["Front", "Package"],
  },
  {
    id: "doosan-valve-dx140",
    slug: "doosan-engine-valve-dx140",
    name: { uz: "Doosan DX140 dvigatel klapani", ru: "Клапан двигателя Doosan DX140", en: "Doosan DX140 Engine Valve" },
    sku: "DP-ENV-DX140",
    oemNumber: "65.02601-6019A",
    categoryId: "valve",
    brandId: "doosan",
    description: {
      uz: "Doosan DX140 dvigatellari uchun kirish/chiqish klapani.",
      ru: "Впускной/выпускной клапан для двигателей Doosan DX140.",
      en: "Intake/exhaust valve for Doosan DX140 engines.",
    },
    compatibleModels: ["Doosan DX140", "Doosan DX160"],
    stockStatus: "available",
    specs: [
      { label: { uz: "Materiali", ru: "Материал", en: "Material" }, value: "Chrome-plated steel" },
      { label: { uz: "Kafolat", ru: "Гарантия", en: "Warranty" }, value: "12 months" },
    ],
    imageLabels: ["Front", "Package"],
  },
  {
    id: "cat-transmission-950",
    slug: "cat-transmission-filter-950",
    name: { uz: "CAT 950 transmissiya filtri", ru: "Фильтр трансмиссии CAT 950", en: "CAT 950 Transmission Filter" },
    sku: "DP-TRF-950",
    oemNumber: "132-9863",
    categoryId: "transmission",
    brandId: "cat",
    description: {
      uz: "CAT 950 yuklagichlari uchun transmissiya moyi filtri.",
      ru: "Фильтр трансмиссионного масла для погрузчиков CAT 950.",
      en: "Transmission oil filter for CAT 950 loaders.",
    },
    compatibleModels: ["CAT 950G", "CAT 950H"],
    stockStatus: "limited",
    specs: [
      { label: { uz: "Filtrlash darajasi", ru: "Степень фильтрации", en: "Filtration Rating" }, value: "10 microns" },
      { label: { uz: "Kafolat", ru: "Гарантия", en: "Warranty" }, value: "6 months" },
    ],
    imageLabels: ["Front", "Package"],
  },
];
```

- [ ] **Step 7: Create `lib/data/blog.ts`**

```ts
import type { BlogPost } from "@/lib/types";

export const blogPosts: BlogPost[] = [
  {
    id: "choosing-diesel-injectors",
    slug: "how-to-choose-diesel-injectors",
    title: {
      uz: "Diesel dvigatel forsunkalarini qanday tanlash kerak",
      ru: "Как выбрать форсунки для дизельного двигателя",
      en: "How to Choose Diesel Engine Injectors",
    },
    excerpt: {
      uz: "To'g'ri forsunkani tanlash dvigatel unumdorligi va yoqilg'i sarfiga bevosita ta'sir qiladi.",
      ru: "Правильный выбор форсунки напрямую влияет на производительность двигателя и расход топлива.",
      en: "Choosing the right injector directly affects engine performance and fuel consumption.",
    },
    body: {
      uz: "Diesel dvigatel forsunkasi yonilg'ini yuqori bosim ostida silindrga purkaydi. Noto'g'ri yoki eskirgan forsunka dvigatel quvvatini pasaytiradi va yoqilg'i sarfini oshiradi.\n\nForsunka tanlashda OEM raqami, dvigatel modeli va ishlab chiqarilgan yili muhim. Har doim asl OEM raqami bo'yicha moslikni tekshiring.",
      ru: "Форсунка дизельного двигателя впрыскивает топливо в цилиндр под высоким давлением. Неисправная или изношенная форсунка снижает мощность двигателя и увеличивает расход топлива.\n\nПри выборе форсунки важны номер OEM, модель двигателя и год выпуска. Всегда проверяйте совместимость по оригинальному номеру OEM.",
      en: "A diesel engine injector sprays fuel into the cylinder under high pressure. A faulty or worn injector reduces engine power and increases fuel consumption.\n\nWhen choosing an injector, the OEM number, engine model, and production year all matter. Always verify compatibility against the original OEM number.",
    },
    publishedAt: "2026-02-10",
  },
  {
    id: "turbocharger-failure-reasons",
    slug: "5-reasons-turbocharger-fails",
    title: {
      uz: "Turbokompressor ishlamay qolishining 5 sababi",
      ru: "5 причин выхода из строя турбокомпрессора",
      en: "5 Reasons a Turbocharger Fails",
    },
    excerpt: {
      uz: "Turbokompressor nosozliklarining aksariyati moylash yoki filtrlash muammolaridan kelib chiqadi.",
      ru: "Большинство неисправностей турбокомпрессора связано с проблемами смазки или фильтрации.",
      en: "Most turbocharger failures stem from lubrication or filtration problems.",
    },
    body: {
      uz: "1. Yetarli moylanmaslik. 2. Havo filtridagi ifloslanish. 3. Yog' filtridagi ifloslanish. 4. Issiqlik ta'siridan ortiqcha yuklanish. 5. O'rnatishdagi xatoliklar.\n\nMuntazam texnik xizmat va sifatli filtrlar turbokompressor umrini sezilarli darajada uzaytiradi.",
      ru: "1. Недостаточная смазка. 2. Загрязнение воздушного фильтра. 3. Загрязнение масляного фильтра. 4. Перегрев из-за избыточной нагрузки. 5. Ошибки при установке.\n\nРегулярное техническое обслуживание и качественные фильтры значительно продлевают срок службы турбокомпрессора.",
      en: "1. Insufficient lubrication. 2. Air filter contamination. 3. Oil filter contamination. 4. Overheating from excessive load. 5. Installation errors.\n\nRegular maintenance and quality filters significantly extend a turbocharger's lifespan.",
    },
    publishedAt: "2026-03-05",
  },
  {
    id: "oem-vs-aftermarket",
    slug: "oem-vs-aftermarket-parts",
    title: {
      uz: "OEM va aftermarket ehtiyot qismlar farqi",
      ru: "Разница между OEM и neоригинальными запчастями",
      en: "OEM vs. Aftermarket Parts: What's the Difference?",
    },
    excerpt: {
      uz: "Narx va sifat o'rtasidagi muvozanatni tushunish to'g'ri qismni tanlashga yordam beradi.",
      ru: "Понимание баланса между ценой и качеством помогает выбрать правильную деталь.",
      en: "Understanding the balance between price and quality helps you choose the right part.",
    },
    body: {
      uz: "OEM qismlar asl ishlab chiqaruvchi standartlariga to'liq mos keladi va uzoq muddatli ishonchlilikni ta'minlaydi. Aftermarket qismlar odatda arzonroq, lekin sifat darajasi ishlab chiqaruvchiga qarab farq qiladi.\n\nDieselParts barcha mahsulotlarini OEM sifat standartlariga muvofiqligini tekshirib, keyin katalogga qo'shadi.",
      ru: "Оригинальные запчасти (OEM) полностью соответствуют стандартам производителя и обеспечивают долгосрочную надёжность. Неоригинальные запчасти обычно дешевле, но их качество зависит от производителя.\n\nDieselParts проверяет соответствие всех товаров стандартам OEM перед добавлением в каталог.",
      en: "OEM parts fully match the original manufacturer's standards and provide long-term reliability. Aftermarket parts are usually cheaper, but quality varies by manufacturer.\n\nDieselParts verifies every product's compliance with OEM quality standards before adding it to the catalog.",
    },
    publishedAt: "2026-04-18",
  },
];
```

- [ ] **Step 8: Run the tests and verify they pass**

Run: `npm run test`
Expected: PASS.

- [ ] **Step 9: Verify lint, typecheck, and build**

Run: `npm run lint` — expected: no errors.
Run: `npx tsc --noEmit` — expected: no errors.
Run: `npm run build` — expected: succeeds.

- [ ] **Step 10: Commit**

```bash
git add lib/types.ts lib/data
git commit -m "feat: add typed mock data for brands, categories, products, and blog posts"
```

---

## Task 4: Base UI primitives

**Files:**
- Create: `components/ui/button.tsx`, `components/ui/input.tsx`, `components/ui/textarea.tsx`, `components/ui/label.tsx`, `components/ui/card.tsx`, `components/ui/badge.tsx`

**Interfaces:**
- Produces: `Button({ variant?: "default"|"outline"|"ghost", size?: "default"|"sm"|"lg", asChild?: boolean, ...props }: React.ComponentProps<"button"> & {...})`.
- Produces: `Input(props: React.ComponentProps<"input">)`, `Textarea(props: React.ComponentProps<"textarea">)`, `Label(props: React.ComponentProps<"label">)`.
- Produces: `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter` (thin styled `div`/`h3`/`p` wrappers, same composition pattern as shadcn/ui).
- Produces: `Badge({ variant?: "default"|"success"|"warning"|"danger", ...props }: React.ComponentProps<"span"> & {...})` — used for stock-status badges in Task 10.
- These are presentational-only (no branching logic beyond variant→class lookup) — **no unit tests**, verified via `tsc`/`next lint`/`next build` and later manual dev-server checks.

- [ ] **Step 1: Create `components/ui/button.tsx`**

```tsx
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-accent text-black hover:bg-accent/90",
        outline: "border border-border text-foreground hover:bg-white/5",
        ghost: "text-foreground hover:bg-white/5",
      },
      size: {
        default: "h-10 px-4",
        sm: "h-8 px-3 text-xs",
        lg: "h-12 px-6 text-base",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ComponentProps<"button">,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <button className={cn(buttonVariants({ variant, size }), className)} {...props} />
  );
}
```

- [ ] **Step 2: Create `components/ui/input.tsx`**

```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-md border border-border bg-transparent px-3 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent",
        className
      )}
      {...props}
    />
  );
}
```

- [ ] **Step 3: Create `components/ui/textarea.tsx`**

```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "min-h-24 w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent",
        className
      )}
      {...props}
    />
  );
}
```

- [ ] **Step 4: Create `components/ui/label.tsx`**

```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

export function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      className={cn("text-sm font-medium text-foreground", className)}
      {...props}
    />
  );
}
```

- [ ] **Step 5: Create `components/ui/card.tsx`**

```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("rounded-lg border border-border bg-white/2", className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("p-6 pb-0", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return <h3 className={cn("text-lg font-semibold text-foreground", className)} {...props} />;
}

export function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn("text-sm text-muted", className)} {...props} />;
}

export function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("p-6", className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex items-center p-6 pt-0", className)} {...props} />;
}
```

- [ ] **Step 6: Create `components/ui/badge.tsx`**

```tsx
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        default: "bg-white/10 text-foreground",
        success: "bg-emerald-500/15 text-emerald-400",
        warning: "bg-accent/15 text-accent",
        danger: "bg-red-500/15 text-red-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.ComponentProps<"span">,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
```

- [ ] **Step 7: Verify lint, typecheck, and build**

Run: `npm run lint` — expected: no errors.
Run: `npx tsc --noEmit` — expected: no errors.
Run: `npm run build` — expected: succeeds (these components aren't imported anywhere yet, so this only confirms they compile cleanly).

- [ ] **Step 8: Commit**

```bash
git add components/ui
git commit -m "feat: add base UI primitives (button, input, textarea, label, card, badge)"
```

---

## Task 5: Header (Tesla-style nav)

**Files:**
- Create: `lib/scroll.ts`
- Test: `lib/scroll.test.ts`
- Create: `hooks/use-header-scroll.ts`
- Create: `components/layout/mobile-nav.tsx`, `components/layout/header.tsx`
- Modify: `app/[lang]/layout.tsx`

**Interfaces:**
- Consumes: `cn` from `@/lib/utils` (Task 1); `SUPPORTED_LOCALES`, `switchLocalePath`, `type Locale` from `@/lib/i18n/locales` (Task 2); `type Dictionary` from `@/lib/i18n/dictionaries` (Task 2) — specifically the `nav.{products,about,blog,contact,requestQuote,menu}` and `common.close` keys.
- Produces: `computeHeaderState(previousScrollY: number, currentScrollY: number): { solid: boolean; hidden: boolean }` from `@/lib/scroll`, and `HEADER_SOLID_THRESHOLD: number`.
- Produces: `useHeaderScroll(): { solid: boolean; hidden: boolean }` from `@/hooks/use-header-scroll` (client-only hook, not unit tested — manual verification in Step 8).
- Produces: `Header({ lang: Locale; siteName: string; nav: Dictionary["nav"]; closeLabel: string })` from `@/components/layout/header`.
- Produces: `MobileNav({ open: boolean; onClose: () => void; lang: Locale; nav: Dictionary["nav"]; closeLabel: string; navLinks: { href: string; label: string }[]; pathname: string })` from `@/components/layout/mobile-nav`.
- **Layout convention for all later page tasks**: `Header` is `position: fixed` and reserves no layout space. Every page's outermost content wrapper **other than Home's hero** (Task 7, which is designed full-bleed behind the transparent header) must add top padding — use `pt-24` — so content isn't hidden under the header at scroll-top.
- Nav palette constraint: `Header`/`MobileNav` use only `bg-black`/`text-white` (with opacity variants) and `bg-accent`/`text-accent` — no `bg-background`, `text-muted`, or `border-border`.

- [ ] **Step 1: Write the failing test for the scroll-state function**

Create `lib/scroll.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { computeHeaderState, HEADER_SOLID_THRESHOLD } from "./scroll";

describe("computeHeaderState", () => {
  it("stays transparent and visible at or above the top of the page", () => {
    expect(computeHeaderState(0, 0)).toEqual({ solid: false, hidden: false });
    expect(computeHeaderState(0, HEADER_SOLID_THRESHOLD)).toEqual({ solid: false, hidden: false });
  });

  it("becomes solid once scrolled past the threshold", () => {
    const state = computeHeaderState(0, HEADER_SOLID_THRESHOLD + 1);
    expect(state.solid).toBe(true);
  });

  it("hides when scrolling down past the threshold", () => {
    expect(computeHeaderState(100, 150)).toEqual({ solid: true, hidden: true });
  });

  it("reveals when scrolling up, even while still past the threshold", () => {
    expect(computeHeaderState(150, 100)).toEqual({ solid: true, hidden: false });
  });

  it("returns to transparent and visible when scrolling back above the threshold", () => {
    expect(computeHeaderState(100, HEADER_SOLID_THRESHOLD - 5)).toEqual({ solid: false, hidden: false });
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npm run test`
Expected: FAIL — `lib/scroll.ts` does not exist.

- [ ] **Step 3: Implement `lib/scroll.ts`**

```ts
export interface HeaderScrollState {
  solid: boolean;
  hidden: boolean;
}

export const HEADER_SOLID_THRESHOLD = 60;

export function computeHeaderState(
  previousScrollY: number,
  currentScrollY: number
): HeaderScrollState {
  if (currentScrollY <= HEADER_SOLID_THRESHOLD) {
    return { solid: false, hidden: false };
  }

  return {
    solid: true,
    hidden: currentScrollY > previousScrollY,
  };
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `npm run test`
Expected: PASS.

- [ ] **Step 5: Create the scroll hook**

Create `hooks/use-header-scroll.ts`:
```ts
"use client";

import { useEffect, useState } from "react";
import { computeHeaderState, type HeaderScrollState } from "@/lib/scroll";

const INITIAL_STATE: HeaderScrollState = { solid: false, hidden: false };

export function useHeaderScroll(): HeaderScrollState {
  const [state, setState] = useState<HeaderScrollState>(INITIAL_STATE);

  useEffect(() => {
    let previousScrollY = window.scrollY;

    function handleScroll() {
      const currentScrollY = window.scrollY;
      setState(computeHeaderState(previousScrollY, currentScrollY));
      previousScrollY = currentScrollY;
    }

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return state;
}
```

- [ ] **Step 6: Create the mobile fullscreen overlay nav**

Create `components/layout/mobile-nav.tsx`:
```tsx
"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { SUPPORTED_LOCALES, switchLocalePath, type Locale } from "@/lib/i18n/locales";
import type { Dictionary } from "@/lib/i18n/dictionaries";

interface NavLink {
  href: string;
  label: string;
}

interface MobileNavProps {
  open: boolean;
  onClose: () => void;
  lang: Locale;
  nav: Dictionary["nav"];
  closeLabel: string;
  navLinks: NavLink[];
  pathname: string;
}

export function MobileNav({
  open,
  onClose,
  lang,
  nav,
  closeLabel,
  navLinks,
  pathname,
}: MobileNavProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-60 flex flex-col bg-black text-white">
      <div className="flex h-16 items-center justify-end px-6">
        <button type="button" aria-label={closeLabel} onClick={onClose}>
          <X className="h-7 w-7" />
        </button>
      </div>

      <nav className="flex flex-1 flex-col items-center justify-center gap-8">
        {navLinks.map((link) => (
          <Link key={link.href} href={link.href} onClick={onClose} className="text-3xl font-medium">
            {link.label}
          </Link>
        ))}

        <Link
          href={`/${lang}/request-quote`}
          onClick={onClose}
          className="mt-4 rounded-md bg-accent px-6 py-3 text-lg font-medium text-black"
        >
          {nav.requestQuote}
        </Link>

        <div className="mt-8 flex items-center gap-4 text-sm uppercase text-white/70">
          {SUPPORTED_LOCALES.map((locale) => (
            <Link
              key={locale}
              href={switchLocalePath(pathname, locale)}
              onClick={onClose}
              className={locale === lang ? "text-white" : undefined}
            >
              {locale}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
```

- [ ] **Step 7: Create the Header**

Create `components/layout/header.tsx`:
```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHeaderScroll } from "@/hooks/use-header-scroll";
import { SUPPORTED_LOCALES, switchLocalePath, type Locale } from "@/lib/i18n/locales";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { MobileNav } from "./mobile-nav";

interface HeaderProps {
  lang: Locale;
  siteName: string;
  nav: Dictionary["nav"];
  closeLabel: string;
}

export function Header({ lang, siteName, nav, closeLabel }: HeaderProps) {
  const { solid, hidden } = useHeaderScroll();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinks = [
    { href: `/${lang}/products`, label: nav.products },
    { href: `/${lang}/about`, label: nav.about },
    { href: `/${lang}/blog`, label: nav.blog },
    { href: `/${lang}/contact`, label: nav.contact },
  ];

  return (
    <>
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-50 transition-all duration-200",
          solid ? "bg-black" : "bg-transparent",
          hidden ? "-translate-y-full" : "translate-y-0"
        )}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link href={`/${lang}`} className="text-lg font-semibold text-white">
            {siteName}
          </Link>

          <nav className="hidden items-center gap-8 md:flex">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-white/80 transition-colors hover:text-white"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-4 md:flex">
            <div className="flex items-center gap-1 text-sm text-white/70">
              {SUPPORTED_LOCALES.map((locale) => (
                <Link
                  key={locale}
                  href={switchLocalePath(pathname, locale)}
                  className={cn(
                    "px-1.5 uppercase transition-colors hover:text-white",
                    locale === lang && "text-white"
                  )}
                >
                  {locale}
                </Link>
              ))}
            </div>
            <Link
              href={`/${lang}/request-quote`}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-accent/90"
            >
              {nav.requestQuote}
            </Link>
          </div>

          <button
            type="button"
            aria-label={nav.menu}
            onClick={() => setMobileOpen(true)}
            className="text-white md:hidden"
          >
            <Menu className="h-6 w-6" />
          </button>
        </div>
      </header>

      <MobileNav
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        lang={lang}
        nav={nav}
        closeLabel={closeLabel}
        navLinks={navLinks}
        pathname={pathname}
      />
    </>
  );
}
```

- [ ] **Step 8: Wire the Header into the root layout**

In `app/[lang]/layout.tsx`, add the import and render `<Header>` as the first child of `<body>`:
```tsx
import { Header } from "@/components/layout/header";
```

Replace:
```tsx
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
      </body>
```
with:
```tsx
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Header lang={lang} siteName={dict.meta.siteName} nav={dict.nav} closeLabel={dict.common.close} />
        {children}
      </body>
```

- [ ] **Step 9: Verify lint, typecheck, build, and manual scroll behavior**

Run: `npm run lint` — expected: no errors.
Run: `npx tsc --noEmit` — expected: no errors.
Run: `npm run build` — expected: succeeds.

Run: `npm run dev`, visit `http://localhost:3000/uz`, and manually verify:
- Header is transparent with white text at the top of the page.
- Scrolling down ~100px turns the header solid black, then hides it as you keep scrolling down.
- Scrolling up reveals the solid header immediately.
- Scrolling back to the top returns it to transparent.
- On a narrow viewport (or browser dev tools mobile emulation), tapping the hamburger opens a fullscreen black overlay with large nav links, the Request Quote button, and the locale switcher; tapping a link or the close icon closes it.
Stop the dev server afterward.

- [ ] **Step 10: Commit**

```bash
git add lib/scroll.ts lib/scroll.test.ts hooks/use-header-scroll.ts components/layout/header.tsx components/layout/mobile-nav.tsx "app/[lang]/layout.tsx"
git commit -m "feat: add Tesla-style header with scroll behavior and mobile fullscreen nav"
```

---

## Task 6: Footer

**Files:**
- Create: `components/layout/footer.tsx`
- Modify: `app/[lang]/layout.tsx`

**Interfaces:**
- Consumes: `type Dictionary`, `type Locale` (Task 2). Unlike `Header`, `Footer` uses the full design-token palette (`bg-background`, `text-foreground`, `text-muted`, `border-border`) — the black/white/accent-only constraint applies only to `Header`/`MobileNav`.
- Produces: `Footer({ lang: Locale; siteName: string; footer: Dictionary["footer"]; nav: Dictionary["nav"]; phone: string })` from `@/components/layout/footer`. Note `phone` is sourced from `dict.contact.phone` (the `footer` dictionary namespace has a `phoneLabel` but no phone value of its own).
- Produces: `app/[lang]/layout.tsx` now renders `<Header>{children}<Footer></Footer>` inside `<body>`, completing the page shell every later page task renders into.

- [ ] **Step 1: Create the Footer component**

Create `components/layout/footer.tsx`:
```tsx
import Link from "next/link";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";

interface FooterProps {
  lang: Locale;
  siteName: string;
  footer: Dictionary["footer"];
  nav: Dictionary["nav"];
  phone: string;
}

export function Footer({ lang, siteName, footer, nav, phone }: FooterProps) {
  const year = new Date().getFullYear();

  const links = [
    { href: `/${lang}/products`, label: nav.products },
    { href: `/${lang}/about`, label: nav.about },
    { href: `/${lang}/blog`, label: nav.blog },
    { href: `/${lang}/contact`, label: nav.contact },
  ];

  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-16 md:grid-cols-3">
        <div>
          <p className="text-lg font-semibold text-foreground">{siteName}</p>
          <p className="mt-3 max-w-sm text-sm text-muted">{footer.description}</p>
        </div>

        <div>
          <p className="text-sm font-semibold text-foreground">{footer.linksTitle}</p>
          <ul className="mt-3 space-y-2">
            {links.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="text-sm text-muted transition-colors hover:text-foreground">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-sm font-semibold text-foreground">{footer.contactTitle}</p>
          <dl className="mt-3 space-y-2 text-sm text-muted">
            <div>
              <dt className="inline text-foreground">{footer.addressLabel}: </dt>
              <dd className="inline">{footer.address}</dd>
            </div>
            <div>
              <dt className="inline text-foreground">{footer.phoneLabel}: </dt>
              <dd className="inline">{phone}</dd>
            </div>
            <div>
              <dd>{footer.email}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="border-t border-border px-6 py-6 text-center text-xs text-muted">
        © {year} {siteName}. {footer.rights}
      </div>
    </footer>
  );
}
```

- [ ] **Step 2: Wire the Footer into the root layout**

In `app/[lang]/layout.tsx`, add the import:
```tsx
import { Footer } from "@/components/layout/footer";
```

Replace:
```tsx
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Header lang={lang} siteName={dict.meta.siteName} nav={dict.nav} closeLabel={dict.common.close} />
        {children}
      </body>
```
with:
```tsx
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Header lang={lang} siteName={dict.meta.siteName} nav={dict.nav} closeLabel={dict.common.close} />
        {children}
        <Footer lang={lang} siteName={dict.meta.siteName} footer={dict.footer} nav={dict.nav} phone={dict.contact.phone} />
      </body>
```

- [ ] **Step 3: Verify lint, typecheck, build, and manual check**

Run: `npm run lint` — expected: no errors.
Run: `npx tsc --noEmit` — expected: no errors.
Run: `npm run build` — expected: succeeds.

Run: `npm run dev`, visit `http://localhost:3000/uz`, and manually verify the footer renders at the bottom with the description, links, and contact details in Uzbek. Stop the dev server afterward.

- [ ] **Step 4: Commit**

```bash
git add components/layout/footer.tsx "app/[lang]/layout.tsx"
git commit -m "feat: add site footer"
```

---

## Task 7: Home page

**Files:**
- Create: `components/marketing/hero.tsx`, `components/marketing/trust-badges.tsx`, `components/marketing/category-card.tsx`, `components/marketing/category-grid.tsx`, `components/marketing/brand-logo.tsx`, `components/marketing/brand-grid.tsx`, `components/marketing/product-card.tsx`, `components/marketing/featured-products.tsx`, `components/marketing/cta-banner.tsx`
- Modify: `app/[lang]/page.tsx` (full rewrite, replacing the Task 2 stub)

**Interfaces:**
- Consumes: `products`, `categories`, `brands` from `@/lib/data/*` (Task 3); `Badge` from `@/components/ui/badge` (Task 4); `type Locale`, `isLocale`, `DEFAULT_LOCALE` from `@/lib/i18n/locales`; `type Dictionary`, `getDictionary` from `@/lib/i18n/dictionaries` (Task 2).
- **Locale-resolution convention for every remaining page task**: resolve the typed `Locale` from the raw route param with `const lang = isLocale(rawLang) ? rawLang : DEFAULT_LOCALE;` (from `@/lib/i18n/locales`), then call `getDictionary(lang)` for content. Don't use `dictionaries.ts`'s `hasLocale` in page code — it exists only for the dictionary-key-structure test in Task 2.
- Produces: `ProductCard({ product: Product; lang: Locale; categoryName: string; brandName: string; stock: Dictionary["common"]["stock"]; requestPriceLabel: string })` from `@/components/marketing/product-card` — **this is the shared product card reused by Tasks 8, 9, 10, and 11.** It links to `/${lang}/products/${product.slug}`, shows brand name, a stock `Badge` (`available`→`success`, `limited`→`warning`, `out_of_stock`→`danger`), product name, category name, and the `requestPriceLabel`.
- Produces: `CategoryCard({ category: Category; lang: Locale })`, `CategoryGrid({ lang: Locale })` (renders all 10 mock categories) from `@/components/marketing/category-*`.
- Produces: `BrandLogo({ brand: Brand; lang: Locale })`, `BrandGrid({ lang: Locale })` (renders all 7 mock brands) from `@/components/marketing/brand-*`.
- Produces: `Hero({ lang: Locale; home: Dictionary["home"] })` — full-bleed (`min-h-screen`) section designed to sit behind the transparent `Header` at scroll-top; not part of the `pt-24` convention from Task 5.
- Produces: `TrustBadges({ items: Dictionary["home"]["trustBadges"] })`, `FeaturedProducts({ lang: Locale; stock: Dictionary["common"]["stock"]; requestPriceLabel: string })` (renders the first 4 mock products via `ProductCard`), `CtaBanner({ lang: Locale; home: Dictionary["home"] })`.

- [ ] **Step 1: Create the product card**

Create `components/marketing/product-card.tsx`:
```tsx
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { Product } from "@/lib/types";
import type { Locale } from "@/lib/i18n/locales";
import type { Dictionary } from "@/lib/i18n/dictionaries";

const STOCK_VARIANT: Record<Product["stockStatus"], "success" | "warning" | "danger"> = {
  available: "success",
  limited: "warning",
  out_of_stock: "danger",
};

function stockKey(status: Product["stockStatus"]): keyof Dictionary["common"]["stock"] {
  return status === "out_of_stock" ? "outOfStock" : status;
}

interface ProductCardProps {
  product: Product;
  lang: Locale;
  categoryName: string;
  brandName: string;
  stock: Dictionary["common"]["stock"];
  requestPriceLabel: string;
}

export function ProductCard({
  product,
  lang,
  categoryName,
  brandName,
  stock,
  requestPriceLabel,
}: ProductCardProps) {
  return (
    <Link
      href={`/${lang}/products/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-lg border border-border bg-white/2 transition-colors hover:border-accent/60"
    >
      <div className="flex aspect-4/3 items-center justify-center bg-linear-to-br from-white/6 to-transparent text-sm text-muted">
        {product.imageLabels[0]}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-center justify-between text-xs text-muted">
          <span>{brandName}</span>
          <Badge variant={STOCK_VARIANT[product.stockStatus]}>{stock[stockKey(product.stockStatus)]}</Badge>
        </div>
        <h3 className="text-sm font-medium text-foreground group-hover:text-accent">
          {product.name[lang]}
        </h3>
        <p className="text-xs text-muted">{categoryName}</p>
        <p className="mt-auto text-sm font-medium text-accent">{requestPriceLabel}</p>
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: Create the category card and grid**

Create `components/marketing/category-card.tsx`:
```tsx
import Link from "next/link";
import type { Category } from "@/lib/types";
import type { Locale } from "@/lib/i18n/locales";

export function CategoryCard({ category, lang }: { category: Category; lang: Locale }) {
  return (
    <Link
      href={`/${lang}/categories/${category.slug}`}
      className="flex flex-col items-center justify-center gap-2 rounded-lg border border-border bg-white/2 px-4 py-8 text-center transition-colors hover:border-accent/60"
    >
      <span className="text-sm font-medium text-foreground">{category.name[lang]}</span>
    </Link>
  );
}
```

Create `components/marketing/category-grid.tsx`:
```tsx
import { categories } from "@/lib/data/categories";
import type { Locale } from "@/lib/i18n/locales";
import { CategoryCard } from "./category-card";

export function CategoryGrid({ lang }: { lang: Locale }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {categories.map((category) => (
        <CategoryCard key={category.id} category={category} lang={lang} />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Create the brand logo and grid**

Create `components/marketing/brand-logo.tsx`:
```tsx
import Link from "next/link";
import type { Brand } from "@/lib/types";
import type { Locale } from "@/lib/i18n/locales";

export function BrandLogo({ brand, lang }: { brand: Brand; lang: Locale }) {
  return (
    <Link
      href={`/${lang}/brands/${brand.slug}`}
      className="flex h-20 items-center justify-center rounded-lg border border-border bg-white/2 text-lg font-semibold tracking-wide text-muted transition-colors hover:border-accent/60 hover:text-foreground"
    >
      {brand.name}
    </Link>
  );
}
```

Create `components/marketing/brand-grid.tsx`:
```tsx
import { brands } from "@/lib/data/brands";
import type { Locale } from "@/lib/i18n/locales";
import { BrandLogo } from "./brand-logo";

export function BrandGrid({ lang }: { lang: Locale }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">
      {brands.map((brand) => (
        <BrandLogo key={brand.id} brand={brand} lang={lang} />
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Create the featured products section**

Create `components/marketing/featured-products.tsx`:
```tsx
import { products } from "@/lib/data/products";
import { categories } from "@/lib/data/categories";
import { brands } from "@/lib/data/brands";
import type { Locale } from "@/lib/i18n/locales";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { ProductCard } from "./product-card";

const FEATURED_COUNT = 4;

export function FeaturedProducts({
  lang,
  stock,
  requestPriceLabel,
}: {
  lang: Locale;
  stock: Dictionary["common"]["stock"];
  requestPriceLabel: string;
}) {
  const featured = products.slice(0, FEATURED_COUNT);

  return (
    <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
      {featured.map((product) => {
        const category = categories.find((c) => c.id === product.categoryId)!;
        const brand = brands.find((b) => b.id === product.brandId)!;
        return (
          <ProductCard
            key={product.id}
            product={product}
            lang={lang}
            categoryName={category.name[lang]}
            brandName={brand.name}
            stock={stock}
            requestPriceLabel={requestPriceLabel}
          />
        );
      })}
    </div>
  );
}
```

- [ ] **Step 5: Create the hero, trust badges, and CTA banner**

Create `components/marketing/hero.tsx`:
```tsx
import Link from "next/link";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";

export function Hero({ lang, home }: { lang: Locale; home: Dictionary["home"] }) {
  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden bg-linear-to-b from-[#1a1d24] via-background to-background px-6 text-center">
      <div className="max-w-3xl">
        <h1 className="text-4xl font-semibold text-foreground sm:text-6xl">{home.heroTitle}</h1>
        <p className="mt-6 text-lg text-muted">{home.heroSubtitle}</p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            href={`/${lang}/products`}
            className="rounded-md bg-accent px-6 py-3 text-sm font-medium text-black transition-colors hover:bg-accent/90"
          >
            {home.heroCtaCatalog}
          </Link>
          <Link
            href={`/${lang}/request-quote`}
            className="rounded-md border border-border px-6 py-3 text-sm font-medium text-foreground transition-colors hover:bg-white/5"
          >
            {home.heroCtaQuote}
          </Link>
        </div>
      </div>
    </section>
  );
}
```

Create `components/marketing/trust-badges.tsx`:
```tsx
import type { Dictionary } from "@/lib/i18n/dictionaries";

export function TrustBadges({ items }: { items: Dictionary["home"]["trustBadges"] }) {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <div key={item.title} className="rounded-lg border border-border bg-white/2 p-6">
          <p className="text-base font-semibold text-foreground">{item.title}</p>
          <p className="mt-2 text-sm text-muted">{item.description}</p>
        </div>
      ))}
    </div>
  );
}
```

Create `components/marketing/cta-banner.tsx`:
```tsx
import Link from "next/link";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";

export function CtaBanner({ lang, home }: { lang: Locale; home: Dictionary["home"] }) {
  return (
    <section className="rounded-lg border border-accent/30 bg-accent/10 px-6 py-16 text-center">
      <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">{home.ctaBannerTitle}</h2>
      <p className="mx-auto mt-3 max-w-xl text-sm text-muted">{home.ctaBannerText}</p>
      <Link
        href={`/${lang}/contact`}
        className="mt-8 inline-block rounded-md bg-accent px-6 py-3 text-sm font-medium text-black transition-colors hover:bg-accent/90"
      >
        {home.ctaBannerButton}
      </Link>
    </section>
  );
}
```

- [ ] **Step 6: Rewrite the Home page**

Replace the full contents of `app/[lang]/page.tsx`:
```tsx
import type { Metadata } from "next";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/locales";
import { Hero } from "@/components/marketing/hero";
import { TrustBadges } from "@/components/marketing/trust-badges";
import { CategoryGrid } from "@/components/marketing/category-grid";
import { BrandGrid } from "@/components/marketing/brand-grid";
import { FeaturedProducts } from "@/components/marketing/featured-products";
import { CtaBanner } from "@/components/marketing/cta-banner";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const dict = getDictionary(lang);
  return {
    title: `${dict.meta.siteName} — ${dict.home.heroTitle}`,
    description: dict.home.heroSubtitle,
  };
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang = isLocale(rawLang) ? rawLang : DEFAULT_LOCALE;
  const dict = getDictionary(lang);

  return (
    <main>
      <Hero lang={lang} home={dict.home} />

      <section className="mx-auto max-w-7xl px-6 py-20">
        <TrustBadges items={dict.home.trustBadges} />
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20">
        <h2 className="text-2xl font-semibold text-foreground">{dict.home.aboutTitle}</h2>
        <p className="mt-4 max-w-2xl text-muted">{dict.home.aboutText}</p>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20">
        <h2 className="text-2xl font-semibold text-foreground">{dict.home.categoriesTitle}</h2>
        <p className="mt-2 text-sm text-muted">{dict.home.categoriesSubtitle}</p>
        <div className="mt-8">
          <CategoryGrid lang={lang} />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20">
        <h2 className="text-2xl font-semibold text-foreground">{dict.home.brandsTitle}</h2>
        <div className="mt-8">
          <BrandGrid lang={lang} />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20">
        <h2 className="text-2xl font-semibold text-foreground">{dict.home.featuredTitle}</h2>
        <div className="mt-8">
          <FeaturedProducts lang={lang} stock={dict.common.stock} requestPriceLabel={dict.common.requestPrice} />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-24">
        <CtaBanner lang={lang} home={dict.home} />
      </section>
    </main>
  );
}
```

- [ ] **Step 7: Verify lint, typecheck, build, and manual check**

Run: `npm run lint` — expected: no errors.
Run: `npx tsc --noEmit` — expected: no errors.
Run: `npm run build` — expected: succeeds.

Run: `npm run dev`, visit `http://localhost:3000/uz`, `/ru`, and `/en`, and manually verify: hero renders full-bleed behind the transparent header, trust badges/about/categories/brands/featured-products/CTA banner all render with localized copy, and category/brand/product cards link correctly. Stop the dev server afterward.

- [ ] **Step 8: Commit**

```bash
git add components/marketing "app/[lang]/page.tsx"
git commit -m "feat: build the Home page (hero, trust badges, categories, brands, featured products, CTA)"
```

---

## Task 8: Filter/sort logic and Catalog page

**Files:**
- Create: `lib/filters.ts`
- Test: `lib/filters.test.ts`
- Create: `components/product/product-filters.tsx`, `components/product/product-catalog-client.tsx`
- Create: `app/[lang]/products/page.tsx`

**Interfaces:**
- Consumes: `products` from `@/lib/data/products`, `categories` from `@/lib/data/categories`, `brands` from `@/lib/data/brands` (Task 3); `ProductCard` from `@/components/marketing/product-card` (Task 7); `Input` from `@/components/ui/input` (Task 4); `cn` from `@/lib/utils` (Task 1); the locale-resolution convention from Task 7.
- Produces (`@/lib/filters`): `type SortKey = "newest" | "name-asc" | "name-desc"`, `type AvailabilityFilter = "all" | Product["stockStatus"]`, `interface ProductFilters { search?: string; brandId?: string; categoryId?: string; availability?: AvailabilityFilter }`, `filterProducts(products: Product[], filters: ProductFilters, lang: Locale): Product[]`, `sortProducts(products: Product[], sortKey: SortKey, lang: Locale): Product[]` (does not mutate its input).
- Produces: `ProductFilters` component (`@/components/product/product-filters`) — controlled filter bar (search input, brand/category/availability selects, sort select, grid/list toggle), fully prop-driven (no internal state).
- Produces: `ProductCatalogClient` (`@/components/product/product-catalog-client`) — `'use client'`, owns all filter/sort/pagination state, renders `ProductFilters` + a `ProductCard` grid/list + pagination controls. Props: `{ lang: Locale; dict: Dictionary["catalog"]; stockDict: Dictionary["common"]["stock"]; requestPriceLabel: string }`.
- Produces: `app/[lang]/products/page.tsx` — a Server Component that exports `generateMetadata` and renders `ProductCatalogClient` (the interactivity lives in the client component so the page itself can stay a server component and export metadata).

- [ ] **Step 1: Write the failing tests for filter/sort logic**

Create `lib/filters.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { products } from "@/lib/data/products";
import { filterProducts, sortProducts } from "./filters";

describe("filterProducts", () => {
  it("returns all products with no filters", () => {
    expect(filterProducts(products, {}, "en")).toHaveLength(products.length);
  });

  it("filters by search matching product name", () => {
    const result = filterProducts(products, { search: "turbocharger" }, "en");
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((p) => p.name.en.toLowerCase().includes("turbocharger"))).toBe(true);
  });

  it("filters by search matching SKU", () => {
    const result = filterProducts(products, { search: "DP-INJ-3126" }, "en");
    expect(result).toHaveLength(1);
    expect(result[0].sku).toBe("DP-INJ-3126");
  });

  it("filters by search matching OEM number", () => {
    const result = filterProducts(products, { search: "127-8213" }, "en");
    expect(result).toHaveLength(1);
    expect(result[0].oemNumber).toBe("127-8213");
  });

  it("filters by brand", () => {
    const result = filterProducts(products, { brandId: "cat" }, "en");
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((p) => p.brandId === "cat")).toBe(true);
  });

  it("filters by category", () => {
    const result = filterProducts(products, { categoryId: "turbocharger" }, "en");
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((p) => p.categoryId === "turbocharger")).toBe(true);
  });

  it("filters by availability", () => {
    const result = filterProducts(products, { availability: "out_of_stock" }, "en");
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((p) => p.stockStatus === "out_of_stock")).toBe(true);
  });

  it("treats 'all' as no filter for brand, category, and availability", () => {
    const result = filterProducts(products, { brandId: "all", categoryId: "all", availability: "all" }, "en");
    expect(result).toHaveLength(products.length);
  });

  it("combines multiple filters", () => {
    const result = filterProducts(products, { brandId: "cat", categoryId: "turbocharger" }, "en");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("cat-turbo-c15");
  });
});

describe("sortProducts", () => {
  it("sorts by name ascending", () => {
    const sorted = sortProducts(products, "name-asc", "en");
    const names = sorted.map((p) => p.name.en);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it("sorts by name descending", () => {
    const sorted = sortProducts(products, "name-desc", "en");
    const names = sorted.map((p) => p.name.en);
    expect(names).toEqual([...names].sort((a, b) => b.localeCompare(a)));
  });

  it("leaves order unchanged for 'newest'", () => {
    const sorted = sortProducts(products, "newest", "en");
    expect(sorted.map((p) => p.id)).toEqual(products.map((p) => p.id));
  });

  it("does not mutate the input array", () => {
    const original = [...products];
    sortProducts(products, "name-asc", "en");
    expect(products).toEqual(original);
  });
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `npm run test`
Expected: FAIL — `lib/filters.ts` does not exist.

- [ ] **Step 3: Implement `lib/filters.ts`**

```ts
import type { Product } from "@/lib/types";
import type { Locale } from "@/lib/i18n/locales";

export type SortKey = "newest" | "name-asc" | "name-desc";
export type AvailabilityFilter = "all" | Product["stockStatus"];

export interface ProductFiltersInput {
  search?: string;
  brandId?: string;
  categoryId?: string;
  availability?: AvailabilityFilter;
}

export function filterProducts(
  products: Product[],
  filters: ProductFiltersInput,
  lang: Locale
): Product[] {
  const search = filters.search?.trim().toLowerCase() ?? "";

  return products.filter((product) => {
    if (filters.brandId && filters.brandId !== "all" && product.brandId !== filters.brandId) {
      return false;
    }
    if (filters.categoryId && filters.categoryId !== "all" && product.categoryId !== filters.categoryId) {
      return false;
    }
    if (filters.availability && filters.availability !== "all" && product.stockStatus !== filters.availability) {
      return false;
    }
    if (search) {
      const haystack = [product.name[lang], product.sku, product.oemNumber].join(" ").toLowerCase();
      if (!haystack.includes(search)) {
        return false;
      }
    }
    return true;
  });
}

export function sortProducts(products: Product[], sortKey: SortKey, lang: Locale): Product[] {
  const sorted = [...products];
  if (sortKey === "name-asc") {
    sorted.sort((a, b) => a.name[lang].localeCompare(b.name[lang]));
  } else if (sortKey === "name-desc") {
    sorted.sort((a, b) => b.name[lang].localeCompare(a.name[lang]));
  }
  return sorted;
}
```

- [ ] **Step 4: Run the tests and verify they pass**

Run: `npm run test`
Expected: PASS.

- [ ] **Step 5: Create the filter bar component**

Create `components/product/product-filters.tsx`:
```tsx
"use client";

import type { Brand, Category } from "@/lib/types";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { AvailabilityFilter, SortKey } from "@/lib/filters";
import type { Locale } from "@/lib/i18n/locales";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const SELECT_CLASS =
  "h-10 rounded-md border border-border bg-transparent px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent";

interface ProductFiltersProps {
  dict: Dictionary["catalog"];
  stockDict: Dictionary["common"]["stock"];
  brands: Brand[];
  categories: Category[];
  lang: Locale;
  search: string;
  onSearchChange: (value: string) => void;
  brandId: string;
  onBrandChange: (value: string) => void;
  categoryId: string;
  onCategoryChange: (value: string) => void;
  availability: AvailabilityFilter;
  onAvailabilityChange: (value: AvailabilityFilter) => void;
  sortKey: SortKey;
  onSortChange: (value: SortKey) => void;
  view: "grid" | "list";
  onViewChange: (value: "grid" | "list") => void;
}

export function ProductFilters({
  dict,
  stockDict,
  brands,
  categories,
  lang,
  search,
  onSearchChange,
  brandId,
  onBrandChange,
  categoryId,
  onCategoryChange,
  availability,
  onAvailabilityChange,
  sortKey,
  onSortChange,
  view,
  onViewChange,
}: ProductFiltersProps) {
  return (
    <div className="flex flex-col gap-4">
      <Input
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder={dict.searchPlaceholder}
      />

      <div className="flex flex-wrap items-center gap-3">
        <select className={SELECT_CLASS} value={brandId} onChange={(event) => onBrandChange(event.target.value)}>
          <option value="all">{dict.allBrands}</option>
          {brands.map((brand) => (
            <option key={brand.id} value={brand.id}>
              {brand.name}
            </option>
          ))}
        </select>

        <select
          className={SELECT_CLASS}
          value={categoryId}
          onChange={(event) => onCategoryChange(event.target.value)}
        >
          <option value="all">{dict.allCategories}</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name[lang]}
            </option>
          ))}
        </select>

        <select
          className={SELECT_CLASS}
          value={availability}
          onChange={(event) => onAvailabilityChange(event.target.value as AvailabilityFilter)}
        >
          <option value="all">{dict.allAvailability}</option>
          <option value="available">{stockDict.available}</option>
          <option value="limited">{stockDict.limited}</option>
          <option value="out_of_stock">{stockDict.outOfStock}</option>
        </select>

        <select
          className={SELECT_CLASS}
          value={sortKey}
          onChange={(event) => onSortChange(event.target.value as SortKey)}
        >
          <option value="newest">{dict.sortNewest}</option>
          <option value="name-asc">{dict.sortNameAsc}</option>
          <option value="name-desc">{dict.sortNameDesc}</option>
        </select>

        <div className="ml-auto flex items-center gap-1 rounded-md border border-border p-1">
          <button
            type="button"
            aria-label={dict.gridView}
            onClick={() => onViewChange("grid")}
            className={cn("rounded px-3 py-1 text-xs", view === "grid" ? "bg-accent text-black" : "text-muted")}
          >
            {dict.gridView}
          </button>
          <button
            type="button"
            aria-label={dict.listView}
            onClick={() => onViewChange("list")}
            className={cn("rounded px-3 py-1 text-xs", view === "list" ? "bg-accent text-black" : "text-muted")}
          >
            {dict.listView}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Create the catalog client component**

Create `components/product/product-catalog-client.tsx`:
```tsx
"use client";

import { useMemo, useState } from "react";
import { products } from "@/lib/data/products";
import { categories } from "@/lib/data/categories";
import { brands } from "@/lib/data/brands";
import { filterProducts, sortProducts, type AvailabilityFilter, type SortKey } from "@/lib/filters";
import type { Locale } from "@/lib/i18n/locales";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { ProductFilters } from "./product-filters";
import { ProductCard } from "@/components/marketing/product-card";

const PAGE_SIZE = 9;

interface ProductCatalogClientProps {
  lang: Locale;
  dict: Dictionary["catalog"];
  stockDict: Dictionary["common"]["stock"];
  requestPriceLabel: string;
}

export function ProductCatalogClient({
  lang,
  dict,
  stockDict,
  requestPriceLabel,
}: ProductCatalogClientProps) {
  const [search, setSearch] = useState("");
  const [brandId, setBrandId] = useState("all");
  const [categoryId, setCategoryId] = useState("all");
  const [availability, setAvailability] = useState<AvailabilityFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("newest");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const result = filterProducts(products, { search, brandId, categoryId, availability }, lang);
    return sortProducts(result, sortKey, lang);
  }, [search, brandId, categoryId, availability, sortKey, lang]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function withPageReset<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(1);
    };
  }

  return (
    <div>
      <ProductFilters
        dict={dict}
        stockDict={stockDict}
        brands={brands}
        categories={categories}
        lang={lang}
        search={search}
        onSearchChange={withPageReset(setSearch)}
        brandId={brandId}
        onBrandChange={withPageReset(setBrandId)}
        categoryId={categoryId}
        onCategoryChange={withPageReset(setCategoryId)}
        availability={availability}
        onAvailabilityChange={withPageReset(setAvailability)}
        sortKey={sortKey}
        onSortChange={setSortKey}
        view={view}
        onViewChange={setView}
      />

      <p className="mt-6 text-sm text-muted">{dict.resultsCount.replace("{count}", String(filtered.length))}</p>

      {pageItems.length === 0 ? (
        <p className="mt-12 text-center text-muted">{dict.noResults}</p>
      ) : (
        <div className={view === "grid" ? "mt-6 grid grid-cols-2 gap-6 lg:grid-cols-3" : "mt-6 flex flex-col gap-4"}>
          {pageItems.map((product) => {
            const category = categories.find((c) => c.id === product.categoryId)!;
            const brand = brands.find((b) => b.id === product.brandId)!;
            return (
              <ProductCard
                key={product.id}
                product={product}
                lang={lang}
                categoryName={category.name[lang]}
                brandName={brand.name}
                stock={stockDict}
                requestPriceLabel={requestPriceLabel}
              />
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-10 flex items-center justify-center gap-4 text-sm text-muted">
          <button
            type="button"
            disabled={currentPage === 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="disabled:opacity-40"
          >
            {dict.prevPage}
          </button>
          <span>{dict.pageIndicator.replace("{current}", String(currentPage)).replace("{total}", String(totalPages))}</span>
          <button
            type="button"
            disabled={currentPage === totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="disabled:opacity-40"
          >
            {dict.nextPage}
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 7: Create the Catalog page**

Create `app/[lang]/products/page.tsx`:
```tsx
import type { Metadata } from "next";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/locales";
import { ProductCatalogClient } from "@/components/product/product-catalog-client";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const dict = getDictionary(lang);
  return {
    title: `${dict.catalog.title} — ${dict.meta.siteName}`,
    description: dict.catalog.subtitle,
  };
}

export default async function ProductsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang = isLocale(rawLang) ? rawLang : DEFAULT_LOCALE;
  const dict = getDictionary(lang);

  return (
    <main className="mx-auto max-w-7xl px-6 pb-24 pt-24">
      <h1 className="text-3xl font-semibold text-foreground">{dict.catalog.title}</h1>
      <p className="mt-2 text-muted">{dict.catalog.subtitle}</p>

      <div className="mt-10">
        <ProductCatalogClient
          lang={lang}
          dict={dict.catalog}
          stockDict={dict.common.stock}
          requestPriceLabel={dict.common.requestPrice}
        />
      </div>
    </main>
  );
}
```

- [ ] **Step 8: Verify lint, typecheck, build, and manual check**

Run: `npm run lint` — expected: no errors.
Run: `npx tsc --noEmit` — expected: no errors.
Run: `npm run build` — expected: succeeds.

Run: `npm run dev`, visit `http://localhost:3000/uz/products`, and manually verify: search by name/SKU/OEM narrows the grid, brand/category/availability selects filter correctly, sort changes order, grid/list toggle changes layout, and pagination controls appear and work once more than 9 products match. Stop the dev server afterward.

- [ ] **Step 9: Commit**

```bash
git add lib/filters.ts lib/filters.test.ts components/product "app/[lang]/products/page.tsx"
git commit -m "feat: add product filter/sort logic and the Catalog page"
```

---

## Task 9: Product Detail page

**Files:**
- Create: `components/product/stock-badge.tsx`, `components/product/product-gallery.tsx`, `components/product/specs-table.tsx`, `components/product/related-products.tsx`, `components/product/product-json-ld.tsx`
- Create: `app/[lang]/products/[slug]/page.tsx`

**Interfaces:**
- Consumes: `products`, `categories`, `brands` (Task 3); `Badge` from `@/components/ui/badge` (Task 4); `ProductCard` from `@/components/marketing/product-card` (Task 7); `cn` from `@/lib/utils`; the locale-resolution convention from Task 7.
- Produces: `StockBadge({ status: Product["stockStatus"]; stock: Dictionary["common"]["stock"] })` from `@/components/product/stock-badge` — same status→variant mapping as `ProductCard` (kept as a small local duplicate rather than a shared helper — it's five lines in each of two files).
- Produces: `ProductGallery({ imageLabels: string[]; galleryAlt: string })` — `'use client'`, clickable thumbnail row that swaps the main placeholder panel.
- Produces: `SpecsTable({ specs: ProductSpec[]; lang: Locale; title: string })` — renders `null` if `specs` is empty.
- Produces: `RelatedProducts({ product: Product; lang: Locale; title: string; stock: Dictionary["common"]["stock"]; requestPriceLabel: string })` — up to 4 other products sharing the same `categoryId`, rendered via `ProductCard`; renders `null` if none.
- Produces: `ProductJsonLd({ product: Product; category: Category; brand: Brand; lang: Locale })` — renders a `<script type="application/ld+json">` `Product` schema tag.
- Produces: `app/[lang]/products/[slug]/page.tsx` with `generateStaticParams` (all locales × all 15 product slugs), `generateMetadata`, and `notFound()` for unknown slugs.

- [ ] **Step 1: Create the stock badge**

Create `components/product/stock-badge.tsx`:
```tsx
import { Badge } from "@/components/ui/badge";
import type { Product } from "@/lib/types";
import type { Dictionary } from "@/lib/i18n/dictionaries";

const STOCK_VARIANT: Record<Product["stockStatus"], "success" | "warning" | "danger"> = {
  available: "success",
  limited: "warning",
  out_of_stock: "danger",
};

export function StockBadge({
  status,
  stock,
}: {
  status: Product["stockStatus"];
  stock: Dictionary["common"]["stock"];
}) {
  const label = status === "out_of_stock" ? stock.outOfStock : stock[status];
  return <Badge variant={STOCK_VARIANT[status]}>{label}</Badge>;
}
```

- [ ] **Step 2: Create the product gallery**

Create `components/product/product-gallery.tsx`:
```tsx
"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export function ProductGallery({
  imageLabels,
  galleryAlt,
}: {
  imageLabels: string[];
  galleryAlt: string;
}) {
  const [active, setActive] = useState(0);

  return (
    <div>
      <div
        role="img"
        aria-label={`${galleryAlt} — ${imageLabels[active]}`}
        className="flex aspect-4/3 items-center justify-center rounded-lg border border-border bg-linear-to-br from-white/6 to-transparent text-lg text-muted"
      >
        {imageLabels[active]}
      </div>
      <div className="mt-3 flex gap-2">
        {imageLabels.map((label, index) => (
          <button
            key={label}
            type="button"
            onClick={() => setActive(index)}
            className={cn(
              "flex h-16 w-16 items-center justify-center rounded-md border text-xs text-muted",
              index === active ? "border-accent text-accent" : "border-border"
            )}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create the specs table**

Create `components/product/specs-table.tsx`:
```tsx
import type { ProductSpec } from "@/lib/types";
import type { Locale } from "@/lib/i18n/locales";

export function SpecsTable({
  specs,
  lang,
  title,
}: {
  specs: ProductSpec[];
  lang: Locale;
  title: string;
}) {
  if (specs.length === 0) {
    return null;
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <dl className="mt-3 divide-y divide-border border-y border-border">
        {specs.map((spec) => (
          <div key={spec.label[lang]} className="flex justify-between py-2 text-sm">
            <dt className="text-muted">{spec.label[lang]}</dt>
            <dd className="text-foreground">{spec.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
```

- [ ] **Step 4: Create the related products section**

Create `components/product/related-products.tsx`:
```tsx
import { products } from "@/lib/data/products";
import { categories } from "@/lib/data/categories";
import { brands } from "@/lib/data/brands";
import type { Product } from "@/lib/types";
import type { Locale } from "@/lib/i18n/locales";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { ProductCard } from "@/components/marketing/product-card";

const RELATED_COUNT = 4;

export function RelatedProducts({
  product,
  lang,
  title,
  stock,
  requestPriceLabel,
}: {
  product: Product;
  lang: Locale;
  title: string;
  stock: Dictionary["common"]["stock"];
  requestPriceLabel: string;
}) {
  const related = products
    .filter((p) => p.id !== product.id && p.categoryId === product.categoryId)
    .slice(0, RELATED_COUNT);

  if (related.length === 0) {
    return null;
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <div className="mt-6 grid grid-cols-2 gap-6 lg:grid-cols-4">
        {related.map((item) => {
          const category = categories.find((c) => c.id === item.categoryId)!;
          const brand = brands.find((b) => b.id === item.brandId)!;
          return (
            <ProductCard
              key={item.id}
              product={item}
              lang={lang}
              categoryName={category.name[lang]}
              brandName={brand.name}
              stock={stock}
              requestPriceLabel={requestPriceLabel}
            />
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create the JSON-LD component**

Create `components/product/product-json-ld.tsx`:
```tsx
import type { Product, Category, Brand } from "@/lib/types";
import type { Locale } from "@/lib/i18n/locales";

export function ProductJsonLd({
  product,
  category,
  brand,
  lang,
}: {
  product: Product;
  category: Category;
  brand: Brand;
  lang: Locale;
}) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name[lang],
    sku: product.sku,
    mpn: product.oemNumber,
    brand: { "@type": "Brand", name: brand.name },
    category: category.name[lang],
    description: product.description[lang],
  };

  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
  );
}
```

- [ ] **Step 6: Create the Product Detail page**

Create `app/[lang]/products/[slug]/page.tsx`:
```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { products } from "@/lib/data/products";
import { categories } from "@/lib/data/categories";
import { brands } from "@/lib/data/brands";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { DEFAULT_LOCALE, isLocale, SUPPORTED_LOCALES } from "@/lib/i18n/locales";
import { ProductGallery } from "@/components/product/product-gallery";
import { SpecsTable } from "@/components/product/specs-table";
import { StockBadge } from "@/components/product/stock-badge";
import { RelatedProducts } from "@/components/product/related-products";
import { ProductJsonLd } from "@/components/product/product-json-ld";

export function generateStaticParams() {
  return SUPPORTED_LOCALES.flatMap((lang) => products.map((product) => ({ lang, slug: product.slug })));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}): Promise<Metadata> {
  const { lang: rawLang, slug } = await params;
  const product = products.find((p) => p.slug === slug);
  const lang = isLocale(rawLang) ? rawLang : DEFAULT_LOCALE;
  if (!product) {
    return {};
  }
  const dict = getDictionary(lang);
  return {
    title: `${product.name[lang]} — ${dict.meta.siteName}`,
    description: product.description[lang],
  };
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}) {
  const { lang: rawLang, slug } = await params;
  const lang = isLocale(rawLang) ? rawLang : DEFAULT_LOCALE;
  const dict = getDictionary(lang);

  const product = products.find((p) => p.slug === slug);
  if (!product) {
    notFound();
  }

  const category = categories.find((c) => c.id === product.categoryId)!;
  const brand = brands.find((b) => b.id === product.brandId)!;

  return (
    <main className="mx-auto max-w-7xl px-6 pb-24 pt-24">
      <ProductJsonLd product={product} category={category} brand={brand} lang={lang} />

      <div className="grid gap-12 lg:grid-cols-2">
        <ProductGallery imageLabels={product.imageLabels} galleryAlt={dict.product.galleryAlt} />

        <div>
          <p className="text-sm text-muted">{brand.name}</p>
          <h1 className="mt-1 text-3xl font-semibold text-foreground">{product.name[lang]}</h1>

          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-muted">
            <span>
              {dict.product.skuLabel}: {product.sku}
            </span>
            <span>
              {dict.product.oemLabel}: {product.oemNumber}
            </span>
            <StockBadge status={product.stockStatus} stock={dict.common.stock} />
          </div>

          <p className="mt-6 text-foreground">{product.description[lang]}</p>

          <div>
            <h2 className="mt-8 text-lg font-semibold text-foreground">
              {dict.product.compatibleModelsTitle}
            </h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {product.compatibleModels.map((model) => (
                <li key={model} className="rounded-full border border-border px-3 py-1 text-xs text-muted">
                  {model}
                </li>
              ))}
            </ul>
          </div>

          <p className="mt-8 text-2xl font-semibold text-accent">{dict.common.requestPrice}</p>
        </div>
      </div>

      <div className="mt-16">
        <SpecsTable specs={product.specs} lang={lang} title={dict.product.specificationsTitle} />
      </div>

      <div className="mt-16">
        <RelatedProducts
          product={product}
          lang={lang}
          title={dict.product.relatedProductsTitle}
          stock={dict.common.stock}
          requestPriceLabel={dict.common.requestPrice}
        />
      </div>
    </main>
  );
}
```

- [ ] **Step 7: Verify lint, typecheck, build, and manual check**

Run: `npm run lint` — expected: no errors.
Run: `npx tsc --noEmit` — expected: no errors.
Run: `npm run build` — expected: succeeds, with 45 static product-detail routes (15 products × 3 locales) listed in the output.

Run: `npm run dev`, visit `http://localhost:3000/uz/products/cat-fuel-injector-3126`, and manually verify: gallery thumbnails swap the main panel, SKU/OEM/stock badge/compatible models/specs/related products all render, and visiting a nonexistent slug (e.g. `/uz/products/does-not-exist`) shows the 404 page. Stop the dev server afterward.

- [ ] **Step 8: Commit**

```bash
git add components/product "app/[lang]/products/[slug]"
git commit -m "feat: add Product Detail page with gallery, specs, related products, and JSON-LD"
```

---

## Task 10: Categories detail page

**Files:**
- Create: `app/[lang]/categories/[slug]/page.tsx`

**Interfaces:**
- Consumes: `categories`, `products`, `brands` (Task 3); `ProductCard` (Task 7); locale-resolution convention (Task 7); `dict.categories.{title,subtitle,productsInCategory}` (Task 2).
- Produces: `app/[lang]/categories/[slug]/page.tsx` with `generateStaticParams` (all locales × all 10 category slugs), `generateMetadata`, and `notFound()` for unknown slugs. No dedicated `/categories` index page exists (matches the root TZ's route list — only `/categories/[slug]`); categories are discovered via the Home page's category grid (Task 7).

- [ ] **Step 1: Create the Category Detail page**

Create `app/[lang]/categories/[slug]/page.tsx`:
```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { categories } from "@/lib/data/categories";
import { products } from "@/lib/data/products";
import { brands } from "@/lib/data/brands";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { DEFAULT_LOCALE, isLocale, SUPPORTED_LOCALES } from "@/lib/i18n/locales";
import { ProductCard } from "@/components/marketing/product-card";

export function generateStaticParams() {
  return SUPPORTED_LOCALES.flatMap((lang) => categories.map((category) => ({ lang, slug: category.slug })));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}): Promise<Metadata> {
  const { lang: rawLang, slug } = await params;
  const category = categories.find((c) => c.slug === slug);
  const lang = isLocale(rawLang) ? rawLang : DEFAULT_LOCALE;
  if (!category) {
    return {};
  }
  const dict = getDictionary(lang);
  return {
    title: `${category.name[lang]} — ${dict.meta.siteName}`,
    description: dict.categories.subtitle,
  };
}

export default async function CategoryDetailPage({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}) {
  const { lang: rawLang, slug } = await params;
  const lang = isLocale(rawLang) ? rawLang : DEFAULT_LOCALE;
  const dict = getDictionary(lang);

  const category = categories.find((c) => c.slug === slug);
  if (!category) {
    notFound();
  }

  const categoryProducts = products.filter((p) => p.categoryId === category.id);

  return (
    <main className="mx-auto max-w-7xl px-6 pb-24 pt-24">
      <p className="text-sm text-muted">{dict.categories.title}</p>
      <h1 className="mt-1 text-3xl font-semibold text-foreground">{category.name[lang]}</h1>
      <p className="mt-2 text-muted">
        {categoryProducts.length} {dict.categories.productsInCategory}
      </p>

      <div className="mt-10 grid grid-cols-2 gap-6 lg:grid-cols-3">
        {categoryProducts.map((product) => {
          const brand = brands.find((b) => b.id === product.brandId)!;
          return (
            <ProductCard
              key={product.id}
              product={product}
              lang={lang}
              categoryName={category.name[lang]}
              brandName={brand.name}
              stock={dict.common.stock}
              requestPriceLabel={dict.common.requestPrice}
            />
          );
        })}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Verify lint, typecheck, build, and manual check**

Run: `npm run lint` — expected: no errors.
Run: `npx tsc --noEmit` — expected: no errors.
Run: `npm run build` — expected: succeeds, with 30 static category routes (10 categories × 3 locales) listed in the output.

Run: `npm run dev`, visit `http://localhost:3000/uz/categories/turbocharger`, and manually verify the category name and its 2 matching products render. Visit `/uz/categories/does-not-exist` and verify the 404 page. Stop the dev server afterward.

- [ ] **Step 3: Commit**

```bash
git add "app/[lang]/categories"
git commit -m "feat: add Category Detail page"
```

---

## Task 11: Brands detail page

**Files:**
- Create: `app/[lang]/brands/[slug]/page.tsx`

**Interfaces:**
- Consumes: `brands`, `products`, `categories` (Task 3); `ProductCard` (Task 7); locale-resolution convention (Task 7); `dict.brands.{title,subtitle,productsFromBrand}` (Task 2).
- Produces: `app/[lang]/brands/[slug]/page.tsx` with `generateStaticParams` (all locales × all 7 brand slugs), `generateMetadata`, and `notFound()` for unknown slugs. Same pattern as Task 10 — no `/brands` index page, matching the root TZ's route list.

- [ ] **Step 1: Create the Brand Detail page**

Create `app/[lang]/brands/[slug]/page.tsx`:
```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { brands } from "@/lib/data/brands";
import { products } from "@/lib/data/products";
import { categories } from "@/lib/data/categories";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { DEFAULT_LOCALE, isLocale, SUPPORTED_LOCALES } from "@/lib/i18n/locales";
import { ProductCard } from "@/components/marketing/product-card";

export function generateStaticParams() {
  return SUPPORTED_LOCALES.flatMap((lang) => brands.map((brand) => ({ lang, slug: brand.slug })));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}): Promise<Metadata> {
  const { lang: rawLang, slug } = await params;
  const brand = brands.find((b) => b.slug === slug);
  const lang = isLocale(rawLang) ? rawLang : DEFAULT_LOCALE;
  if (!brand) {
    return {};
  }
  const dict = getDictionary(lang);
  return {
    title: `${brand.name} — ${dict.meta.siteName}`,
    description: dict.brands.subtitle,
  };
}

export default async function BrandDetailPage({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}) {
  const { lang: rawLang, slug } = await params;
  const lang = isLocale(rawLang) ? rawLang : DEFAULT_LOCALE;
  const dict = getDictionary(lang);

  const brand = brands.find((b) => b.slug === slug);
  if (!brand) {
    notFound();
  }

  const brandProducts = products.filter((p) => p.brandId === brand.id);

  return (
    <main className="mx-auto max-w-7xl px-6 pb-24 pt-24">
      <p className="text-sm text-muted">{dict.brands.title}</p>
      <h1 className="mt-1 text-3xl font-semibold text-foreground">{brand.name}</h1>
      <p className="mt-2 text-muted">
        {brandProducts.length} {dict.brands.productsFromBrand}
      </p>

      <div className="mt-10 grid grid-cols-2 gap-6 lg:grid-cols-3">
        {brandProducts.map((product) => {
          const category = categories.find((c) => c.id === product.categoryId)!;
          return (
            <ProductCard
              key={product.id}
              product={product}
              lang={lang}
              categoryName={category.name[lang]}
              brandName={brand.name}
              stock={dict.common.stock}
              requestPriceLabel={dict.common.requestPrice}
            />
          );
        })}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Verify lint, typecheck, build, and manual check**

Run: `npm run lint` — expected: no errors.
Run: `npx tsc --noEmit` — expected: no errors.
Run: `npm run build` — expected: succeeds, with 21 static brand routes (7 brands × 3 locales) listed in the output.

Run: `npm run dev`, visit `http://localhost:3000/uz/brands/cat`, and manually verify the brand name and its 3 matching products render. Visit `/uz/brands/does-not-exist` and verify the 404 page. Stop the dev server afterward.

- [ ] **Step 3: Commit**

```bash
git add "app/[lang]/brands"
git commit -m "feat: add Brand Detail page"
```

---

## Task 12: About page

**Files:**
- Create: `app/[lang]/about/page.tsx`

**Interfaces:**
- Consumes: locale-resolution convention (Task 7); `dict.about.{title,storyTitle,storyParagraphs[],statsTitle,stats[].{value,label}}` (Task 2).
- Produces: `app/[lang]/about/page.tsx`, a static content page (no dynamic segment, no `generateStaticParams` needed — the `[lang]` param alone is already covered by the root layout's `generateStaticParams` from Task 2).

- [ ] **Step 1: Create the About page**

Create `app/[lang]/about/page.tsx`:
```tsx
import type { Metadata } from "next";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/locales";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const dict = getDictionary(lang);
  return {
    title: `${dict.about.title} — ${dict.meta.siteName}`,
    description: dict.about.storyParagraphs[0],
  };
}

export default async function AboutPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang = isLocale(rawLang) ? rawLang : DEFAULT_LOCALE;
  const dict = getDictionary(lang);

  return (
    <main className="mx-auto max-w-4xl px-6 pb-24 pt-24">
      <h1 className="text-3xl font-semibold text-foreground">{dict.about.title}</h1>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-foreground">{dict.about.storyTitle}</h2>
        <div className="mt-4 space-y-4 text-muted">
          {dict.about.storyParagraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </section>

      <section className="mt-16">
        <h2 className="text-xl font-semibold text-foreground">{dict.about.statsTitle}</h2>
        <div className="mt-6 grid grid-cols-2 gap-6 sm:grid-cols-4">
          {dict.about.stats.map((stat) => (
            <div key={stat.label} className="rounded-lg border border-border bg-white/2 p-6 text-center">
              <p className="text-3xl font-semibold text-accent">{stat.value}</p>
              <p className="mt-1 text-sm text-muted">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Verify lint, typecheck, build, and manual check**

Run: `npm run lint` — expected: no errors.
Run: `npx tsc --noEmit` — expected: no errors.
Run: `npm run build` — expected: succeeds.

Run: `npm run dev`, visit `http://localhost:3000/uz/about`, `/ru/about`, `/en/about`, and manually verify the story paragraphs and stats render correctly in each locale. Stop the dev server afterward.

- [ ] **Step 3: Commit**

```bash
git add "app/[lang]/about"
git commit -m "feat: add About page"
```

---

## Task 13: Blog list + detail pages

**Files:**
- Create: `app/[lang]/blog/page.tsx`
- Create: `app/[lang]/blog/[slug]/page.tsx`

**Interfaces:**
- Consumes: `blogPosts` (Task 3, `BlogPost.body` is a single `LocalizedText` whose value is a `\n\n`-paragraph-separated string per locale); `dict.blog.{title,subtitle,readMore,publishedOn}` (Task 2); locale-resolution convention (Task 7).
- Produces: `app/[lang]/blog/page.tsx` — static list of all `blogPosts`.
- Produces: `app/[lang]/blog/[slug]/page.tsx` with `generateStaticParams` (all locales × all 3 blog slugs = 9 routes), `generateMetadata`, `notFound()` for unknown slugs.

- [ ] **Step 1: Create the Blog list page**

Create `app/[lang]/blog/page.tsx`:
```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { blogPosts } from "@/lib/data/blog";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/locales";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const dict = getDictionary(lang);
  return {
    title: `${dict.blog.title} — ${dict.meta.siteName}`,
    description: dict.blog.subtitle,
  };
}

export default async function BlogPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang = isLocale(rawLang) ? rawLang : DEFAULT_LOCALE;
  const dict = getDictionary(lang);

  return (
    <main className="mx-auto max-w-4xl px-6 pb-24 pt-24">
      <h1 className="text-3xl font-semibold text-foreground">{dict.blog.title}</h1>
      <p className="mt-2 text-muted">{dict.blog.subtitle}</p>

      <div className="mt-10 space-y-8">
        {blogPosts.map((post) => (
          <article key={post.id} className="rounded-lg border border-border bg-white/2 p-6">
            <p className="text-sm text-muted">
              {dict.blog.publishedOn}: {post.publishedAt}
            </p>
            <h2 className="mt-2 text-xl font-semibold text-foreground">{post.title[lang]}</h2>
            <p className="mt-2 text-muted">{post.excerpt[lang]}</p>
            <Link
              href={`/${lang}/blog/${post.slug}`}
              className="mt-4 inline-block text-accent hover:underline"
            >
              {dict.blog.readMore}
            </Link>
          </article>
        ))}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Create the Blog detail page**

Create `app/[lang]/blog/[slug]/page.tsx`:
```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { blogPosts } from "@/lib/data/blog";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { DEFAULT_LOCALE, isLocale, SUPPORTED_LOCALES } from "@/lib/i18n/locales";

export function generateStaticParams() {
  return SUPPORTED_LOCALES.flatMap((lang) =>
    blogPosts.map((post) => ({ lang, slug: post.slug }))
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}): Promise<Metadata> {
  const { lang: rawLang, slug } = await params;
  const lang = isLocale(rawLang) ? rawLang : DEFAULT_LOCALE;
  const dict = getDictionary(lang);
  const post = blogPosts.find((p) => p.slug === slug);

  if (!post) {
    return {};
  }

  return {
    title: `${post.title[lang]} — ${dict.meta.siteName}`,
    description: post.excerpt[lang],
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}) {
  const { lang: rawLang, slug } = await params;
  const lang = isLocale(rawLang) ? rawLang : DEFAULT_LOCALE;
  const dict = getDictionary(lang);

  const post = blogPosts.find((p) => p.slug === slug);
  if (!post) {
    notFound();
  }

  const paragraphs = post.body[lang].split("\n\n");

  return (
    <main className="mx-auto max-w-3xl px-6 pb-24 pt-24">
      <p className="text-sm text-muted">
        {dict.blog.publishedOn}: {post.publishedAt}
      </p>
      <h1 className="mt-2 text-3xl font-semibold text-foreground">{post.title[lang]}</h1>
      <div className="mt-8 space-y-4 text-muted">
        {paragraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Verify lint, typecheck, build, and manual check**

Run: `npm run lint` — expected: no errors.
Run: `npx tsc --noEmit` — expected: no errors.
Run: `npm run build` — expected: succeeds, with 1 blog list route × 3 locales and 9 blog detail routes (3 posts × 3 locales) listed in the output.

Run: `npm run dev`, visit `http://localhost:3000/uz/blog`, click into a post, verify paragraphs render, then visit a nonexistent slug (e.g. `/uz/blog/does-not-exist`) and verify the 404 page. Repeat spot-check for `/ru/blog` and `/en/blog`. Stop the dev server afterward.

- [ ] **Step 4: Commit**

```bash
git add "app/[lang]/blog"
git commit -m "feat: add Blog list and detail pages"
```

---

## Task 14: Contact page

**Files:**
- Create: `app/[lang]/contact/page.tsx`

**Interfaces:**
- Consumes: `dict.contact.{title,subtitle,addressTitle,address,phoneTitle,phone,emailTitle,email,hoursTitle,hours}` (Task 2); locale-resolution convention (Task 7).
- Produces: `app/[lang]/contact/page.tsx`, a static content page (no dynamic segment beyond `[lang]`, no `generateStaticParams` needed).

- [ ] **Step 1: Create the Contact page**

Create `app/[lang]/contact/page.tsx`:
```tsx
import type { Metadata } from "next";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/locales";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const dict = getDictionary(lang);
  return {
    title: `${dict.contact.title} — ${dict.meta.siteName}`,
    description: dict.contact.subtitle,
  };
}

export default async function ContactPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang = isLocale(rawLang) ? rawLang : DEFAULT_LOCALE;
  const dict = getDictionary(lang);

  const info = [
    { title: dict.contact.addressTitle, value: dict.contact.address },
    { title: dict.contact.phoneTitle, value: dict.contact.phone },
    { title: dict.contact.emailTitle, value: dict.contact.email },
    { title: dict.contact.hoursTitle, value: dict.contact.hours },
  ];

  return (
    <main className="mx-auto max-w-4xl px-6 pb-24 pt-24">
      <h1 className="text-3xl font-semibold text-foreground">{dict.contact.title}</h1>
      <p className="mt-2 text-muted">{dict.contact.subtitle}</p>

      <div className="mt-10 grid gap-6 sm:grid-cols-2">
        {info.map((item) => (
          <div key={item.title} className="rounded-lg border border-border bg-white/2 p-6">
            <p className="text-sm text-muted">{item.title}</p>
            <p className="mt-1 text-foreground">{item.value}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Verify lint, typecheck, build, and manual check**

Run: `npm run lint` — expected: no errors.
Run: `npx tsc --noEmit` — expected: no errors.
Run: `npm run build` — expected: succeeds.

Run: `npm run dev`, visit `http://localhost:3000/uz/contact`, `/ru/contact`, `/en/contact`, and manually verify address/phone/email/hours render correctly in each locale. Stop the dev server afterward.

- [ ] **Step 3: Commit**

```bash
git add "app/[lang]/contact"
git commit -m "feat: add Contact page"
```

---

## Task 15: Shared Zod schemas for lead-capture forms

**Files:**
- Create: `lib/schemas.ts`
- Test: `lib/schemas.test.ts`

**Interfaces:**
- Produces (`@/lib/schemas`): `quoteRequestSchema: ZodObject` validating `{ name, company, phone, email, country, products, quantity, message }` (all `string`, all required except `message`); `type QuoteRequestInput = z.infer<typeof quoteRequestSchema>`.
- Produces: `inquirySchema: ZodObject` validating `{ productId, productSlug, name, email, phone, message }` (all `string`, all required except `phone`); `type InquiryInput = z.infer<typeof inquirySchema>`.
- These two schemas are shared between the client form components (Tasks 16/17, via `zodResolver`) and the Route Handlers (Tasks 16/17, via `.safeParse`) — the single source of truth for validation on both sides.

- [ ] **Step 1: Write the failing schema tests**

Create `lib/schemas.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { inquirySchema, quoteRequestSchema } from "./schemas";

describe("quoteRequestSchema", () => {
  const validInput = {
    name: "John Doe",
    company: "Acme Co",
    phone: "+998901234567",
    email: "john@example.com",
    country: "Uzbekistan",
    products: "CAT 3126 injector",
    quantity: "10",
    message: "",
  };

  it("accepts a fully valid payload", () => {
    expect(quoteRequestSchema.safeParse(validInput).success).toBe(true);
  });

  it("accepts a missing/empty message (optional field)", () => {
    const { message, ...rest } = validInput;
    expect(quoteRequestSchema.safeParse(rest).success).toBe(true);
  });

  it("rejects a missing required field", () => {
    const { name, ...rest } = validInput;
    expect(quoteRequestSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects an invalid email", () => {
    const result = quoteRequestSchema.safeParse({ ...validInput, email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("rejects an empty required string", () => {
    const result = quoteRequestSchema.safeParse({ ...validInput, name: "" });
    expect(result.success).toBe(false);
  });
});

describe("inquirySchema", () => {
  const validInput = {
    productId: "cat-injector-3126",
    productSlug: "cat-fuel-injector-3126",
    name: "Jane Doe",
    email: "jane@example.com",
    phone: "",
    message: "Is this compatible with CAT 320D?",
  };

  it("accepts a fully valid payload", () => {
    expect(inquirySchema.safeParse(validInput).success).toBe(true);
  });

  it("accepts a missing/empty phone (optional field)", () => {
    const { phone, ...rest } = validInput;
    expect(inquirySchema.safeParse(rest).success).toBe(true);
  });

  it("rejects a missing required field", () => {
    const { message, ...rest } = validInput;
    expect(inquirySchema.safeParse(rest).success).toBe(false);
  });

  it("rejects an invalid email", () => {
    const result = inquirySchema.safeParse({ ...validInput, email: "not-an-email" });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `npm run test`
Expected: FAIL — `lib/schemas.ts` does not exist.

- [ ] **Step 3: Implement the schemas**

Create `lib/schemas.ts`:
```ts
import { z } from "zod";

export const quoteRequestSchema = z.object({
  name: z.string().min(1),
  company: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email(),
  country: z.string().min(1),
  products: z.string().min(1),
  quantity: z.string().min(1),
  message: z.string().optional(),
});

export type QuoteRequestInput = z.infer<typeof quoteRequestSchema>;

export const inquirySchema = z.object({
  productId: z.string().min(1),
  productSlug: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  message: z.string().min(1),
});

export type InquiryInput = z.infer<typeof inquirySchema>;
```

- [ ] **Step 4: Run the tests and verify they pass**

Run: `npm run test`
Expected: PASS.

- [ ] **Step 5: Verify lint and typecheck**

Run: `npm run lint` — expected: no errors.
Run: `npx tsc --noEmit` — expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add lib/schemas.ts lib/schemas.test.ts
git commit -m "feat: add shared Zod schemas for quote request and inquiry forms"
```

---

## Task 16: Request Quote feature (form + stub API + page)

**Files:**
- Create: `components/forms/quote-form.tsx`
- Create: `app/api/quote-request/route.ts`
- Test: `app/api/quote-request/route.test.ts`
- Create: `app/[lang]/request-quote/page.tsx`

**Interfaces:**
- Consumes: `quoteRequestSchema`, `type QuoteRequestInput` (Task 15); `Button`, `Input`, `Textarea`, `Label` (Task 4); `dict.requestQuote.*` (Task 2); locale-resolution convention (Task 7).
- Produces: `QuoteForm({ dict: Dictionary["requestQuote"] })` — `'use client'`, React Hook Form + `zodResolver(quoteRequestSchema)`, POSTs JSON to `/api/quote-request`, renders a success panel in place of the form on success, shows `dict.errorGeneric` on a non-OK response or network failure. No persistence — the Route Handler only validates and `console.log`s.
- Produces: `POST` handler at `/api/quote-request` — parses the JSON body, runs `quoteRequestSchema.safeParse`, returns `{ success: true }` (200) or `{ success: false, errors }` (400).
- Produces: `app/[lang]/request-quote/page.tsx`, a static content page rendering `<QuoteForm dict={dict.requestQuote} />`.

- [ ] **Step 1: Write the failing test for the Route Handler**

Create `app/api/quote-request/route.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { POST } from "./route";

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/quote-request", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validPayload = {
  name: "John Doe",
  company: "Acme Co",
  phone: "+998901234567",
  email: "john@example.com",
  country: "Uzbekistan",
  products: "CAT 3126 injector",
  quantity: "10",
  message: "",
};

describe("POST /api/quote-request", () => {
  it("returns 200 and success for a valid payload", async () => {
    const response = await POST(makeRequest(validPayload));
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);
  });

  it("returns 400 for a payload missing required fields", async () => {
    const response = await POST(makeRequest({ name: "John Doe" }));
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.success).toBe(false);
  });

  it("returns 400 for an invalid email", async () => {
    const response = await POST(makeRequest({ ...validPayload, email: "not-an-email" }));
    expect(response.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npm run test`
Expected: FAIL — `app/api/quote-request/route.ts` does not exist.

- [ ] **Step 3: Implement the Route Handler**

Create `app/api/quote-request/route.ts`:
```ts
import { NextResponse } from "next/server";
import { quoteRequestSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  const body = await request.json();
  const result = quoteRequestSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { success: false, errors: result.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  console.log("[quote-request]", result.data);

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `npm run test`
Expected: PASS.

- [ ] **Step 5: Create the Quote form client component**

Create `components/forms/quote-form.tsx`:
```tsx
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { quoteRequestSchema, type QuoteRequestInput } from "@/lib/schemas";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

type Status = "idle" | "submitting" | "success" | "error";

export function QuoteForm({ dict }: { dict: Dictionary["requestQuote"] }) {
  const [status, setStatus] = useState<Status>("idle");
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<QuoteRequestInput>({
    resolver: zodResolver(quoteRequestSchema),
    defaultValues: {
      name: "",
      company: "",
      phone: "",
      email: "",
      country: "",
      products: "",
      quantity: "",
      message: "",
    },
  });

  async function onSubmit(values: QuoteRequestInput) {
    setStatus("submitting");
    try {
      const response = await fetch("/api/quote-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!response.ok) {
        setStatus("error");
        return;
      }
      setStatus("success");
      reset();
    } catch {
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="rounded-lg border border-border bg-white/2 p-8 text-center">
        <h2 className="text-xl font-semibold text-foreground">{dict.successTitle}</h2>
        <p className="mt-2 text-muted">{dict.successText}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <Label htmlFor="quote-name">{dict.fieldName}</Label>
          <Input id="quote-name" {...register("name")} />
          {errors.name && <p className="mt-1 text-sm text-accent">{dict.errorRequired}</p>}
        </div>
        <div>
          <Label htmlFor="quote-company">{dict.fieldCompany}</Label>
          <Input id="quote-company" {...register("company")} />
          {errors.company && <p className="mt-1 text-sm text-accent">{dict.errorRequired}</p>}
        </div>
        <div>
          <Label htmlFor="quote-phone">{dict.fieldPhone}</Label>
          <Input id="quote-phone" {...register("phone")} />
          {errors.phone && <p className="mt-1 text-sm text-accent">{dict.errorRequired}</p>}
        </div>
        <div>
          <Label htmlFor="quote-email">{dict.fieldEmail}</Label>
          <Input id="quote-email" type="email" {...register("email")} />
          {errors.email && <p className="mt-1 text-sm text-accent">{dict.errorEmail}</p>}
        </div>
        <div>
          <Label htmlFor="quote-country">{dict.fieldCountry}</Label>
          <Input id="quote-country" {...register("country")} />
          {errors.country && <p className="mt-1 text-sm text-accent">{dict.errorRequired}</p>}
        </div>
        <div>
          <Label htmlFor="quote-quantity">{dict.fieldQuantity}</Label>
          <Input id="quote-quantity" {...register("quantity")} />
          {errors.quantity && <p className="mt-1 text-sm text-accent">{dict.errorRequired}</p>}
        </div>
      </div>

      <div>
        <Label htmlFor="quote-products">{dict.fieldProducts}</Label>
        <Textarea
          id="quote-products"
          placeholder={dict.fieldProductsPlaceholder}
          {...register("products")}
        />
        {errors.products && <p className="mt-1 text-sm text-accent">{dict.errorRequired}</p>}
      </div>

      <div>
        <Label htmlFor="quote-message">{dict.fieldMessage}</Label>
        <Textarea
          id="quote-message"
          placeholder={dict.fieldMessagePlaceholder}
          {...register("message")}
        />
      </div>

      {status === "error" && <p className="text-sm text-accent">{dict.errorGeneric}</p>}

      <Button type="submit" disabled={status === "submitting"}>
        {status === "submitting" ? dict.submitting : dict.submit}
      </Button>
    </form>
  );
}
```

- [ ] **Step 6: Create the Request Quote page**

Create `app/[lang]/request-quote/page.tsx`:
```tsx
import type { Metadata } from "next";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/locales";
import { QuoteForm } from "@/components/forms/quote-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const dict = getDictionary(lang);
  return {
    title: `${dict.requestQuote.title} — ${dict.meta.siteName}`,
    description: dict.requestQuote.subtitle,
  };
}

export default async function RequestQuotePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang = isLocale(rawLang) ? rawLang : DEFAULT_LOCALE;
  const dict = getDictionary(lang);

  return (
    <main className="mx-auto max-w-3xl px-6 pb-24 pt-24">
      <h1 className="text-3xl font-semibold text-foreground">{dict.requestQuote.title}</h1>
      <p className="mt-2 text-muted">{dict.requestQuote.subtitle}</p>
      <div className="mt-10">
        <QuoteForm dict={dict.requestQuote} />
      </div>
    </main>
  );
}
```

- [ ] **Step 7: Verify lint, typecheck, build, and manual check**

Run: `npm run lint` — expected: no errors.
Run: `npx tsc --noEmit` — expected: no errors.
Run: `npm run build` — expected: succeeds.

Run: `npm run dev`, visit `http://localhost:3000/uz/request-quote`:
- Submit with empty required fields → inline `errorRequired`/`errorEmail` messages appear, nothing is sent.
- Fill all required fields with valid data and submit → success panel replaces the form.
- Repeat a quick check on `/ru/request-quote` and `/en/request-quote`.
Stop the dev server afterward.

- [ ] **Step 8: Commit**

```bash
git add components/forms/quote-form.tsx app/api/quote-request "app/[lang]/request-quote"
git commit -m "feat: add Request Quote form, stub API route, and page"
```

---

## Task 17: Product Inquiry feature (Radix Dialog + stub API)

**Files:**
- Create: `components/forms/inquiry-dialog.tsx`
- Create: `app/api/inquiry/route.ts`
- Test: `app/api/inquiry/route.test.ts`
- Modify: `app/[lang]/products/[slug]/page.tsx` (from Task 9 — add the inquiry trigger next to the "Request Price" line)

**Interfaces:**
- Consumes: `inquirySchema`, `type InquiryInput` (Task 15); `Button`, `Input`, `Textarea`, `Label` (Task 4); `dict.inquiry.*` (Task 2); Radix `Dialog` (`@radix-ui/react-dialog`, installed Task 1); `lucide-react` `X` icon (installed Task 1).
- Produces: `InquiryDialog({ productId: string; productSlug: string; dict: Dictionary["inquiry"] })` — `'use client'`, a Radix `Dialog` triggered by a button showing `dict.openButton`, containing a React Hook Form + `zodResolver(inquirySchema)` form that POSTs to `/api/inquiry` with `productId`/`productSlug` pre-filled as hidden fields; shows a success panel in place of the form on success, resets to the form when the dialog is reopened after a successful submission.
- Produces: `POST` handler at `/api/inquiry` — same validate-then-log-then-respond pattern as `/api/quote-request` (Task 16), using `inquirySchema`.
- Modifies: `app/[lang]/products/[slug]/page.tsx` to render `<InquiryDialog productId={product.id} productSlug={product.slug} dict={dict.inquiry} />` next to the existing `dict.common.requestPrice` text.

- [ ] **Step 1: Write the failing test for the Route Handler**

Create `app/api/inquiry/route.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { POST } from "./route";

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/inquiry", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validPayload = {
  productId: "cat-injector-3126",
  productSlug: "cat-fuel-injector-3126",
  name: "Jane Doe",
  email: "jane@example.com",
  phone: "",
  message: "Is this compatible with CAT 320D?",
};

describe("POST /api/inquiry", () => {
  it("returns 200 and success for a valid payload", async () => {
    const response = await POST(makeRequest(validPayload));
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);
  });

  it("returns 400 for a payload missing required fields", async () => {
    const response = await POST(makeRequest({ productId: "cat-injector-3126" }));
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.success).toBe(false);
  });

  it("returns 400 for an invalid email", async () => {
    const response = await POST(makeRequest({ ...validPayload, email: "not-an-email" }));
    expect(response.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npm run test`
Expected: FAIL — `app/api/inquiry/route.ts` does not exist.

- [ ] **Step 3: Implement the Route Handler**

Create `app/api/inquiry/route.ts`:
```ts
import { NextResponse } from "next/server";
import { inquirySchema } from "@/lib/schemas";

export async function POST(request: Request) {
  const body = await request.json();
  const result = inquirySchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { success: false, errors: result.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  console.log("[inquiry]", result.data);

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `npm run test`
Expected: PASS.

- [ ] **Step 5: Create the Inquiry dialog client component**

Create `components/forms/inquiry-dialog.tsx`:
```tsx
"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { X } from "lucide-react";
import { inquirySchema, type InquiryInput } from "@/lib/schemas";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

type Status = "idle" | "submitting" | "success" | "error";

export function InquiryDialog({
  productId,
  productSlug,
  dict,
}: {
  productId: string;
  productSlug: string;
  dict: Dictionary["inquiry"];
}) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InquiryInput>({
    resolver: zodResolver(inquirySchema),
    defaultValues: { productId, productSlug, name: "", email: "", phone: "", message: "" },
  });

  async function onSubmit(values: InquiryInput) {
    setStatus("submitting");
    try {
      const response = await fetch("/api/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!response.ok) {
        setStatus("error");
        return;
      }
      setStatus("success");
      reset({ productId, productSlug, name: "", email: "", phone: "", message: "" });
    } catch {
      setStatus("error");
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setStatus("idle");
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger asChild>
        <Button variant="outline">{dict.openButton}</Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-60 bg-black/80" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-60 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-background p-6">
          <div className="flex items-start justify-between">
            <div>
              <Dialog.Title className="text-lg font-semibold text-foreground">{dict.title}</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted">{dict.subtitle}</Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button type="button" aria-label={dict.title} className="text-muted hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </Dialog.Close>
          </div>

          {status === "success" ? (
            <div className="mt-6 text-center">
              <h3 className="text-base font-semibold text-foreground">{dict.successTitle}</h3>
              <p className="mt-2 text-sm text-muted">{dict.successText}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
              <input type="hidden" {...register("productId")} />
              <input type="hidden" {...register("productSlug")} />

              <div>
                <Label htmlFor="inquiry-name">{dict.fieldName}</Label>
                <Input id="inquiry-name" {...register("name")} />
                {errors.name && <p className="mt-1 text-sm text-accent">{dict.errorRequired}</p>}
              </div>
              <div>
                <Label htmlFor="inquiry-email">{dict.fieldEmail}</Label>
                <Input id="inquiry-email" type="email" {...register("email")} />
                {errors.email && <p className="mt-1 text-sm text-accent">{dict.errorEmail}</p>}
              </div>
              <div>
                <Label htmlFor="inquiry-phone">{dict.fieldPhone}</Label>
                <Input id="inquiry-phone" {...register("phone")} />
              </div>
              <div>
                <Label htmlFor="inquiry-message">{dict.fieldMessage}</Label>
                <Textarea
                  id="inquiry-message"
                  placeholder={dict.fieldMessagePlaceholder}
                  {...register("message")}
                />
                {errors.message && <p className="mt-1 text-sm text-accent">{dict.errorRequired}</p>}
              </div>

              {status === "error" && <p className="text-sm text-accent">{dict.errorGeneric}</p>}

              <Button type="submit" disabled={status === "submitting"} className="w-full">
                {status === "submitting" ? dict.submitting : dict.submit}
              </Button>
            </form>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

- [ ] **Step 6: Wire the dialog into the Product Detail page**

Replace the full contents of `app/[lang]/products/[slug]/page.tsx` (adds the `InquiryDialog` import and renders it next to the "Request Price" text; everything else is unchanged from Task 9):
```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { products } from "@/lib/data/products";
import { categories } from "@/lib/data/categories";
import { brands } from "@/lib/data/brands";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { DEFAULT_LOCALE, isLocale, SUPPORTED_LOCALES } from "@/lib/i18n/locales";
import { ProductGallery } from "@/components/product/product-gallery";
import { SpecsTable } from "@/components/product/specs-table";
import { StockBadge } from "@/components/product/stock-badge";
import { RelatedProducts } from "@/components/product/related-products";
import { ProductJsonLd } from "@/components/product/product-json-ld";
import { InquiryDialog } from "@/components/forms/inquiry-dialog";

export function generateStaticParams() {
  return SUPPORTED_LOCALES.flatMap((lang) => products.map((product) => ({ lang, slug: product.slug })));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}): Promise<Metadata> {
  const { lang: rawLang, slug } = await params;
  const product = products.find((p) => p.slug === slug);
  const lang = isLocale(rawLang) ? rawLang : DEFAULT_LOCALE;
  if (!product) {
    return {};
  }
  const dict = getDictionary(lang);
  return {
    title: `${product.name[lang]} — ${dict.meta.siteName}`,
    description: product.description[lang],
  };
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}) {
  const { lang: rawLang, slug } = await params;
  const lang = isLocale(rawLang) ? rawLang : DEFAULT_LOCALE;
  const dict = getDictionary(lang);

  const product = products.find((p) => p.slug === slug);
  if (!product) {
    notFound();
  }

  const category = categories.find((c) => c.id === product.categoryId)!;
  const brand = brands.find((b) => b.id === product.brandId)!;

  return (
    <main className="mx-auto max-w-7xl px-6 pb-24 pt-24">
      <ProductJsonLd product={product} category={category} brand={brand} lang={lang} />

      <div className="grid gap-12 lg:grid-cols-2">
        <ProductGallery imageLabels={product.imageLabels} galleryAlt={dict.product.galleryAlt} />

        <div>
          <p className="text-sm text-muted">{brand.name}</p>
          <h1 className="mt-1 text-3xl font-semibold text-foreground">{product.name[lang]}</h1>

          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-muted">
            <span>
              {dict.product.skuLabel}: {product.sku}
            </span>
            <span>
              {dict.product.oemLabel}: {product.oemNumber}
            </span>
            <StockBadge status={product.stockStatus} stock={dict.common.stock} />
          </div>

          <p className="mt-6 text-foreground">{product.description[lang]}</p>

          <div>
            <h2 className="mt-8 text-lg font-semibold text-foreground">
              {dict.product.compatibleModelsTitle}
            </h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {product.compatibleModels.map((model) => (
                <li key={model} className="rounded-full border border-border px-3 py-1 text-xs text-muted">
                  {model}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <p className="text-2xl font-semibold text-accent">{dict.common.requestPrice}</p>
            <InquiryDialog productId={product.id} productSlug={product.slug} dict={dict.inquiry} />
          </div>
        </div>
      </div>

      <div className="mt-16">
        <SpecsTable specs={product.specs} lang={lang} title={dict.product.specificationsTitle} />
      </div>

      <div className="mt-16">
        <RelatedProducts
          product={product}
          lang={lang}
          title={dict.product.relatedProductsTitle}
          stock={dict.common.stock}
          requestPriceLabel={dict.common.requestPrice}
        />
      </div>
    </main>
  );
}
```

- [ ] **Step 7: Verify lint, typecheck, build, and manual check**

Run: `npm run lint` — expected: no errors.
Run: `npx tsc --noEmit` — expected: no errors.
Run: `npm run build` — expected: succeeds.

Run: `npm run dev`, visit a product detail page (e.g. `http://localhost:3000/uz/products/cat-fuel-injector-3126`):
- Click the inquiry open button → dialog opens with name/email/phone/message fields.
- Submit with an empty name/email/message → inline `errorRequired`/`errorEmail` messages appear.
- Fill valid data and submit → success panel replaces the form inside the dialog.
- Close and reopen the dialog → form resets to its empty state, not stuck on the success panel.
Stop the dev server afterward.

- [ ] **Step 8: Commit**

```bash
git add components/forms/inquiry-dialog.tsx app/api/inquiry "app/[lang]/products/[slug]/page.tsx"
git commit -m "feat: add Product Inquiry dialog and stub API route"
```

---

## Task 18: SEO finishing (sitemap + robots)

**Files:**
- Create: `app/sitemap.ts`
- Test: `app/sitemap.test.ts`
- Create: `app/robots.ts`

**Interfaces:**
- Consumes: `SUPPORTED_LOCALES` (Task 2); `products`, `categories`, `brands`, `blogPosts` (Task 3).
- Produces: default `sitemap(): MetadataRoute.Sitemap` at `app/sitemap.ts` — one entry per supported locale for each static path (home, `/products`, `/about`, `/blog`, `/contact`, `/request-quote`) plus every product/category/brand/blog-post detail route. This has real branching/aggregation logic (nested loops across locales × 4 data sets), so it is unit tested per the project's test-strategy convention.
- Produces: default `robots(): MetadataRoute.Robots` at `app/robots.ts` — allows all crawling, points to `/sitemap.xml`. Purely static/no branching — not unit tested, verified via `npm run build`.

- [ ] **Step 1: Write the failing sitemap test**

Create `app/sitemap.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import sitemap from "./sitemap";
import { SUPPORTED_LOCALES } from "@/lib/i18n/locales";
import { products } from "@/lib/data/products";
import { categories } from "@/lib/data/categories";
import { brands } from "@/lib/data/brands";
import { blogPosts } from "@/lib/data/blog";

const STATIC_PATH_COUNT = 6;

describe("sitemap", () => {
  it("includes one entry per locale for every static path, product, category, brand, and blog post", () => {
    const entries = sitemap();
    const expectedCount =
      SUPPORTED_LOCALES.length *
      (STATIC_PATH_COUNT + products.length + categories.length + brands.length + blogPosts.length);
    expect(entries).toHaveLength(expectedCount);
  });

  it("produces only unique URLs", () => {
    const entries = sitemap();
    const urls = entries.map((entry) => entry.url);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("includes a locale home page entry for every supported locale", () => {
    const entries = sitemap();
    const urls = new Set(entries.map((entry) => entry.url));
    for (const lang of SUPPORTED_LOCALES) {
      expect(urls.has(`https://dieselparts.uz/${lang}`)).toBe(true);
    }
  });

  it("includes every product detail URL for every locale", () => {
    const entries = sitemap();
    const urls = new Set(entries.map((entry) => entry.url));
    for (const lang of SUPPORTED_LOCALES) {
      for (const product of products) {
        expect(urls.has(`https://dieselparts.uz/${lang}/products/${product.slug}`)).toBe(true);
      }
    }
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npm run test`
Expected: FAIL — `app/sitemap.ts` does not exist.

- [ ] **Step 3: Implement the sitemap**

Create `app/sitemap.ts`:
```ts
import type { MetadataRoute } from "next";
import { SUPPORTED_LOCALES } from "@/lib/i18n/locales";
import { products } from "@/lib/data/products";
import { categories } from "@/lib/data/categories";
import { brands } from "@/lib/data/brands";
import { blogPosts } from "@/lib/data/blog";

const BASE_URL = "https://dieselparts.uz";

const STATIC_PATHS = ["", "/products", "/about", "/blog", "/contact", "/request-quote"];

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];

  for (const lang of SUPPORTED_LOCALES) {
    for (const path of STATIC_PATHS) {
      entries.push({ url: `${BASE_URL}/${lang}${path}`, lastModified: new Date() });
    }
    for (const product of products) {
      entries.push({ url: `${BASE_URL}/${lang}/products/${product.slug}`, lastModified: new Date() });
    }
    for (const category of categories) {
      entries.push({ url: `${BASE_URL}/${lang}/categories/${category.slug}`, lastModified: new Date() });
    }
    for (const brand of brands) {
      entries.push({ url: `${BASE_URL}/${lang}/brands/${brand.slug}`, lastModified: new Date() });
    }
    for (const post of blogPosts) {
      entries.push({
        url: `${BASE_URL}/${lang}/blog/${post.slug}`,
        lastModified: new Date(post.publishedAt),
      });
    }
  }

  return entries;
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `npm run test`
Expected: PASS.

- [ ] **Step 5: Create `robots.ts`**

Create `app/robots.ts`:
```ts
import type { MetadataRoute } from "next";

const BASE_URL = "https://dieselparts.uz";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
```

- [ ] **Step 6: Verify lint, typecheck, build, and manual check**

Run: `npm run lint` — expected: no errors.
Run: `npx tsc --noEmit` — expected: no errors.
Run: `npm run build` — expected: succeeds, with `/sitemap.xml` and `/robots.txt` listed in the output.

Run: `npm run dev`, visit `http://localhost:3000/sitemap.xml` and `http://localhost:3000/robots.txt`, verify both render valid XML/text with locale-prefixed URLs. Stop the dev server afterward.

- [ ] **Step 7: Commit**

```bash
git add app/sitemap.ts app/sitemap.test.ts app/robots.ts
git commit -m "feat: add sitemap and robots.txt covering all locales and mock data routes"
```

---

## Task 19: Final verification pass

**Files:** none (verification only — no source changes expected; if any check below fails, fix the underlying file from its originating task and re-run this task's checks before committing anything).

**Interfaces:**
- Consumes: the entire app built in Tasks 1–18.
- Produces: nothing new — confirms the whole site is internally consistent and every automated/manual check from spec §10 passes.

- [ ] **Step 1: Full automated verification**

Run, in order, and confirm each succeeds with zero errors/warnings:
```bash
npm run lint
npx tsc --noEmit
npm run test
npm run build
```
Expected: `npm run test` reports all suites passing (locales, dictionaries, mock-data integrity, filters/sort, scroll state, schemas, `/api/quote-request`, `/api/inquiry`, sitemap). Expected: `npm run build` output lists static routes for all locale-prefixed pages (home, products list, 45 product details, 30 category details, 21 brand details, about, blog list, 9 blog details, contact, request-quote) plus `/sitemap.xml` and `/robots.txt`.

- [ ] **Step 2: Manual cross-locale navigation check**

Run `npm run dev`. In a browser, for **each** of `uz`, `ru`, `en`:
- Visit the home page — hero, trust badges, about teaser, category grid, brand grid, featured products, and CTA banner all render with locale-appropriate copy.
- Visit `/products` — search box, brand/category/availability filters, sort dropdown, grid/list toggle, and pagination all work; results count text updates.
- Click into a product — gallery thumbnails swap the main image, SKU/OEM/stock badge/compatible models/specs/related products render, "Request Price" and the inquiry dialog trigger are both visible.
- Visit a category page and a brand page — product grids filtered correctly, using the shared `ProductCard`.
- Visit `/about` — story paragraphs and stats render.
- Visit `/blog` and a blog post — excerpt list and full paragraph body render.
- Visit `/contact` — address/phone/email/hours render.
- Visit `/request-quote` — submitting with missing fields shows inline errors; a fully valid submission shows the success panel.
- Open the inquiry dialog on a product page — same empty-state/success-state behavior as the quote form, and reopening after success resets to a blank form.

- [ ] **Step 3: Manual header behavior check**

With the dev server still running, on any locale's page:
- At the top of the page, the header is transparent (page content visible behind it).
- Scroll down past the solid threshold — the header becomes a solid black bar.
- Continue scrolling down — the header hides (translates out of view).
- Scroll up — the header reappears.
- Scroll back to the very top — the header returns to transparent.
- Resize to a mobile viewport (or use browser device emulation) and open the menu — a fullscreen black overlay appears with nav links and the locale switcher, using only black/white/`#F77D2A`.
- Switch locale via the header's locale switcher on a few different route types (home, product detail, category detail) — the equivalent page in the new locale loads (not the home page) via `switchLocalePath`.

Stop the dev server after this check.

- [ ] **Step 4: 404 and edge-case check**

With `npm run dev` running:
- Visit a nonexistent product slug, category slug, brand slug, and blog slug — all four show the Next.js 404 page.
- Visit `/` with no locale — redirects to `/uz`.
Stop the dev server afterward.

- [ ] **Step 5: Commit (only if Step 1 required fixes)**

If all checks in Step 1 already passed with no code changes, skip this step — there is nothing to commit. Otherwise:
```bash
git add <files touched by the fix>
git commit -m "fix: resolve issues found during final verification pass"
```

---
