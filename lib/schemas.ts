import { z } from "zod";
import { isValidPhone } from "@/lib/auth/phone";
import { PRODUCT_SEARCH_MIN_LENGTH } from "@/lib/api/product-search";

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

/* ── Seller panel: inquiries, customers, orders ───────────────────────────── */

/**
 * A follow-up date the seller picked. Accepts a bare `2026-09-01` as well as a
 * full timestamp: the panel's date input sends the short form, and rejecting it
 * would push a timezone conversion into the browser for no gain.
 */
const isoDateSchema = z.union([z.iso.datetime({ offset: true }), z.iso.date()]);

/** One page of any seller listing. */
const pageSchema = z.coerce.number().int().min(1).max(10_000).default(1);

export const inquiryColumnSchema = z.enum(["new", "claimed", "in_progress", "won", "lost"]);

export const inquiryListQuerySchema = z.object({
  column: inquiryColumnSchema.optional(),
  /** Directors only; a seller's list is scoped to them whatever they ask for. */
  sellerId: z.string().min(1).optional(),
  page: pageSchema,
});

export type InquiryListQuery = z.infer<typeof inquiryListQuerySchema>;

/**
 * A board move. "Band qilingan" is absent on purpose: claiming is its own
 * endpoint, and the column falls out of the assignee (see `inquiry-board.ts`).
 *
 * Every field is optional and the object must carry at least one, so a PATCH
 * can move the card, leave a note, or set a callback date without the caller
 * having to resend the two it is not touching.
 */
export const inquiryUpdateSchema = z
  .object({
    status: z.enum(["NEW", "IN_PROGRESS", "WON", "LOST"]).optional(),
    notes: z.string().max(2000).nullable().optional(),
    followUpAt: isoDateSchema.nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "no_fields");

export type InquiryUpdateInput = z.infer<typeof inquiryUpdateSchema>;

export const customerListQuerySchema = z.object({
  search: z.string().max(120).optional(),
  /** Switches a seller's list to the unclaimed pool instead of their own book. */
  pool: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
  page: pageSchema,
});

export type CustomerListQuery = z.infer<typeof customerListQuerySchema>;

export const customerCreateSchema = z.object({
  name: z.string().min(1).max(160),
  // Not unique in the database — a company switchboard is shared by several
  // contacts — so nothing here pretends it identifies a person.
  phone: z.string().min(1).max(32),
  email: z.string().email().nullable().optional(),
  company: z.string().max(160).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export type CustomerCreateInput = z.infer<typeof customerCreateSchema>;

export const customerUpdateSchema = customerCreateSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, "no_fields");

export type CustomerUpdateInput = z.infer<typeof customerUpdateSchema>;

/**
 * One order line.
 *
 * `unitPrice` is optional because the repository snapshots `Product.price`
 * instead of trusting the caller — an editable line price lets a seller reach
 * any total they like and routes around `User.discountLimit` entirely. It is
 * accepted, and then required, only for products priced on request, where
 * there is no catalog figure to snapshot.
 */
export const orderItemSchema = z.object({
  productId: z.string().min(1),
  qty: z.number().int().min(1).max(100_000),
  unitPrice: z.number().nonnegative().max(1_000_000_000).nullable().optional(),
});

export type OrderItemInput = z.infer<typeof orderItemSchema>;

export const orderCreateSchema = z.object({
  customerId: z.string().min(1),
  items: z.array(orderItemSchema).min(1).max(100),
  notes: z.string().max(2000).nullable().optional(),
  /** Set when the order was raised from a board card. */
  inquiryId: z.string().min(1).nullable().optional(),
});

export type OrderCreateInput = z.infer<typeof orderCreateSchema>;

export const orderUpdateSchema = z
  .object({
    status: z.enum(["DRAFT", "PENDING", "CONFIRMED", "COMPLETED", "CANCELLED"]).optional(),
    items: z.array(orderItemSchema).min(1).max(100).optional(),
    notes: z.string().max(2000).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "no_fields");

export type OrderUpdateInput = z.infer<typeof orderUpdateSchema>;

export const orderListQuerySchema = z.object({
  status: z.enum(["DRAFT", "PENDING", "CONFIRMED", "COMPLETED", "CANCELLED"]).optional(),
  customerId: z.string().min(1).optional(),
  page: pageSchema,
});

export type OrderListQuery = z.infer<typeof orderListQuerySchema>;

/**
 * The catalog lookup the order form types into. The floor on `q` is the one in
 * `product-search.ts`: a one-character term matches half the catalog.
 */
export const productLookupQuerySchema = z.object({
  q: z.string().trim().min(PRODUCT_SEARCH_MIN_LENGTH).max(120),
});

export type ProductLookupQuery = z.infer<typeof productLookupQuerySchema>;

/**
 * A discount on an order. Inside the seller's own limit it applies at once;
 * above it this creates the `DiscountRequest` the director's queue answers.
 */
export const discountRequestSchema = z.object({
  percent: z.number().min(0).max(100),
  reason: z.string().max(500).nullable().optional(),
});

export type DiscountRequestInput = z.infer<typeof discountRequestSchema>;
