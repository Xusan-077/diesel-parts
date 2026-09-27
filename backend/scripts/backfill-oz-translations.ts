/**
 * Fills the "oz" (Uzbek Cyrillic) locale on Category/Product/Brand rows left
 * PENDING by the 20260926140000 migration, by deterministic transliteration
 * of the uz text (src/common/i18n/transliterate-uz.ts) — no AI call, so this
 * can run standalone before the Gemini-backed AI module (stage B) exists.
 *
 * It only ever writes the *Oz columns. translationStatus is left untouched
 * here (still PENDING) — zh is still missing and the status only becomes
 * COMPLETE once the AI-backed backfill (stage D) fills that in too.
 *
 * Run:
 *   npx tsx scripts/backfill-oz-translations.ts --dry-run
 *   npx tsx scripts/backfill-oz-translations.ts
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { transliterateUzLatinToCyrillic } from '../src/common/i18n/transliterate-uz';

const DRY_RUN = process.argv.includes('--dry-run');
const BATCH_SIZE = 50;

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

// Excludes already-seen ids on top of the "still missing" filter. Needed
// because in --dry-run nothing is written, so the "still missing" set never
// shrinks on its own — without this a dry run would loop forever re-reading
// the same first page.
async function backfillCategories() {
  let processed = 0;
  const seenIds: string[] = [];
  for (;;) {
    const rows = await prisma.category.findMany({
      where: { nameOz: null, id: { notIn: seenIds } },
      select: { id: true, nameUz: true },
      take: BATCH_SIZE,
    });
    if (rows.length === 0) break;
    for (const row of rows) {
      const nameOz = transliterateUzLatinToCyrillic(row.nameUz);
      console.log(`[category ${row.id}] "${row.nameUz}" -> "${nameOz}"`);
      seenIds.push(row.id);
      if (!DRY_RUN) {
        await prisma.category.update({
          where: { id: row.id },
          data: { nameOz },
        });
      }
    }
    processed += rows.length;
    if (rows.length < BATCH_SIZE) break;
  }
  console.log(`Categories processed: ${processed}`);
}

async function backfillProducts() {
  let processed = 0;
  const seenIds: string[] = [];
  for (;;) {
    const rows = await prisma.product.findMany({
      where: {
        OR: [{ nameOz: null }, { descriptionOz: null }],
        id: { notIn: seenIds },
      },
      select: { id: true, nameUz: true, descriptionUz: true },
      take: BATCH_SIZE,
    });
    if (rows.length === 0) break;
    for (const row of rows) {
      const nameOz = transliterateUzLatinToCyrillic(row.nameUz);
      const descriptionOz = transliterateUzLatinToCyrillic(row.descriptionUz);
      console.log(`[product ${row.id}] "${row.nameUz}" -> "${nameOz}"`);
      seenIds.push(row.id);
      if (!DRY_RUN) {
        await prisma.product.update({
          where: { id: row.id },
          data: { nameOz, descriptionOz },
        });
      }
    }
    processed += rows.length;
    if (rows.length < BATCH_SIZE) break;
  }
  console.log(`Products processed: ${processed}`);
}

async function backfillBrands() {
  let processed = 0;
  const seenIds: string[] = [];
  for (;;) {
    const rows = await prisma.brand.findMany({
      where: { nameOz: null, id: { notIn: seenIds } },
      select: { id: true, nameUz: true, name: true },
      take: BATCH_SIZE,
    });
    if (rows.length === 0) break;
    for (const row of rows) {
      const source = row.nameUz ?? row.name;
      const nameOz = transliterateUzLatinToCyrillic(source);
      console.log(`[brand ${row.id}] "${source}" -> "${nameOz}"`);
      seenIds.push(row.id);
      if (!DRY_RUN) {
        await prisma.brand.update({
          where: { id: row.id },
          data: { nameOz },
        });
      }
    }
    processed += rows.length;
    if (rows.length < BATCH_SIZE) break;
  }
  console.log(`Brands processed: ${processed}`);
}

async function main() {
  console.log(DRY_RUN ? '--- DRY RUN (no writes) ---' : '--- LIVE RUN ---');
  await backfillCategories();
  await backfillProducts();
  await backfillBrands();
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error('backfill-oz-translations FAILED:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
