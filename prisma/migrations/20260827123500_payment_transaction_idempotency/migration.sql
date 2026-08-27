/*
  Warnings:

  - A unique constraint covering the columns `[provider,transactionId]` on the table `Payment` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Payment_provider_transactionId_idx";

-- CreateIndex
CREATE UNIQUE INDEX "Payment_provider_transactionId_key" ON "Payment"("provider", "transactionId");
