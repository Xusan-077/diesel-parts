-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "cancelReason" INTEGER,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "provider" TEXT,
ADD COLUMN     "providerCreateTime" BIGINT,
ADD COLUMN     "transactionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "payments_provider_transactionId_key" ON "payments"("provider", "transactionId");
