import { prisma } from "@/lib/db";
import type { InquirySource } from "@/prisma/generated/prisma/enums";

export interface CreateInquiryInput {
  customerName: string;
  phone: string;
  email?: string | null;
  message: string;
  source: InquirySource;
  productId?: string | null;
  productSku?: string | null;
  quantity?: number | null;
}

export async function createInquiry(input: CreateInquiryInput): Promise<void> {
  await prisma.inquiry.create({
    data: {
      customerName: input.customerName,
      phone: input.phone,
      email: input.email ?? null,
      message: input.message,
      source: input.source,
      productId: input.productId ?? null,
      productSku: input.productSku ?? null,
      quantity: input.quantity ?? null,
    },
  });
}
