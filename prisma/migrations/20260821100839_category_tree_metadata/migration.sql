-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'general';

-- CreateIndex
CREATE INDEX "Category_parentId_order_idx" ON "Category"("parentId", "order");
