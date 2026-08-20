-- AlterTable
ALTER TABLE "Inquiry" ADD COLUMN     "followUpAt" TIMESTAMP(3),
ADD COLUMN     "notes" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "inquiryId" TEXT;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "discountLimit" SET DEFAULT 5;

-- CreateIndex
CREATE INDEX "Inquiry_followUpAt_idx" ON "Inquiry"("followUpAt");

-- CreateIndex
CREATE INDEX "Order_inquiryId_idx" ON "Order"("inquiryId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_inquiryId_fkey" FOREIGN KEY ("inquiryId") REFERENCES "Inquiry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
