import type {
  AdminProductListQuery,
  AuditListQuery,
  CustomerListQuery,
  InquiryListQuery,
} from "@/lib/schemas";

/**
 * Every cache key the panel uses, in one place.
 *
 * The panel's lists and its mutations are written in different files, and an
 * invalidation only works when both sides spell the key the same way. Naming
 * them here is what makes "archiving a product refreshes the catalogue table"
 * a fact about this file rather than a coincidence between two string
 * literals.
 *
 * Each resource exposes `all` — the prefix every one of its keys starts with,
 * which is what a mutation invalidates when it cannot know which page or
 * filter the reader is on. React Query matches keys by prefix, so invalidating
 * `["admin","products"]` catches every search term and page under it.
 */
export const adminKeys = {
  products: {
    all: ["admin", "products"] as const,
    list: (query: AdminProductListQuery) => ["admin", "products", "list", query] as const,
    /** The write payload behind one row, fetched when its edit dialog opens. */
    edit: (id: string) => ["admin", "products", "edit", id] as const,
  },
  categories: {
    all: ["admin", "categories"] as const,
    list: () => ["admin", "categories", "list"] as const,
  },
  staff: {
    all: ["admin", "staff"] as const,
    list: () => ["admin", "staff", "list"] as const,
  },
  reviews: {
    all: ["admin", "reviews"] as const,
    list: (page: number) => ["admin", "reviews", "list", page] as const,
  },
  discounts: {
    all: ["admin", "discounts"] as const,
    list: () => ["admin", "discounts", "list"] as const,
  },
  audit: {
    all: ["admin", "audit"] as const,
    list: (query: AuditListQuery) => ["admin", "audit", "list", query] as const,
  },
  inquiries: {
    all: ["admin", "inquiries"] as const,
    list: (query: InquiryListQuery) => ["admin", "inquiries", "list", query] as const,
    board: () => ["admin", "inquiries", "board"] as const,
  },
  customers: {
    all: ["admin", "customers"] as const,
    list: (query: CustomerListQuery) => ["admin", "customers", "list", query] as const,
    detail: (id: string) => ["admin", "customers", "detail", id] as const,
  },
} as const;
