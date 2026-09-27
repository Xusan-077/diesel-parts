-- Backfill: any row whose translation set is incomplete (a new oz/zh column
-- still NULL) is marked PENDING rather than the enum's COMPLETE default,
-- which only new/fully-supplied rows should carry. The default stays
-- COMPLETE — this migration is a one-time correction of already-existing
-- rows, not a change to the default.

UPDATE "Category"
SET "translationStatus" = 'PENDING'
WHERE "nameOz" IS NULL OR "nameZh" IS NULL;

UPDATE "Product"
SET "translationStatus" = 'PENDING'
WHERE "nameOz" IS NULL
   OR "nameZh" IS NULL
   OR "descriptionOz" IS NULL
   OR "descriptionZh" IS NULL;

UPDATE "Brand"
SET "translationStatus" = 'PENDING'
WHERE "nameOz" IS NULL OR "nameZh" IS NULL;
