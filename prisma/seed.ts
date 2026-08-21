/* ============================================================================
 * Seeds reference data: brands, categories, products, and the initial DIRECTOR.
 *
 * PLACEHOLDER PRICES: product prices come from prisma/seed-data/products.ts and
 * are invented UZS figures, not real pricing. See the header of that file.
 *
 * Idempotent — every write is an upsert keyed by id, so re-running is safe.
 * Run with:  npm run db:seed
 * ==========================================================================*/
import { hash } from "bcryptjs";
import { deriveStockStatus } from "@/lib/api/stock-status";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/prisma/generated/prisma/client";
import { brands } from "@/prisma/seed-data/brands";
import { categories } from "@/prisma/seed-data/categories";
import { products } from "@/prisma/seed-data/products";

const BCRYPT_COST = 12;

/** Stock figures that reproduce the mock catalog's availability mix exactly. */
const STOCK_BY_STATUS = {
  available: 25,
  limited: 3,
  out_of_stock: 0,
} as const;

const MIN_STOCK = 5;

const DIRECTOR_EMAIL = "director@dieselparts.uz";

async function seedDirector(): Promise<void> {
  const password = process.env.SEED_DIRECTOR_PASSWORD;

  if (!password || password.length < 8) {
    throw new Error(
      "SEED_DIRECTOR_PASSWORD must be set to at least 8 characters. " +
        "The seed never falls back to a hardcoded password. See .env.example.",
    );
  }

  await prisma.user.upsert({
    where: { email: DIRECTOR_EMAIL },
    // Left empty on purpose: re-seeding must never reset a password the
    // director has since changed, nor reactivate an account they disabled.
    update: {},
    create: {
      name: "Direktor",
      email: DIRECTOR_EMAIL,
      passwordHash: await hash(password, BCRYPT_COST),
      role: "DIRECTOR",
      // A director approves discounts rather than requesting them, so no
      // ceiling applies to what they can apply themselves.
      discountLimit: 100,
    },
  });
}

async function main(): Promise<void> {
  console.warn(
    "\n[seed] WARNING: seeded product prices are PLACEHOLDER UZS figures, not\n" +
      "[seed] real pricing. Replace them before showing the catalog to customers.\n",
  );

  for (const brand of brands) {
    await prisma.brand.upsert({
      where: { id: brand.id },
      update: { slug: brand.slug, name: brand.name },
      create: { id: brand.id, slug: brand.slug, name: brand.name },
    });
  }

  for (const category of categories) {
    const fields = {
      slug: category.slug,
      nameUz: category.name.uz,
      nameRu: category.name.ru,
      nameEn: category.name.en,
    };
    await prisma.category.upsert({
      where: { id: category.id },
      update: fields,
      create: { id: category.id, ...fields },
    });
  }

  for (const product of products) {
    const stock = STOCK_BY_STATUS[product.stockStatus];
    const fields = {
      slug: product.slug,
      sku: product.sku,
      // Stored upper-cased so search can match them: Prisma's array `has` takes
      // no case-insensitivity mode. Every current value is already upper-case,
      // so this is a no-op today and an invariant for whatever is added later.
      oemNumbers: product.oemNumbers.map((oem) => oem.trim().toUpperCase()),
      nameUz: product.name.uz,
      nameRu: product.name.ru,
      nameEn: product.name.en,
      descriptionUz: product.description.uz,
      descriptionRu: product.description.ru,
      descriptionEn: product.description.en,
      price: product.price,
      stock,
      minStock: MIN_STOCK,
      stockStatus: deriveStockStatus(stock, MIN_STOCK),
      categoryId: product.categoryId,
      brandId: product.brandId,
      compatibleModels: product.compatibleModels,
      // ProductSpec[] in the domain, Json in the column.
      specs: product.specs as unknown as Prisma.InputJsonValue,
      imageLabels: product.imageLabels,
    };
    await prisma.product.upsert({
      where: { id: product.id },
      update: fields,
      create: { id: product.id, ...fields },
    });
  }

  await seedDirector();

  const counts = {
    brands: await prisma.brand.count(),
    categories: await prisma.category.count(),
    products: await prisma.product.count(),
    users: await prisma.user.count(),
  };
  console.log("[seed] done:", counts);
}

main()
  .catch((error: unknown) => {
    console.error("[seed] failed:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
