import { z } from "zod";
import { GENDERS, isIsoDate } from "@/lib/account/profile";
import { isValidPhone } from "@/lib/auth/phone";
import { CATALOG_ICON_KEYS } from "@/lib/data/catalog-menu";
import { PRODUCT_SEARCH_MIN_LENGTH } from "@/lib/api/product-search";
import {
  REVIEW_AUTHOR_MAX,
  REVIEW_BODY_MAX,
  REVIEW_BODY_MIN,
  REVIEWS_PAGE_SIZE,
} from "@/lib/reviews";

/** One line as the client posts it — no price, no name; backend/ owns those. */
export const cartSetItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(1).max(99),
});

export type CartSetItemInput = z.infer<typeof cartSetItemSchema>;

/** A guest's localStorage cart, sent up to merge into the server cart. */
export const cartMergeSchema = z.object({
  items: z.array(cartSetItemSchema).max(200),
});

export type CartMergeInput = z.infer<typeof cartMergeSchema>;

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

/* ── Product reviews ──────────────────────────────────────────────────────── */

/**
 * A review as the public site submits it.
 *
 * The author's phone is deliberately not a field. It comes from the session
 * cookie on the server, exactly as the OTP flow reads the pending phone — a
 * caller who could name their own identity could review the same part under a
 * hundred of them, and the unique index would be decoration.
 *
 * The bounds are imported rather than repeated so the browser's own check in
 * `validateReviewDraft` and this one cannot drift apart.
 */
export const reviewCreateSchema = z.object({
  productId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  body: z.string().trim().min(REVIEW_BODY_MIN).max(REVIEW_BODY_MAX),
  authorName: z.string().trim().min(1).max(REVIEW_AUTHOR_MAX),
});

export type ReviewCreateInput = z.infer<typeof reviewCreateSchema>;

export const reviewListQuerySchema = z.object({
  productId: z.string().min(1),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(REVIEWS_PAGE_SIZE * 4)
    .default(REVIEWS_PAGE_SIZE),
});

export type ReviewListQuery = z.infer<typeof reviewListQuerySchema>;

/** A director taking a review down, or putting one back. */
export const reviewModerateSchema = z.object({
  isApproved: z.boolean(),
});

export type ReviewModerateInput = z.infer<typeof reviewModerateSchema>;

export const requestCodeSchema = z.object({
  phone: z.string().refine(isValidPhone, "invalid_phone"),
});

export type RequestCodeInput = z.infer<typeof requestCodeSchema>;

export const verifyCodeSchema = z.object({
  code: z.string().regex(/^\d{6}$/, "invalid_code"),
});

export type VerifyCodeInput = z.infer<typeof verifyCodeSchema>;

/** The verify-code body, with the guest's localStorage cart along for the ride. */
export const verifyCodeWithCartSchema = verifyCodeSchema.extend({
  cart: cartMergeSchema.optional(),
});

export type VerifyCodeWithCartInput = z.infer<typeof verifyCodeWithCartSchema>;

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
 * column drift away from the numbers it describes. `imageUrl` is absent for
 * the same reason it is not part of this list: it is set only by the
 * dedicated image-upload endpoints (see `product-image-storage.ts`), never by
 * this general write.
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
  isActive: z.boolean(),
});

export type ProductWriteInput = z.infer<typeof productWriteSchema>;

/* ── Director panel: AI product fill ──────────────────────────────────────── */

export const aiFillRequestSchema = z.object({
  oemNumber: z.string().min(1).max(64),
  category: z.string().max(120).optional(),
});

export type AiFillRequest = z.infer<typeof aiFillRequestSchema>;

/** The field keys a warning can point at — mirrors backend's `WARNABLE_FIELDS`. */
export const aiFillWarnableFields = [
  "sku",
  "slug",
  "name",
  "description",
  "categoryId",
  "brandId",
  "compatibleModels",
  "specs",
] as const;

/**
 * `name`/`description` as the AI-fill result carries them: unlike
 * `productWriteSchema`'s `localizedSchema`, a language is allowed to be an
 * empty string here. That is the documented behavior for a language (or
 * every language) the lookup could not fill in — "topilmagan maydonlarni
 * bo'sh qoldiradi, warnings'da belgilaydi" — and it is not an error the
 * director's review modal needs the route to refuse; the modal already
 * shows a warning badge on the field instead (see `aiWarnings`).
 */
const optionalLocalizedSchema = z.object({
  uz: z.string(),
  ru: z.string(),
  en: z.string(),
});

/**
 * What `backend/`'s `POST internal/products/ai-fill` answers with — validated
 * here rather than trusted blindly, since it crossed a service boundary.
 * `price`/`stock` are deliberately absent: the director fills those in by
 * hand, per the feature spec.
 */
export const aiFillResultSchema = z.object({
  sku: z.string(),
  slug: z.string(),
  oemNumbers: z.array(z.string()),
  name: optionalLocalizedSchema,
  description: optionalLocalizedSchema,
  categoryId: z.string().nullable(),
  brandId: z.string().nullable(),
  compatibleModels: z.array(z.string()),
  specs: z.array(productSpecSchema),
  warnings: z.array(z.enum(aiFillWarnableFields)),
  confidence: z.enum(["high", "medium", "low"]),
});

export type AiFillResult = z.infer<typeof aiFillResultSchema>;

export const aiGenerateImageRequestSchema = z.object({
  productName: z.string().min(1).max(200),
  oemNumber: z.string().max(64).optional(),
});

export type AiGenerateImageRequest = z.infer<typeof aiGenerateImageRequestSchema>;

export const aiGenerateImageResultSchema = z.object({
  base64: z.string().min(1),
  mimeType: z.string().min(1),
});

export type AiGenerateImageResult = z.infer<typeof aiGenerateImageResultSchema>;

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

/* ── Director panel: listings the browser refetches ──────────────────────── */

/** One page of any panel listing. */
const adminPageSchema = z.coerce.number().int().min(1).max(10_000).default(1);

/**
 * The panel's own product listing.
 *
 * Deliberately not `parseProductQuery`: that one serves the public catalog,
 * where inactive rows do not exist and stock is not a sort key. This is the
 * director's view of the same table, and the two must not drift into each
 * other — a public filter that accidentally accepted `includeInactive` would
 * publish the archive.
 */
export const adminProductListQuerySchema = z.object({
  q: z.string().max(200).default(""),
  page: adminPageSchema,
  /** `1` from a query string; anything else reads as "active rows only". */
  all: z
    .enum(["0", "1"])
    .default("0")
    .transform((value) => value === "1"),
  sort: z.enum(["stock", "name", "price"]).default("stock"),
});

export type AdminProductListQuery = z.infer<typeof adminProductListQuerySchema>;

/** The moderation queue: every review, hidden ones included. */
export const adminReviewListQuerySchema = z.object({
  page: adminPageSchema,
});

export type AdminReviewListQuery = z.infer<typeof adminReviewListQuerySchema>;

/** The audit trail, optionally narrowed to one kind of record. */
export const auditListQuerySchema = z.object({
  page: adminPageSchema,
  entityType: z.string().min(1).max(60).optional(),
});

export type AuditListQuery = z.infer<typeof auditListQuerySchema>;

/* ── Seller panel: inquiries, customers, orders ───────────────────────────── */

/**
 * A follow-up date the seller picked. Accepts a bare `2026-09-01` as well as a
 * full timestamp: the panel's date input sends the short form, and rejecting it
 * would push a timezone conversion into the browser for no gain.
 */
const isoDateSchema = z.union([z.iso.datetime({ offset: true }), z.iso.date()]);

/** One page of any seller listing. Same rule as `adminPageSchema` above. */
const pageSchema = adminPageSchema;

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

/* ── Director panel: catalog structure ───────────────────────────────── */

/**
 * One node of the catalog menu.
 *
 * `parentId` is nullable rather than optional: a category is either a column of
 * the menu or an entry inside one, and the form has to be able to say "move
 * this back to the top level" as well as "leave it where it is". The repository
 * refuses a parent that is not itself a top-level category, which is what keeps
 * the menu two levels deep.
 */
export const categoryWriteSchema = z.object({
  name: localizedSchema,
  slug: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug_format"),
  /** Part family shared by a column and everything in it — "engine", "filters". */
  type: z
    .string()
    .min(1)
    .max(40)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "type_format"),
  parentId: z.string().min(1).nullable(),
  order: z.number().int().min(0).max(9_999),
  icon: z.enum(CATALOG_ICON_KEYS).nullable(),
});

export type CategoryWriteInput = z.infer<typeof categoryWriteSchema>;


/* ── Customer profile ─────────────────────────────────────────────────────── */

/**
 * The account panel's forms.
 *
 * Every message here is a *code*, not a sentence. The panel is rendered in
 * three languages and the schema has no dictionary, so it names the fault and
 * the form looks the wording up — the same split the rest of the site uses
 * between `authErrorMessage` and the API's error strings.
 */

const NAME_MIN = 2;
const NAME_MAX = 40;

/** Today in the visitor's own timezone: a birthday is a calendar date, not an instant. */
function todayIso(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export const profileDetailsSchema = z.object({
  firstName: z.string().trim().min(NAME_MIN, "tooShort").max(NAME_MAX, "tooLong"),
  lastName: z.string().trim().min(NAME_MIN, "tooShort").max(NAME_MAX, "tooLong"),
  // Optional, and stays optional: a shop has no business refusing to save a
  // name because the visitor would rather not give a birthday.
  birthDate: z
    .string()
    .refine((value) => value === "" || isIsoDate(value), "invalidDate")
    // ISO dates sort lexicographically, so this is the whole comparison.
    .refine((value) => value === "" || value <= todayIso(), "futureDate"),
  gender: z.union([z.enum(GENDERS), z.literal("")]),
});

export type ProfileDetailsInput = z.infer<typeof profileDetailsSchema>;
