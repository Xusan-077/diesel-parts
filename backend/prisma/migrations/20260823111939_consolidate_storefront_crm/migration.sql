-- ============================================================================
-- consolidate_storefront_crm
--
-- Absorbs the root-level storefront + sales-CRM domain model into backend/'s
-- Prisma schema (Task 1 of the backend-consolidation plan). Hand-edited from
-- the raw `prisma migrate diff` output: every column that becomes NOT NULL
-- from previously-absent/nullable data is added nullable first, backfilled,
-- then constrained, so this applies cleanly against the seeded dev DB.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. New enums
-- ----------------------------------------------------------------------------
-- CreateEnum
CREATE TYPE "DiscountStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "InquiryStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "InquirySource" AS ENUM ('PRODUCT_DIALOG', 'QUOTE_FORM', 'CONTACT_FORM');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT', 'IMPORT', 'LOGIN');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('LOW_STOCK', 'NEW_INQUIRY', 'DISCOUNT_REQUESTED', 'DISCOUNT_DECIDED', 'ORDER_STATUS');

-- Note: OrderStatus.DRAFT is added by the preceding migration
-- (20260823111930_order_status_add_draft), not here - see that migration's
-- header comment for why it had to be split out.

-- ----------------------------------------------------------------------------
-- 2. Drop constraints/indexes that no longer hold in the new shape
-- ----------------------------------------------------------------------------
-- DropForeignKey (warehouse_id becomes nullable; FK is re-added below with
-- ON DELETE SET NULL to match)
ALTER TABLE "orders" DROP CONSTRAINT "orders_warehouse_id_fkey";

-- DropIndex (Customer.phone uniqueness intentionally dropped - see schema
-- doc-comment: root's CRM model needs multiple customer cards per phone)
DROP INDEX "customers_phone_key";

-- DropIndex (Category.name replaced by nameUz/nameRu/nameEn + slug)
DROP INDEX "categories_name_key";

-- DropIndex (superseded by notifications_user_id_is_read_created_at_idx below)
DROP INDEX "notifications_user_id_is_read_idx";

-- ----------------------------------------------------------------------------
-- 3. Add new columns, nullable wherever the value must be backfilled first
-- ----------------------------------------------------------------------------
-- AlterTable users
ALTER TABLE "users"
  ADD COLUMN "discount_limit" INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN "email" TEXT,
  ADD COLUMN "name" TEXT NOT NULL DEFAULT '',
  ALTER COLUMN "phone" DROP NOT NULL;

-- AlterTable customers
ALTER TABLE "customers"
  ADD COLUMN "assigned_seller_id" TEXT,
  ADD COLUMN "company" TEXT,
  ADD COLUMN "email" TEXT,
  ADD COLUMN "notes" TEXT;

-- AlterTable categories (name_uz/name_ru/name_en/slug nullable for now -
-- backfilled below, then constrained NOT NULL; old "name" column kept until
-- the backfill that reads from it has run)
ALTER TABLE "categories"
  ADD COLUMN "icon" TEXT,
  ADD COLUMN "name_en" TEXT,
  ADD COLUMN "name_ru" TEXT,
  ADD COLUMN "name_uz" TEXT,
  ADD COLUMN "order" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "parent_id" TEXT,
  ADD COLUMN "slug" TEXT,
  ADD COLUMN "type" TEXT NOT NULL DEFAULT 'general';

-- AlterTable brands (slug nullable for now - backfilled below; the brief's
-- backfill list didn't cover Brand, but it needs the same treatment as
-- Category for the same reason: a NOT NULL unique slug column added to a
-- non-empty table)
ALTER TABLE "brands"
  ADD COLUMN "logo_url" TEXT,
  ADD COLUMN "slug" TEXT;

-- AlterTable products (name_uz/name_ru/name_en/slug nullable for now;
-- description_en/ru/uz get NOT NULL DEFAULT '' directly since Postgres
-- backfills the default into existing rows automatically, and the backfill
-- below then overwrites them from the old `description` column; old
-- name/description/image/selling_price columns kept until their backfill
-- reads have run)
ALTER TABLE "products"
  ADD COLUMN "compatible_models" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'UZS',
  ADD COLUMN "description_en" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "description_ru" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "description_uz" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "image_url" TEXT,
  ADD COLUMN "name_en" TEXT,
  ADD COLUMN "name_ru" TEXT,
  ADD COLUMN "name_uz" TEXT,
  ADD COLUMN "oem_numbers" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "price" DECIMAL(14,2),
  ADD COLUMN "slug" TEXT,
  ADD COLUMN "specs" JSONB NOT NULL DEFAULT '{}',
  ALTER COLUMN "purchase_price" DROP NOT NULL;

-- AlterTable orders
ALTER TABLE "orders"
  ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'UZS',
  ADD COLUMN "discount_approved_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN "discount_requested_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN "inquiry_id" TEXT,
  ADD COLUMN "notes" TEXT,
  ALTER COLUMN "warehouse_id" DROP NOT NULL,
  ALTER COLUMN "status" SET DEFAULT 'DRAFT';

-- AlterTable order_items (product_sku/product_name nullable for now -
-- backfilled below from products while products.name/sku are still intact)
ALTER TABLE "order_items"
  ADD COLUMN "product_name" TEXT,
  ADD COLUMN "product_sku" TEXT;

-- AlterTable notifications (type/message nullable for now - backfilled below
-- from title/body while those columns are still intact)
ALTER TABLE "notifications"
  ADD COLUMN "entity_id" TEXT,
  ADD COLUMN "message" TEXT,
  ADD COLUMN "type" "NotificationType";

-- ----------------------------------------------------------------------------
-- 4. Data backfill (order matters: order_items reads products.name/sku
--    before those columns are dropped in step 5)
-- ----------------------------------------------------------------------------
-- Category: old flat `name` -> all three i18n columns, plus a generated slug
UPDATE "categories" SET "name_uz" = "name", "name_ru" = "name", "name_en" = "name", "slug" = lower(regexp_replace("name", '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr("id", 1, 6) WHERE "name_uz" IS NULL;

-- Brand: same treatment as Category, for the same NOT NULL unique slug reason
UPDATE "brands" SET "slug" = lower(regexp_replace("name", '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr("id", 1, 6) WHERE "slug" IS NULL;

-- Product: old `name`/`image`/`selling_price` -> new columns
UPDATE "products" SET "name_uz" = "name", "name_ru" = "name", "name_en" = "name", "description_uz" = COALESCE("description", ''), "description_ru" = COALESCE("description", ''), "description_en" = COALESCE("description", ''), "price" = "selling_price", "image_url" = "image", "slug" = lower(regexp_replace("sku", '[^a-zA-Z0-9]+', '-', 'g')) WHERE "name_uz" IS NULL;

-- OrderItem: snapshot product_sku/product_name from the still-present
-- products.sku/name for every pre-existing line item
UPDATE "order_items" oi SET "product_sku" = p."sku", "product_name" = p."name" FROM "products" p WHERE oi."product_id" = p."id" AND oi."product_name" IS NULL;

-- User: give every existing staff account a synthetic slug-based name if it has none
UPDATE "users" SET "name" = COALESCE(NULLIF("name", ''), 'Staff ' || substr("id", 1, 6));

-- Notification: backfill enum + message from title/body
UPDATE "notifications" SET "type" = 'ORDER_STATUS', "message" = COALESCE("title" || ': ' || "body", "body") WHERE "type" IS NULL;

-- Give every existing Seller-linked User a default Warehouse if warehouses
-- exist but sellers.warehouse_id is null (unchanged rows keep working); if
-- backend/'s seed created no warehouse, create one:
INSERT INTO "warehouses" ("id", "name", "created_at", "updated_at") SELECT 'default-warehouse', 'Main', now(), now() WHERE NOT EXISTS (SELECT 1 FROM "warehouses");
UPDATE "sellers" SET "warehouse_id" = 'default-warehouse' WHERE "warehouse_id" IS NULL;

-- ----------------------------------------------------------------------------
-- 5. Now that the backfills above have run, enforce NOT NULL and drop the
--    old columns they replaced
-- ----------------------------------------------------------------------------
ALTER TABLE "categories"
  ALTER COLUMN "name_uz" SET NOT NULL,
  ALTER COLUMN "name_ru" SET NOT NULL,
  ALTER COLUMN "name_en" SET NOT NULL,
  ALTER COLUMN "slug" SET NOT NULL;

ALTER TABLE "categories" DROP COLUMN "name";

ALTER TABLE "brands"
  ALTER COLUMN "slug" SET NOT NULL;

ALTER TABLE "products"
  ALTER COLUMN "name_uz" SET NOT NULL,
  ALTER COLUMN "name_ru" SET NOT NULL,
  ALTER COLUMN "name_en" SET NOT NULL,
  ALTER COLUMN "slug" SET NOT NULL;

ALTER TABLE "products" DROP COLUMN "description",
DROP COLUMN "image",
DROP COLUMN "name",
DROP COLUMN "selling_price";

ALTER TABLE "order_items"
  ALTER COLUMN "product_name" SET NOT NULL,
  ALTER COLUMN "product_sku" SET NOT NULL;

ALTER TABLE "notifications"
  ALTER COLUMN "type" SET NOT NULL,
  ALTER COLUMN "message" SET NOT NULL;

ALTER TABLE "notifications" DROP COLUMN "body",
DROP COLUMN "title",
DROP COLUMN "updated_at";

-- ----------------------------------------------------------------------------
-- 6. New tables
-- ----------------------------------------------------------------------------
-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "body" TEXT,
    "author_name" TEXT NOT NULL,
    "author_phone" TEXT NOT NULL,
    "is_approved" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id"),
    -- Prisma's schema language can't express a numeric-range check; enforced
    -- here per the Review.rating doc-comment in schema.prisma.
    CONSTRAINT "reviews_rating_check" CHECK ("rating" >= 1 AND "rating" <= 5)
);

-- CreateTable
CREATE TABLE "inquiries" (
    "id" TEXT NOT NULL,
    "customer_name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "message" TEXT NOT NULL,
    "product_id" TEXT,
    "product_sku" TEXT,
    "quantity" INTEGER,
    "status" "InquiryStatus" NOT NULL DEFAULT 'NEW',
    "source" "InquirySource" NOT NULL,
    "assigned_seller_id" TEXT,
    "notes" TEXT,
    "follow_up_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inquiries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discount_requests" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "seller_id" TEXT NOT NULL,
    "requested_percent" DECIMAL(5,2) NOT NULL,
    "reason" TEXT,
    "status" "DiscountStatus" NOT NULL DEFAULT 'PENDING',
    "reviewed_by_user_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "decision_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "discount_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" "AuditAction" NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- ----------------------------------------------------------------------------
-- 7. Indexes
-- ----------------------------------------------------------------------------
-- CreateIndex
CREATE INDEX "reviews_product_id_is_approved_created_at_idx" ON "reviews"("product_id", "is_approved", "created_at");

-- CreateIndex
CREATE INDEX "reviews_is_approved_created_at_idx" ON "reviews"("is_approved", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_product_id_author_phone_key" ON "reviews"("product_id", "author_phone");

-- CreateIndex
CREATE INDEX "inquiries_status_created_at_idx" ON "inquiries"("status", "created_at");

-- CreateIndex
CREATE INDEX "inquiries_assigned_seller_id_idx" ON "inquiries"("assigned_seller_id");

-- CreateIndex
CREATE INDEX "inquiries_follow_up_at_idx" ON "inquiries"("follow_up_at");

-- CreateIndex
CREATE INDEX "discount_requests_status_created_at_idx" ON "discount_requests"("status", "created_at");

-- CreateIndex
CREATE INDEX "discount_requests_seller_id_idx" ON "discount_requests"("seller_id");

-- CreateIndex
CREATE INDEX "discount_requests_order_id_idx" ON "discount_requests"("order_id");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_created_at_idx" ON "audit_logs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "customers_assigned_seller_id_idx" ON "customers"("assigned_seller_id");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "categories_parent_id_order_idx" ON "categories"("parent_id", "order");

-- CreateIndex
CREATE UNIQUE INDEX "brands_slug_key" ON "brands"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");

-- CreateIndex
CREATE INDEX "orders_inquiry_id_idx" ON "orders"("inquiry_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_is_read_created_at_idx" ON "notifications"("user_id", "is_read", "created_at");

-- ----------------------------------------------------------------------------
-- 8. Foreign keys
-- ----------------------------------------------------------------------------
-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_assigned_seller_id_fkey" FOREIGN KEY ("assigned_seller_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_assigned_seller_id_fkey" FOREIGN KEY ("assigned_seller_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_inquiry_id_fkey" FOREIGN KEY ("inquiry_id") REFERENCES "inquiries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discount_requests" ADD CONSTRAINT "discount_requests_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discount_requests" ADD CONSTRAINT "discount_requests_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discount_requests" ADD CONSTRAINT "discount_requests_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
