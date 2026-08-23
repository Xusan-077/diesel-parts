-- ============================================================================
-- order_status_add_draft
--
-- Split out from consolidate_storefront_crm as its own migration because
-- Postgres refuses to let a transaction use an enum value it just added via
-- ALTER TYPE ... ADD VALUE when the enum type predates that transaction
-- (error: "unsafe use of new value ... New enum values must be committed
-- before they can be used."). consolidate_storefront_crm sets
-- orders.status's DEFAULT to 'DRAFT' and needs 'DRAFT' to already be a
-- committed member of OrderStatus by the time it runs. Verified empirically
-- against this project's dev DB (Postgres 17) before writing this file.
-- ============================================================================

-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE 'DRAFT';
