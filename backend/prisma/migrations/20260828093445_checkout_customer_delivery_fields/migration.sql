-- CreateEnum
CREATE TYPE "DeliveryMethod" AS ENUM ('PICKUP', 'DELIVERY');

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "tax_id" TEXT;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "delivery_city" TEXT,
ADD COLUMN     "delivery_district" TEXT,
ADD COLUMN     "delivery_method" "DeliveryMethod" NOT NULL DEFAULT 'PICKUP',
ADD COLUMN     "delivery_notes" TEXT,
ADD COLUMN     "delivery_street" TEXT;
