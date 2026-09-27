-- CreateEnum
CREATE TYPE "TranslationStatus" AS ENUM ('COMPLETE', 'PENDING', 'FAILED');

-- AlterTable: Category — add oz/zh names + translation bookkeeping
ALTER TABLE "Category"
  ADD COLUMN "nameOz" TEXT,
  ADD COLUMN "nameZh" TEXT,
  ADD COLUMN "sourceLocale" TEXT DEFAULT 'uz',
  ADD COLUMN "translationStatus" "TranslationStatus" DEFAULT 'COMPLETE';

-- AlterTable: Product — add oz/zh name+description + translation bookkeeping
ALTER TABLE "Product"
  ADD COLUMN "nameOz" TEXT,
  ADD COLUMN "nameZh" TEXT,
  ADD COLUMN "descriptionOz" TEXT,
  ADD COLUMN "descriptionZh" TEXT,
  ADD COLUMN "sourceLocale" TEXT DEFAULT 'uz',
  ADD COLUMN "translationStatus" "TranslationStatus" DEFAULT 'COMPLETE';

-- AlterTable: Brand — add per-locale names (existing "name" column kept as-is
-- for backward compatibility; superseded by nameUz going forward)
ALTER TABLE "Brand"
  ADD COLUMN "nameUz" TEXT,
  ADD COLUMN "nameOz" TEXT,
  ADD COLUMN "nameRu" TEXT,
  ADD COLUMN "nameEn" TEXT,
  ADD COLUMN "nameZh" TEXT,
  ADD COLUMN "sourceLocale" TEXT DEFAULT 'uz',
  ADD COLUMN "translationStatus" "TranslationStatus" DEFAULT 'COMPLETE';

-- Backfill: seed Brand's new per-locale columns from the existing single
-- "name" column so every pre-existing brand already reads as COMPLETE in
-- uz/ru/en. Never touches Product/Category (nameUz/nameRu/nameEn already
-- existed there and are left untouched).
UPDATE "Brand"
SET "nameUz" = "name",
    "nameRu" = "name",
    "nameEn" = "name"
WHERE "nameUz" IS NULL;
