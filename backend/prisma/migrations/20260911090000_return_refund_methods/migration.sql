CREATE TYPE "ReturnRefundMethod" AS ENUM ('CASH', 'CARD', 'TRANSFER', 'ONLINE', 'SELLER_AGREEMENT', 'PAYME', 'CLICK', 'PAYNET');
ALTER TABLE "Return" ALTER COLUMN "refundMethod" TYPE "ReturnRefundMethod" USING ("refundMethod"::text::"ReturnRefundMethod");
