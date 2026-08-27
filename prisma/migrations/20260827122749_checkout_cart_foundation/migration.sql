-- CreateEnum
CREATE TYPE "OrderChannel" AS ENUM ('STAFF', 'ONLINE');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('ONLINE', 'BANK_TRANSFER');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'PENDING_VERIFICATION');

-- CreateEnum
CREATE TYPE "DeliveryMethod" AS ENUM ('STANDARD', 'EXPRESS', 'PICKUP');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OrderStatus" ADD VALUE 'PAYMENT_PENDING';
ALTER TYPE "OrderStatus" ADD VALUE 'PAYMENT_FAILED';
ALTER TYPE "OrderStatus" ADD VALUE 'PAID';
ALTER TYPE "OrderStatus" ADD VALUE 'PROCESSING';
ALTER TYPE "OrderStatus" ADD VALUE 'READY_FOR_SHIPMENT';
ALTER TYPE "OrderStatus" ADD VALUE 'SHIPPED';
ALTER TYPE "OrderStatus" ADD VALUE 'DELIVERED';
ALTER TYPE "OrderStatus" ADD VALUE 'REFUNDED';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "addressId" TEXT,
ADD COLUMN     "channel" "OrderChannel" NOT NULL DEFAULT 'STAFF',
ADD COLUMN     "deliveryFee" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "deliveryMethod" "DeliveryMethod",
ADD COLUMN     "paymentMethod" "PaymentMethod",
ADD COLUMN     "paymentStatus" "PaymentStatus";

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "provider" TEXT,
    "transactionId" TEXT,
    "receiptUrl" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Address" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "label" TEXT,
    "country" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "line" TEXT NOT NULL,
    "postalCode" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cart" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CartItem" (
    "id" TEXT NOT NULL,
    "cartId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "CartItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Payment_orderId_idx" ON "Payment"("orderId");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE INDEX "Payment_provider_transactionId_idx" ON "Payment"("provider", "transactionId");

-- CreateIndex
CREATE INDEX "Address_customerId_idx" ON "Address"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "Cart_phone_key" ON "Cart"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "CartItem_cartId_productId_key" ON "CartItem"("cartId", "productId");

-- CreateIndex
CREATE INDEX "Order_channel_status_idx" ON "Order"("channel", "status");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "Address"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Address" ADD CONSTRAINT "Address_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Cart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
