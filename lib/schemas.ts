import { z } from "zod";
import { isValidPhone } from "@/lib/auth/phone";

/** One cart line carried along with a quote request. */
export const quoteCartItemSchema = z.object({
  productId: z.string().min(1),
  sku: z.string().min(1),
  name: z.string().min(1),
  quantity: z.number().int().min(1).max(99),
  price: z.number().nullable(),
});

export type QuoteCartItemInput = z.infer<typeof quoteCartItemSchema>;

export const quoteRequestSchema = z.object({
  name: z.string().min(1),
  company: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email(),
  country: z.string().min(1),
  products: z.string().min(1),
  quantity: z.string().min(1),
  message: z.string().optional(),
  /** Present when the request came from the cart. */
  cartItems: z.array(quoteCartItemSchema).optional(),
});

export type QuoteRequestInput = z.infer<typeof quoteRequestSchema>;

export const inquirySchema = z.object({
  productId: z.string().min(1),
  productSlug: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  message: z.string().min(1),
});

export type InquiryInput = z.infer<typeof inquirySchema>;

export const requestCodeSchema = z.object({
  phone: z.string().refine(isValidPhone, "invalid_phone"),
});

export type RequestCodeInput = z.infer<typeof requestCodeSchema>;

export const verifyCodeSchema = z.object({
  code: z.string().regex(/^\d{6}$/, "invalid_code"),
});

export type VerifyCodeInput = z.infer<typeof verifyCodeSchema>;
