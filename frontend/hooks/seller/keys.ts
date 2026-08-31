import type {
  CustomersQuery,
  InventoryQuery,
  MovementsQuery,
  OrdersQuery,
  ProductsQuery,
} from "@/lib/api/seller-panel/types";

/**
 * Every TanStack Query cache key the seller panel uses. Mirrors the shape of
 * lib/api/admin/keys.ts: each resource exposes `all`, the prefix a mutation
 * invalidates when it cannot know which page/filter a reader is on.
 */
export const sellerKeys = {
  dashboard: {
    all: ["seller", "dashboard"] as const,
    summary: () => ["seller", "dashboard", "summary"] as const,
    sales: (range: { dateFrom?: string; dateTo?: string }) =>
      ["seller", "dashboard", "sales", range] as const,
    orders: (range: { dateFrom?: string; dateTo?: string }) =>
      ["seller", "dashboard", "orders", range] as const,
    topProducts: () => ["seller", "dashboard", "top-products"] as const,
  },
  orders: {
    all: ["seller", "orders"] as const,
    list: (query: OrdersQuery) => ["seller", "orders", "list", query] as const,
    detail: (id: string) => ["seller", "orders", "detail", id] as const,
  },
  products: {
    all: ["seller", "products"] as const,
    list: (query: ProductsQuery) => ["seller", "products", "list", query] as const,
    detail: (id: string) => ["seller", "products", "detail", id] as const,
    stock: (id: string) => ["seller", "products", "stock", id] as const,
  },
  customers: {
    all: ["seller", "customers"] as const,
    list: (query: CustomersQuery) => ["seller", "customers", "list", query] as const,
    detail: (id: string) => ["seller", "customers", "detail", id] as const,
    orders: (id: string, page: number) => ["seller", "customers", "orders", id, page] as const,
  },
  inventory: {
    all: ["seller", "inventory"] as const,
    list: (query: InventoryQuery) => ["seller", "inventory", "list", query] as const,
    lowStock: (query: InventoryQuery) => ["seller", "inventory", "low-stock", query] as const,
    movements: (query: MovementsQuery) => ["seller", "inventory", "movements", query] as const,
  },
  notifications: {
    all: ["seller", "notifications"] as const,
    list: () => ["seller", "notifications", "list"] as const,
  },
  catalog: {
    categories: () => ["seller", "catalog", "categories"] as const,
    brands: () => ["seller", "catalog", "brands"] as const,
    warehouses: () => ["seller", "catalog", "warehouses"] as const,
  },
} as const;
