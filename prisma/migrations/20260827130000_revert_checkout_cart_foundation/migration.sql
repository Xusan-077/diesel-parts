-- Revert of 20260827122749_checkout_cart_foundation and
-- 20260827123500_payment_transaction_idempotency: the checkout/cart work
-- moved to backend/ (see docs/superpowers/plans/2026-08-27-checkout-cart-on-backend.md).
-- All tables/columns touched here were added this session and hold no data.

-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT IF EXISTS "Order_addressId_fkey";
ALTER TABLE "Payment" DROP CONSTRAINT IF EXISTS "Payment_orderId_fkey";
ALTER TABLE "Address" DROP CONSTRAINT IF EXISTS "Address_customerId_fkey";
ALTER TABLE "CartItem" DROP CONSTRAINT IF EXISTS "CartItem_cartId_fkey";
ALTER TABLE "CartItem" DROP CONSTRAINT IF EXISTS "CartItem_productId_fkey";

-- DropTable
DROP TABLE IF EXISTS "CartItem";
DROP TABLE IF EXISTS "Cart";
DROP TABLE IF EXISTS "Address";
DROP TABLE IF EXISTS "Payment";

-- AlterTable: drop the added Order columns
ALTER TABLE "Order"
  DROP COLUMN IF EXISTS "addressId",
  DROP COLUMN IF EXISTS "channel",
  DROP COLUMN IF EXISTS "deliveryFee",
  DROP COLUMN IF EXISTS "deliveryMethod",
  DROP COLUMN IF EXISTS "paymentMethod",
  DROP COLUMN IF EXISTS "paymentStatus";

-- DropIndex
DROP INDEX IF EXISTS "Order_channel_status_idx";

-- DropEnum
DROP TYPE IF EXISTS "OrderChannel";
DROP TYPE IF EXISTS "PaymentMethod";
DROP TYPE IF EXISTS "PaymentStatus";
DROP TYPE IF EXISTS "DeliveryMethod";

-- Narrow OrderStatus back to its original five values. Postgres cannot drop
-- enum values directly, so the enum is recreated and the column repointed
-- at it — the standard narrowing pattern. Safe here: no row uses any of the
-- values being dropped (the feature that would have wants never shipped).
CREATE TYPE "OrderStatus_new" AS ENUM ('DRAFT', 'PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED');
ALTER TABLE "Order" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Order" ALTER COLUMN "status" TYPE "OrderStatus_new" USING ("status"::text::"OrderStatus_new");
ALTER TABLE "Order" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
DROP TYPE "OrderStatus";
ALTER TYPE "OrderStatus_new" RENAME TO "OrderStatus";
