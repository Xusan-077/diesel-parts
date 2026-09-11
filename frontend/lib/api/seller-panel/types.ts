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

/**
 * `PARTIALLY_REFUNDED`/`REFUNDED` are reachable only from `COMPLETED`, and
 * only by ReturnsService creating a return — never by the generic
 * PATCH /status the stepper drives, so they carry no forward edges in
 * `ORDER_STATUS_TRANSITIONS` below. Listed here so existing order rows don't
 * render a blank status badge once a return has been made against them.
 */
export type OrderStatus =
  | "NEW"
  | "CONFIRMED"
  | "PREPARING"
  | "COMPLETED"
  | "CANCELLED"
  | "PARTIALLY_REFUNDED"
  | "REFUNDED";
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
  PARTIALLY_REFUNDED: [],
  REFUNDED: [],
};

export const ORDER_STATUS_SEQUENCE: OrderStatus[] = [
  "NEW",
  "CONFIRMED",
  "PREPARING",
  "COMPLETED",
];

export function canTransitionOrderStatus(
  from: OrderStatus,
  to: OrderStatus,
): boolean {
  return ORDER_STATUS_TRANSITIONS[from].includes(to);
}

export interface OrderCustomer {
  id: string;
  name: string;
  phone: string;
}

/** `Order.seller` is a FK straight to `User` — no `Seller` indirection (see backend's orders.service.ts doc-comment). */
export interface OrderSeller {
  id: string;
  name: string;
  phone: string;
}

export interface OrderWarehouse {
  id: string;
  name: string;
}

/**
 * Mirrors backend's `OrderItem` model + `ORDER_INCLUDE`'s `items.product`
 * select exactly (`{id, sku, nameEn}` — no other locale, no `total`/`price`/
 * `quantity` aliases: those never existed on the wire, only `qty`/
 * `unitPrice`/`productSku`/`productName` do). A line total is `qty *
 * unitPrice`, computed at render time, not a field the API sends.
 */
export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  product: { id: string; sku: string; nameEn: string };
  productSku: string;
  productName: string;
  qty: number;
  unitPrice: string;
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
  warehouseId: string | null;
  warehouse: OrderWarehouse | null;
  status: OrderStatus;
  subtotal: string;
  discount: string;
  deliveryFee: string;
  totalAmount: string;
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
  search?: string;
}

/**
 * Mirrors the real `Product` row `ProductsService.findAllSeller`/
 * `findOneSeller`/`findByBarcodeSeller` return — no `purchasePrice`
 * (`toSellerView` strips it) and no flattened `name`/`sellingPrice`/`image`
 * aliases: the backend never produces those, only the three locale columns,
 * `price`, and `imageUrl`. The seller panel displays `nameEn` throughout for
 * one consistent language, same as order-item/inventory rows (which only
 * ever carry `nameEn` from the backend's own select).
 */
export interface SellerProduct {
  id: string;
  sku: string;
  barcode: string | null;
  oemNumbers: string[];
  nameUz: string;
  nameRu: string;
  nameEn: string;
  descriptionEn: string;
  categoryId: string;
  category: { id: string; nameUz: string; nameRu: string; nameEn: string };
  brandId: string;
  brand: { id: string; name: string };
  price: string | null;
  imageUrl: string | null;
  stock: number;
  minStock: number;
  unit: string;
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
  totals: {
    quantity: number;
    reservedQuantity: number;
    availableQuantity: number;
  };
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
  warehouseId: string | null;
  status: OrderStatus;
  subtotal: string;
  discount: string;
  deliveryFee: string;
  totalAmount: string;
  paymentStatus: OrderPaymentStatus;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
}

/** Matches InventoryService's own `INCLUDE.product.select` — `nameEn` only, same as `OrderItem.product`. */
export interface InventoryProduct {
  id: string;
  sku: string;
  nameEn: string;
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

export type ReturnReason =
  "WRONG_PRODUCT" | "DEFECTIVE" | "CHANGED_MIND" | "DAMAGED" | "OTHER";
export type ReturnCondition = "GOOD" | "DAMAGED" | "USED" | "DEFECTIVE";
export type ReturnStatus = "COMPLETED" | "CANCELLED";
export type CashierShiftStatus = "OPEN" | "CLOSED";
export type ReturnRefundMethod = PaymentMethod | "PAYME" | "CLICK" | "PAYNET";

export interface ReturnOrderRef {
  id: string;
  orderNumber: string;
  sellerId: string;
  customerId: string;
  customer: { id: string; name: string; phone: string };
}

export interface ReturnSeller {
  id: string;
  name: string;
}

/** Mirrors ReturnsService's `RETURN_INCLUDE.items.include.product.select` — id/sku/nameEn only, same narrowing as OrderItem.product. */
export interface ReturnItemProduct {
  id: string;
  sku: string;
  nameEn: string;
}

export interface ReturnItem {
  id: string;
  returnId: string;
  productId: string;
  product: ReturnItemProduct;
  qty: number;
  unitPrice: string;
  lineTotal: string;
  reason: ReturnReason;
  condition: ReturnCondition;
}

export interface Return {
  id: string;
  returnNumber: string;
  orderId: string;
  order: ReturnOrderRef;
  sellerId: string;
  seller: ReturnSeller;
  refundMethod: ReturnRefundMethod;
  refundAmount: string;
  status: ReturnStatus;
  items: ReturnItem[];
  createdAt: string;
}

export interface ReturnsQuery extends PaginationParams {
  orderId?: string;
  status?: ReturnStatus;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

export interface CreateReturnItemInput {
  productId: string;
  qty: number;
  reason: ReturnReason;
  condition: ReturnCondition;
}

/** Refund overrides cannot exceed the selected items' total. */
export interface CreateReturnInput {
  orderId: string;
  refundMethod: ReturnRefundMethod | "ORIGINAL";
  refundAmount?: number;
  items: CreateReturnItemInput[];
}

/** Mirrors the `CashierShift` row. Decimal columns are `null` until the shift is closed, except on the live `current` response — see `CurrentCashierShift`. */
export interface CashierShift {
  id: string;
  sellerId: string;
  warehouseId: string | null;
  status: CashierShiftStatus;
  openingBalance: string;
  closingBalanceActual: string | null;
  expectedBalance: string | null;
  difference: string | null;
  comment: string | null;
  openedAt: string;
  closedAt: string | null;
}

/**
 * `GET /seller/cashier/shift/current` computes `expectedBalance` live (never
 * null here, unlike the stored column) and adds `cashSales`/`cashRefunds`,
 * the two terms that make it up — see CashierService.current.
 */
export interface CurrentCashierShift extends CashierShift {
  expectedBalance: string;
  cashSales: string;
  cashRefunds: string;
}

export interface OpenShiftInput {
  openingBalance: number;
  warehouseId?: string;
}

export interface CloseShiftInput {
  closingBalanceActual: number;
  comment?: string;
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
