/**
 * Batch-translates every Category/Product/Brand row still marked
 * translationStatus=PENDING, using the same AiService/GeminiService pair the
 * ai.controller.ts translate endpoints use — called directly (no HTTP, no
 * ThrottlerGuard), since this is a trusted background job, not a
 * rate-limited public surface.
 *
 * Each row's current AI-locale columns (uz/ru/en/zh) are passed as `existing`
 * so AiService only fills what's actually missing — it never overwrites a
 * value a human already entered. oz is likewise left as-is if already
 * present (see writeOzIfMissing below); AiService recomputes it from the
 * final uz anyway, so this is a belt-and-braces no-op in the common case.
 *
 * Config (env, both optional):
 *   BACKFILL_BATCH_SIZE  — rows fetched per page (default 10)
 *   BACKFILL_DELAY_MS    — pause between individual Gemini calls (default 1000)
 *
 * Run:
 *   npx tsx scripts/backfill-pending-translations.ts --dry-run
 *   npx tsx scripts/backfill-pending-translations.ts
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { AiService, TranslateEntityInput } from '../src/ai/ai.service';
import { GeminiService } from '../src/ai/gemini.service';
import { AiLocale, TranslateSourceFields } from '../src/ai/translation.schema';

const DRY_RUN = process.argv.includes('--dry-run');
const BATCH_SIZE = Number(process.env.BACKFILL_BATCH_SIZE) || 10;
const DELAY_MS = Number(process.env.BACKFILL_DELAY_MS) || 1000;

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});
const ai = new AiService(new GeminiService());

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveSourceLocale(raw: string | null): AiLocale {
  return raw === 'uz' || raw === 'ru' || raw === 'en' || raw === 'zh'
    ? raw
    : 'uz';
}

interface NameOnlyRow {
  id: string;
  sourceLocale: string | null;
  nameUz: string | null;
  nameRu: string | null;
  nameEn: string | null;
  nameZh: string | null;
}

function existingNameLocales(
  row: NameOnlyRow,
): Partial<Record<AiLocale, TranslateSourceFields>> {
  const existing: Partial<Record<AiLocale, TranslateSourceFields>> = {};
  if (row.nameUz) existing.uz = { name: row.nameUz };
  if (row.nameRu) existing.ru = { name: row.nameRu };
  if (row.nameEn) existing.en = { name: row.nameEn };
  if (row.nameZh) existing.zh = { name: row.nameZh };
  return existing;
}

async function backfillCategories() {
  let processed = 0;
  let failed = 0;
  const seenIds: string[] = [];
  for (;;) {
    const rows = await prisma.category.findMany({
      where: { translationStatus: 'PENDING', id: { notIn: seenIds } },
      select: {
        id: true,
        sourceLocale: true,
        nameUz: true,
        nameRu: true,
        nameEn: true,
        nameZh: true,
      },
      take: BATCH_SIZE,
    });
    if (rows.length === 0) break;

    for (const row of rows) {
      seenIds.push(row.id);
      const sourceLocale = resolveSourceLocale(row.sourceLocale);
      const existing = existingNameLocales(row);
      const sourceField = existing[sourceLocale];
      if (!sourceField) {
        console.warn(
          `[category ${row.id}] skipped: no text for its own sourceLocale=${sourceLocale}`,
        );
        continue;
      }
      const input: TranslateEntityInput = {
        sourceLocale,
        fields: sourceField,
        existing,
      };
      const result = await ai.translateEntity(input);
      console.log(
        `[category ${row.id}] status=${result.status} name.uz="${result.locales.uz?.name}"`,
      );
      if (result.status === 'FAILED') failed++;

      if (!DRY_RUN) {
        await prisma.category.update({
          where: { id: row.id },
          data: {
            nameUz: result.locales.uz?.name ?? row.nameUz,
            nameRu: result.locales.ru?.name ?? row.nameRu,
            nameEn: result.locales.en?.name ?? row.nameEn,
            nameZh: result.locales.zh?.name ?? row.nameZh,
            translationStatus: result.status,
          },
        });
      }
      await sleep(DELAY_MS);
    }
    processed += rows.length;
    if (rows.length < BATCH_SIZE) break;
  }
  console.log(`Categories processed: ${processed} (failed: ${failed})`);
}

async function backfillProducts() {
  let processed = 0;
  let failed = 0;
  const seenIds: string[] = [];
  for (;;) {
    const rows = await prisma.product.findMany({
      where: { translationStatus: 'PENDING', id: { notIn: seenIds } },
      select: {
        id: true,
        sourceLocale: true,
        nameUz: true,
        nameRu: true,
        nameEn: true,
        nameZh: true,
        descriptionUz: true,
        descriptionRu: true,
        descriptionEn: true,
        descriptionZh: true,
      },
      take: BATCH_SIZE,
    });
    if (rows.length === 0) break;

    for (const row of rows) {
      seenIds.push(row.id);
      const sourceLocale = resolveSourceLocale(row.sourceLocale);
      const existingNames = existingNameLocales(row);
      const existing: Partial<Record<AiLocale, TranslateSourceFields>> = {};
      const descByLocale: Record<AiLocale, string | null> = {
        uz: row.descriptionUz,
        ru: row.descriptionRu,
        en: row.descriptionEn,
        zh: row.descriptionZh,
      };
      for (const locale of ['uz', 'ru', 'en', 'zh'] as const) {
        if (existingNames[locale]) {
          existing[locale] = {
            name: existingNames[locale].name,
            description: descByLocale[locale] ?? undefined,
          };
        }
      }
      const sourceField = existing[sourceLocale];
      if (!sourceField) {
        console.warn(
          `[product ${row.id}] skipped: no text for its own sourceLocale=${sourceLocale}`,
        );
        continue;
      }
      const input: TranslateEntityInput = {
        sourceLocale,
        fields: sourceField,
        existing,
      };
      const result = await ai.translateEntity(input);
      console.log(
        `[product ${row.id}] status=${result.status} name.uz="${result.locales.uz?.name}"`,
      );
      if (result.status === 'FAILED') failed++;

      if (!DRY_RUN) {
        await prisma.product.update({
          where: { id: row.id },
          data: {
            nameUz: result.locales.uz?.name ?? row.nameUz,
            nameRu: result.locales.ru?.name ?? row.nameRu,
            nameEn: result.locales.en?.name ?? row.nameEn,
            nameZh: result.locales.zh?.name ?? row.nameZh,
            descriptionUz: result.locales.uz?.description ?? row.descriptionUz,
            descriptionRu: result.locales.ru?.description ?? row.descriptionRu,
            descriptionEn: result.locales.en?.description ?? row.descriptionEn,
            descriptionZh: result.locales.zh?.description ?? row.descriptionZh,
            translationStatus: result.status,
          },
        });
      }
      await sleep(DELAY_MS);
    }
    processed += rows.length;
    if (rows.length < BATCH_SIZE) break;
  }
  console.log(`Products processed: ${processed} (failed: ${failed})`);
}

async function backfillBrands() {
  let processed = 0;
  let failed = 0;
  const seenIds: string[] = [];
  for (;;) {
    const rows = await prisma.brand.findMany({
      where: { translationStatus: 'PENDING', id: { notIn: seenIds } },
      select: {
        id: true,
        name: true,
        sourceLocale: true,
        nameUz: true,
        nameRu: true,
        nameEn: true,
        nameZh: true,
      },
      take: BATCH_SIZE,
    });
    if (rows.length === 0) break;

    for (const row of rows) {
      seenIds.push(row.id);
      const sourceLocale = resolveSourceLocale(row.sourceLocale);
      const existing = existingNameLocales(row);
      // Deprecated `name` is the last-resort source for a row that predates
      // the per-locale columns entirely (see Brand.name's TODO in schema.prisma).
      const sourceField = existing[sourceLocale] ?? { name: row.name };
      const input: TranslateEntityInput = {
        sourceLocale,
        fields: sourceField,
        existing,
      };
      const result = await ai.translateEntity(input);
      console.log(
        `[brand ${row.id}] status=${result.status} name.uz="${result.locales.uz?.name}"`,
      );
      if (result.status === 'FAILED') failed++;

      if (!DRY_RUN) {
        await prisma.brand.update({
          where: { id: row.id },
          data: {
            nameUz: result.locales.uz?.name ?? row.nameUz,
            nameRu: result.locales.ru?.name ?? row.nameRu,
            nameEn: result.locales.en?.name ?? row.nameEn,
            nameZh: result.locales.zh?.name ?? row.nameZh,
            translationStatus: result.status,
          },
        });
      }
      await sleep(DELAY_MS);
    }
    processed += rows.length;
    if (rows.length < BATCH_SIZE) break;
  }
  console.log(`Brands processed: ${processed} (failed: ${failed})`);
}

async function main() {
  console.log(DRY_RUN ? '--- DRY RUN (no writes) ---' : '--- LIVE RUN ---');
  if (!new GeminiService().isConfigured()) {
    console.warn(
      'GEMINI_API_KEY is not set — every row will fall back to translationStatus=FAILED (source locale + oz only).',
    );
  }
  await backfillCategories();
  await backfillProducts();
  await backfillBrands();
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error('backfill-pending-translations FAILED:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
