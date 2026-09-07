-- Reconcile migration history with production reality.
--
-- `20260817145718_init_catalog` created `Product.imageLabels`, and
-- `20260823070819_drop_product_image_labels` dropped it. Production then
-- RE-ADDED the column by hand during the 2026-08-23 hotfix (see the incident
-- section of docs/deploy-checklist.md) and that re-add was never captured as a
-- migration. `schema.prisma` models the column (it exists in prod), so the
-- migration history was one step short of prod — enough drift to block
-- `prisma migrate dev`.
--
-- `IF NOT EXISTS` so this is a safe no-op on any database that already carries
-- the column (production, the staging prod-copy), and a real add on a database
-- built purely from migration history.

-- AlterTable
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "imageLabels" TEXT[];
