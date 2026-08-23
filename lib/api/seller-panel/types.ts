/**
 * Shapes mirror backend/src/**\/*.ts exactly (auth.types.ts, schema.prisma,
 * *.service.ts). Decimal columns (money) serialize as strings over JSON —
 * see backend's Prisma Decimal — so they are typed `string` here and parsed
 * with Number() only at the point of display/formatting.
 */

export type Role = "SUPER_ADMIN" | "DIRECTOR" | "MANAGER" | "SELLER" | "VIEWER";

export interface AuthenticatedUser {
  id: string;
  phone: string;
  role: Role;
  sellerId: string | null;
}

export interface MeResponse {
  id: string;
  phone: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  seller: { id: string; warehouseId: string | null } | null;
}

export interface LoginResponse {
  accessToken: string;
  user: AuthenticatedUser;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export type OrderStatus = "NEW" | "CONFIRMED" | "PREPARING" | "COMPLETED" | "CANCELLED";
export type OrderPaymentStatus = "UNPAID" | "PARTIAL" | "PAID";
export type PaymentMethod = "CASH" | "CARD" | "TRANSFER" | "ONLINE";
export type PaymentStatus = "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED";
export type StockMovementType = "IN" | "OUT" | "RESERVE" | "RELEASE";
export type StockStatus = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";

/** NEW -> CONFIRMED -> PREPARING -> COMPLETED, CANCELLED reachable up until COMPLETED. Mirrors backend/src/orders/order-status-transitions.ts. */
export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  NEW: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PREPARING", "CANCELLED"],
  PREPARING: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export const ORDER_STATUS_SEQUENCE: OrderStatus[] = [
  "NEW",
  "CONFIRMED",
  "PREPARING",
  "COMPLETED",
];

export function canTransitionOrderStatus(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_STATUS_TRANSITIONS[from].includes(to);
}

export interface OrderCustomer {
  id: string;
  name: string;
  phone: string;
}

export interface OrderSeller {
  id: string;
  user: { id: string; phone: string };
}

export interface OrderWarehouse {
  id: string;
  name: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  product: { id: string; sku: string; name: string };
  quantity: number;
  price: string;
  total: string;
}

export interface Payment {
  id: string;
  orderId: string;
  amount: string;
  method: PaymentMethod;
  status: PaymentStatus;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Invoice {
  id: string;
  orderId: string;
  invoiceNumber: string;
  issuedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerId: string;
  customer: OrderCustomer;
  sellerId: string;
  seller: OrderSeller;
  warehouseId: string;
  warehouse: OrderWarehouse;
  status: OrderStatus;
  subtotal: string;
  discount: string;
  deliveryFee: string;
  total: string;
  paymentStatus: OrderPaymentStatus;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
  payments: Payment[];
  invoice: Invoice | null;
}

export interface OrdersQuery extends PaginationParams {
  status?: OrderStatus;
  customerId?: string;
  dateFrom?: string;
  dateTo?: string;
}

/** No purchasePrice/supplier fields — ProductsService.toSellerView strips them before this ever serializes. */
export interface SellerProduct {
  id: string;
  sku: string;
  name: string;
  categoryId: string;
  category: { id: string; name: string };
  brandId: string;
  brand: { id: string; name: string };
  description: string | null;
  sellingPrice: string;
  image: string | null;
  minStock: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  stockStatus: StockStatus;
}

export interface ProductsQuery extends PaginationParams {
  search?: string;
  categoryId?: string;
  brandId?: string;
  stockStatus?: StockStatus;
}

export interface ProductStockByWarehouse {
  warehouseId: string;
  warehouseName: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
}

export interface ProductStock {
  byWarehouse: ProductStockByWarehouse[];
  totals: { quantity: number; reservedQuantity: number; availableQuantity: number };
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  telegram: string | null;
  debt: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomersQuery extends PaginationParams {
  search?: string;
}

/** CustomersService.findOrders only includes `items` — narrower than the full Order shape returned by /seller/orders. */
export interface CustomerOrderRow {
  id: string;
  orderNumber: string;
  customerId: string;
  sellerId: string;
  warehouseId: string;
  status: OrderStatus;
  subtotal: string;
  discount: string;
  deliveryFee: string;
  total: string;
  paymentStatus: OrderPaymentStatus;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
}

export interface InventoryProduct {
  id: string;
  sku: string;
  name: string;
  minStock: number;
}

export interface InventoryRow {
  id: string;
  productId: string;
  product: InventoryProduct;
  warehouseId: string;
  warehouse: OrderWarehouse;
  quantity: number;
  reservedQuantity: number;
  createdAt: string;
  updatedAt: string;
  availableQuantity: number;
  status: StockStatus;
}

export interface InventoryQuery extends PaginationParams {
  warehouseId?: string;
  productId?: string;
  status?: StockStatus;
}

export interface StockMovement {
  id: string;
  inventoryId: string;
  inventory: InventoryRow;
  type: StockMovementType;
  quantity: number;
  reason: string | null;
  createdById: string | null;
  createdBy: { id: string; phone: string } | null;
  createdAt: string;
}

export interface MovementsQuery extends PaginationParams {
  productId?: string;
  warehouseId?: string;
}

export interface DashboardSummary {
  today: {
    sales: number;
    ordersCount: number;
    pendingCount: number;
    newCustomers: number;
  };
  changeVsPriorPeriod: {
    salesPercent: number;
    ordersPercent: number;
    newCustomersPercent: number;
  };
}

export interface DateRangeQuery {
  dateFrom?: string;
  dateTo?: string;
}

export interface DashboardPoint {
  date: string;
  total: number;
}

export interface TopProduct {
  product: { id: string; sku: string; name: string } | null;
  quantitySold: number;
  revenue: number;
}

export interface Category {
  id: string;
  name: string;
}

export interface Warehouse {
  id: string;
  name: string;
  location: string | null;
}

export interface Brand {
  id: string;
  name: string;
}

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  updatedAt: string;
}
