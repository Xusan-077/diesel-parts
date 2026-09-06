-- Self-checkout: a per-order contact phone, a "settle with the seller" payment
-- method, and structured address columns. Purely additive — every new column is
-- nullable and the enum only gains a value, so existing orders are untouched.

-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'SELLER_AGREEMENT';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "contactPhone" TEXT,
ADD COLUMN     "deliveryApartment" TEXT,
ADD COLUMN     "deliveryHouse" TEXT,
ADD COLUMN     "deliveryLandmark" TEXT,
ADD COLUMN     "deliveryRegion" TEXT;
