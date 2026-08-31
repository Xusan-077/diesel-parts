import "server-only";
import { backendRequest } from "./backend-client";
import { getStaffSession } from "@/lib/auth/staff-session";
import type { DayPoint, Period } from "@/lib/analytics/period";

/**
 * The deep analytics screen's queries.
 *
 * Kept apart from `analytics-repository.ts`, which serves the dashboard — the
 * same split this file had over Prisma, preserved now that both call
 * `backend/`'s new `/analytics/*` endpoints (Task 23) instead.
 *
 * The same booking rule applies in both: money is real when an order COMPLETES.
 *
 * ── What is not here, and what it would take ──────────────────────────────
 * Four sections the brief asked for have no data behind them today. They are
 * listed at the bottom of this file rather than half-built, because a margin
 * column computed from a purchase price nobody has entered is worse than an
 * absent one — it is a number a director would act on.
 */

async function accessToken(): Promise<string | undefined> {
  const session = await getStaffSession();
  return session?.accessToken;
}

function periodQuery(period: Period) {
  return {
    from: period.from.toISOString(),
    to: period.to.toISOString(),
    previousFrom: period.previousFrom.toISOString(),
    previousTo: period.previousTo.toISOString(),
    days: period.days,
  };
}

/* ── Sales: three measures, per day, against the previous window ─────────── */

export type SalesMetric = "revenue" | "orders" | "average";

export interface MetricSeries {
  current: DayPoint[];
  previous: DayPoint[];
  currentTotal: number;
  previousTotal: number;
  change: number | null;
}

export type SalesSeries = Record<SalesMetric, MetricSeries>;

export async function getSalesSeries(period: Period): Promise<SalesSeries> {
  return backendRequest<SalesSeries>("/analytics/sales-series", {
    accessToken: await accessToken(),
    query: periodQuery(period),
  });
}

/* ── Inventory ───────────────────────────────────────────────────────────── */

export interface StockRow {
  id: string;
  sku: string;
  name: string;
  categoryName: string;
  stock: number;
  minStock: number;
  price: number | null;
  /** `stock * price`, or 0 for a part quoted on request. */
  value: number;
}

export interface InventorySummary {
  totalValue: number;
  activeProducts: number;
  lowStock: StockRow[];
  outOfStock: StockRow[];
  unpricedProducts: number;
}

interface BackendInventoryRow {
  id: string;
  sku: string;
  nameUz: string;
  availableQuantity: number;
  minStock: number;
  price: string | null;
  category: { nameUz: string };
}

/**
 * What is on the shelf right now — read from backend/'s existing admin
 * product list (Task 15's `/products`) rather than a dedicated analytics
 * endpoint, the same "one bounded read of a small catalog" the price-bounds/
 * stock-overview rewires already settled on. Priced at the catalogue price,
 * not at cost (cost is not recorded either) — a retail valuation, as the
 * screen itself says.
 */
export async function getInventorySummary(): Promise<InventorySummary> {
  const result = await backendRequest<{ data: BackendInventoryRow[] }>("/products", {
    accessToken: await accessToken(),
    query: { isActive: "true", limit: 100 },
  });

  const rows: StockRow[] = result.data.map((row) => {
    const price = row.price === null ? null : Number(row.price);
    return {
      id: row.id,
      sku: row.sku,
      name: row.nameUz,
      categoryName: row.category.nameUz,
      stock: row.availableQuantity,
      minStock: row.minStock,
      price,
      value: price === null ? 0 : price * row.availableQuantity,
    };
  });

  const byUrgency = (a: StockRow, b: StockRow) => a.stock - b.stock || b.value - a.value;

  return {
    totalValue: rows.reduce((total, row) => total + row.value, 0),
    activeProducts: rows.length,
    lowStock: rows.filter((row) => row.stock > 0 && row.stock <= row.minStock).sort(byUrgency),
    outOfStock: rows.filter((row) => row.stock === 0).sort(byUrgency),
    unpricedProducts: rows.filter((row) => row.price === null).length,
  };
}

export interface MovementRow {
  id: string;
  sku: string;
  name: string;
  unitsSold: number;
  revenue: number;
  stock: number;
  coverPeriods: number | null;
}

export interface ProductMovement {
  fastMoving: MovementRow[];
  deadStock: MovementRow[];
}

export async function getProductMovement(
  period: Period,
  limit: number = 10,
): Promise<ProductMovement> {
  return backendRequest<ProductMovement>("/analytics/product-movement", {
    accessToken: await accessToken(),
    query: { ...periodQuery(period), limit },
  });
}

/* ── Seller performance ──────────────────────────────────────────────────── */

export interface SellerScorecard {
  sellerId: string;
  name: string;
  revenue: number;
  completedOrders: number;
  cancelledOrders: number;
  totalOrders: number;
  averageOrderValue: number;
  cancelledRate: number;
  inquiries: number;
  conversionRate: number;
}

export async function getSellerScorecards(period: Period): Promise<SellerScorecard[]> {
  return backendRequest<SellerScorecard[]>("/analytics/seller-scorecards", {
    accessToken: await accessToken(),
    query: periodQuery(period),
  });
}

/* ── Customers ───────────────────────────────────────────────────────────── */

export interface TopCustomer {
  id: string;
  name: string;
  company: string | null;
  orders: number;
  revenue: number;
}

export interface CustomerAnalytics {
  newCustomers: number;
  returningCustomers: number;
  topCustomers: TopCustomer[];
}

export async function getCustomerAnalytics(
  period: Period,
  limit: number = 10,
): Promise<CustomerAnalytics> {
  return backendRequest<CustomerAnalytics>("/analytics/customer-analytics", {
    accessToken: await accessToken(),
    query: { ...periodQuery(period), limit },
  });
}

/* ──────────────────────────────────────────────────────────────────────────
 * NOT BUILT — and what each one needs before it can be
 *
 * These four were asked for and are absent on purpose. Every one of them needs
 * a schema change, not a query: the data is not thin, it does not exist.
 *
 * 1. PRODUCT PROFITABILITY (purchase price → margin %)
 *    Needs: `Product.purchasePrice Decimal? @db.Decimal(14, 2)`, and ideally
 *    `OrderItem.unitCost` snapshotted at sale time for the same reason
 *    `unitPrice` already is — otherwise margin on a historical order silently
 *    changes whenever someone updates the current cost.
 *
 * 2. SUPPLIER ANALYTICS (purchase history, price trend per supplier)
 *    Needs: a `Supplier` model, `Product.supplierId`, and a
 *    `SupplierPrice { supplierId, productId, price, validFrom }` history table.
 *    The per-month price trend the brief describes is that table read over
 *    time; without it there is one current price and no trend to draw.
 *
 * 3. CUSTOMER DEBT TREND
 *    Needs: a payments ledger — `Payment { orderId, amount, paidAt, method }`.
 *    Debt is `order total − payments received`, and today the schema records no
 *    payment at all, so every completed order is implicitly settled in full.
 *
 *    Note (Task 23): `backend/`'s schema does have a `Payment` model, unlike
 *    root's own — but it is not wired to a debt-trend read anywhere, and
 *    building one was not part of this task's scope. Flagged here rather than
 *    acted on, so a future task starts from an accurate premise instead of
 *    rediscovering this.
 *
 * 4. INVENTORY VALUE TREND (value over time)
 *    Needs: a periodic snapshot — `InventorySnapshot { takenAt, totalValue,
 *    lowStockCount, outOfStockCount }`, written by a scheduled job. `Product`
 *    holds only the current stock level, so history cannot be reconstructed
 *    after the fact; the series has to start being recorded before it can be
 *    drawn. The same table is what would answer "how many days has this part
 *    been below its minimum", which the brief also asks for.
 * ────────────────────────────────────────────────────────────────────────── */
