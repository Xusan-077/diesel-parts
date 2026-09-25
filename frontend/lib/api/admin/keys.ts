import type {
  AdminProductListQuery,
  AuditListQuery,
  CustomerListQuery,
  FinanceDebtListQuery,
  FinanceExpenseListQuery,
  FinancePaymentListQuery,
  FinanceSummaryQuery,
  GoodsReceiptListQuery,
  InquiryListQuery,
  MovementsReportQuery,
  ProductMovementsQuery,
  WarehouseProductListQuery,
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
    /** Whether a permanent delete would go through, fetched when its dialog opens. */
    deleteCheck: (id: string) => ["admin", "products", "delete-check", id] as const,
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
  warehouse: {
    /** Prefix over the whole module — an approved receipt moves stock, which
     *  touches products, movements and the dashboard at once. */
    all: ["admin", "warehouse"] as const,
    products: {
      all: ["admin", "warehouse", "products"] as const,
      list: (query: WarehouseProductListQuery) =>
        ["admin", "warehouse", "products", "list", query] as const,
      detail: (id: string) => ["admin", "warehouse", "products", "detail", id] as const,
      movements: (id: string, query: ProductMovementsQuery) =>
        ["admin", "warehouse", "products", "movements", id, query] as const,
    },
    warehouses: {
      all: ["admin", "warehouse", "warehouses"] as const,
      list: () => ["admin", "warehouse", "warehouses", "list"] as const,
      detail: (id: string) => ["admin", "warehouse", "warehouses", "detail", id] as const,
    },
    receipts: {
      all: ["admin", "warehouse", "receipts"] as const,
      list: (query: GoodsReceiptListQuery) =>
        ["admin", "warehouse", "receipts", "list", query] as const,
      detail: (id: string) => ["admin", "warehouse", "receipts", "detail", id] as const,
    },
    reports: {
      all: ["admin", "warehouse", "reports"] as const,
      movements: (query: MovementsReportQuery) =>
        ["admin", "warehouse", "reports", "movements", query] as const,
    },
  },
  finance: {
    /** Prefix over the whole module — recording a debt payment or an expense
     *  moves the KPI header, which every tab shows. */
    all: ["admin", "finance"] as const,
    summary: (query: FinanceSummaryQuery) => ["admin", "finance", "summary", query] as const,
    payments: (query: FinancePaymentListQuery) =>
      ["admin", "finance", "payments", query] as const,
    expenses: {
      all: ["admin", "finance", "expenses"] as const,
      list: (query: FinanceExpenseListQuery) =>
        ["admin", "finance", "expenses", "list", query] as const,
    },
    debts: {
      all: ["admin", "finance", "debts"] as const,
      list: (query: FinanceDebtListQuery) =>
        ["admin", "finance", "debts", "list", query] as const,
    },
  },
} as const;
