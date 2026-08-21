-- The Review table is new in the previous migration and still empty, so the
-- required column is added outright rather than backfilled behind a default.
-- A default here would be worse than none: every pre-existing row would share
-- one "identity" and the unique index below would then reject all but the
-- first of them.

-- DropIndex
DROP INDEX "Review_productId_isApproved_idx";

-- AlterTable
ALTER TABLE "Review" ADD COLUMN     "authorPhone" TEXT NOT NULL,
ALTER COLUMN "isApproved" SET DEFAULT true;

-- CreateIndex
CREATE INDEX "Review_productId_isApproved_createdAt_idx" ON "Review"("productId", "isApproved", "createdAt");

-- One review per person per part. The site has no customer user table — a
-- session carries a verified phone and nothing else — so the phone is the only
-- identity available to hold this rule.
-- CreateIndex
CREATE UNIQUE INDEX "Review_productId_authorPhone_key" ON "Review"("productId", "authorPhone");
