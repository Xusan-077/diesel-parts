import "server-only";
import { backendRequest } from "./backend-client";
import type { InquirySource } from "@/lib/api/backend-enums";

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

/**
 * The public-site inquiry form (product dialog, quote request, contact form).
 * `POST /inquiries` is the unauthenticated backend endpoint: no token, no
 * scoping, no audit trail — an anonymous visitor submitting a form is not a
 * staff action. A `BackendApiError` propagates; both route handlers already
 * turn a throw into their 500 with the user-facing copy.
 */
export async function createInquiry(input: CreateInquiryInput): Promise<void> {
  await backendRequest<{ success: boolean }>("/inquiries", {
    method: "POST",
    body: {
      customerName: input.customerName,
      phone: input.phone,
      email: input.email ?? undefined,
      message: input.message,
      source: input.source,
      productId: input.productId ?? undefined,
      productSku: input.productSku ?? undefined,
      quantity: input.quantity ?? undefined,
    },
  });
}
