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

/**
 * Staff sign-in. The password is only checked for presence: a length rule here
 * would reject nothing an attacker sends and would advertise the policy.
 */
export const staffLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type StaffLoginInput = z.infer<typeof staffLoginSchema>;

/* ── Director panel: product management ───────────────────────────────────── */

/** One localized text field, required in all three languages. */
const localizedSchema = z.object({
  uz: z.string().min(1),
  ru: z.string().min(1),
  en: z.string().min(1),
});

export const productSpecSchema = z.object({
  label: localizedSchema,
  value: z.string().min(1),
});

/**
 * `stockStatus` is deliberately absent: the repository derives it from
 * stock/minStock on every write, so accepting it from a caller would let the
 * column drift away from the numbers it describes.
 */
export const productWriteSchema = z.object({
  sku: z.string().min(1).max(64),
  slug: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug_format"),
  oemNumbers: z.array(z.string().min(1)).max(20),
  name: localizedSchema,
  description: localizedSchema,
  price: z.number().nonnegative().nullable(),
  stock: z.number().int().min(0).max(1_000_000),
  minStock: z.number().int().min(0).max(1_000_000),
  categoryId: z.string().min(1),
  brandId: z.string().min(1),
  compatibleModels: z.array(z.string().min(1)).max(50),
  specs: z.array(productSpecSchema).max(30),
  imageLabels: z.array(z.string().min(1)).max(10),
  isActive: z.boolean(),
});

export type ProductWriteInput = z.infer<typeof productWriteSchema>;

/* ── Director panel: user management ──────────────────────────────────────── */

export const userCreateSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  phone: z.string().max(32).optional().nullable(),
  password: z.string().min(8).max(200),
  role: z.enum(["DIRECTOR", "SELLER"]),
  discountLimit: z.number().int().min(0).max(100),
});

export type UserCreateInput = z.infer<typeof userCreateSchema>;

/**
 * Password is absent on purpose. Changing someone else's password is a separate
 * action with its own audit line, not a side effect of editing their profile.
 */
export const userUpdateSchema = z.object({
  name: z.string().min(1).max(120),
  phone: z.string().max(32).optional().nullable(),
  role: z.enum(["DIRECTOR", "SELLER"]),
  discountLimit: z.number().int().min(0).max(100),
  isActive: z.boolean(),
});

export type UserUpdateInput = z.infer<typeof userUpdateSchema>;

/** A director's answer to a discount request. */
export const discountDecisionSchema = z.object({
  approve: z.boolean(),
  note: z.string().max(500).optional().nullable(),
});

export type DiscountDecisionInput = z.infer<typeof discountDecisionSchema>;
