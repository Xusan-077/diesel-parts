import "server-only";
import { prisma } from "@/lib/db";
import { dayKey, fillDays, percentChange, type DayPoint, type Period } from "@/lib/analytics/period";

/**
 * The deep analytics screen's queries.
 *
 * Kept apart from `analytics-repository.ts`, which serves the dashboard. That
 * file answers "how are we doing" in seven small reads that a landing screen
 * can afford; this one answers "why", and its reads are wider — a per-day
 * breakdown of three measures, a movement ranking across every order line in
 * the window. Mixing them would mean the dashboard silently paying for the
 * analytics screen's cost on every login.
 *
 * The same booking rule applies in both: money is real when an order COMPLETES.
 *
 * ── What is not here, and what it would take ──────────────────────────────
 * Four sections the brief asked for have no data behind them today. They are
 * listed at the bottom of this file rather than half-built, because a margin
 * column computed from a purchase price nobody has entered is worse than an
 * absent one — it is a number a director would act on.
 */

const REVENUE_STATUSES = ["COMPLETED"] as const;

/* ── Sales: three measures, per day, against the previous window ─────────── */

/** Which line the chart is drawing. Profit is absent — see the note below. */
export type SalesMetric = "revenue" | "orders" | "average";

export interface MetricSeries {
  current: DayPoint[];
  /** Re-indexed onto the current window's day slots so the x-axes line up. */
  previous: DayPoint[];
  currentTotal: number;
  previousTotal: number;
  change: number | null;
}

export type SalesSeries = Record<SalesMetric, MetricSeries>;

/**
 * All three measures in one pass over the window's orders.
 *
 * One read rather than three: the rows needed to total revenue are the same
 * rows needed to count orders, and the average is arithmetic on the other two.
 * Querying per metric would triple the database work to produce numbers that
 * are already derivable, and would let the three drift apart if a status filter
 * were ever changed in one place and not the others.
 */
export async function getSalesSeries(period: Period): Promise<SalesSeries> {
  const [currentRows, previousRows] = await Promise.all([
    prisma.order.findMany({
      where: { status: { in: [...REVENUE_STATUSES] }, createdAt: { gte: period.from, lt: period.to } },
      select: { createdAt: true, totalAmount: true },
    }),
    prisma.order.findMany({
      where: {
        status: { in: [...REVENUE_STATUSES] },
        createdAt: { gte: period.previousFrom, lt: period.previousTo },
      },
      select: { createdAt: true, totalAmount: true },
    }),
  ]);

  function bucket(rows: { createdAt: Date; totalAmount: unknown }[]) {
    const revenue = new Map<string, number>();
    const orders = new Map<string, number>();

    for (const row of rows) {
      const key = dayKey(row.createdAt);
      revenue.set(key, (revenue.get(key) ?? 0) + Number(row.totalAmount));
      orders.set(key, (orders.get(key) ?? 0) + 1);
    }

    return { revenue, orders };
  }

  const currentBuckets = bucket(currentRows);
  const previousBuckets = bucket(previousRows);

  const currentRevenue = fillDays(period.from, period.days, currentBuckets.revenue);
  const currentOrders = fillDays(period.from, period.days, currentBuckets.orders);
  const previousRevenue = fillDays(period.previousFrom, period.days, previousBuckets.revenue);
  const previousOrders = fillDays(period.previousFrom, period.days, previousBuckets.orders);

  /** Relabels a comparison series onto the current window's dates. */
  const align = (points: DayPoint[]) =>
    points.map((point, index) => ({
      day: currentRevenue[index]?.day ?? point.day,
      value: point.value,
    }));

  /*
   * A day with no orders has an average of zero, not an undefined one. That is
   * the honest reading for a chart: the alternative — skipping the point —
   * draws a line straight over the quiet day and implies trade on it.
   */
  const averageOf = (revenue: DayPoint[], orders: DayPoint[]) =>
    revenue.map((point, index) => {
      const count = orders[index]?.value ?? 0;
      return { day: point.day, value: count === 0 ? 0 : point.value / count };
    });

  const sum = (points: DayPoint[]) => points.reduce((total, point) => total + point.value, 0);

  function series(current: DayPoint[], previous: DayPoint[]): MetricSeries {
    const currentTotal = sum(current);
    const previousTotal = sum(previous);
    return {
      current,
      previous: align(previous),
      currentTotal,
      previousTotal,
      change: percentChange(currentTotal, previousTotal),
    };
  }

  const revenue = series(currentRevenue, previousRevenue);
  const orders = series(currentOrders, previousOrders);

  /*
   * The average is a ratio of the two totals, not the sum of the daily
   * averages. Summing them would weight a day with one order the same as a day
   * with forty, so a single small sale on a quiet Sunday could halve the
   * period's reported ticket.
   */
  const currentAverage = orders.currentTotal === 0 ? 0 : revenue.currentTotal / orders.currentTotal;
  const previousAverage =
    orders.previousTotal === 0 ? 0 : revenue.previousTotal / orders.previousTotal;

  return {
    revenue,
    orders,
    average: {
      current: averageOf(currentRevenue, currentOrders),
      previous: align(averageOf(previousRevenue, previousOrders)),
      currentTotal: currentAverage,
      previousTotal: previousAverage,
      change: percentChange(currentAverage, previousAverage),
    },
  };
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
  /** Retail value of everything on the shelf, at the price the catalogue shows. */
  totalValue: number;
  activeProducts: number;
  /** At or under `minStock`, but not yet zero. */
  lowStock: StockRow[];
  outOfStock: StockRow[];
  /** Parts with no price set, which are therefore absent from `totalValue`. */
  unpricedProducts: number;
}

/**
 * What is on the shelf right now.
 *
 * A snapshot, and only a snapshot: there is no inventory *trend* on this screen
 * because nothing in the schema records what stock was last week. See the note
 * at the bottom of this file.
 *
 * The value is priced at the catalogue price rather than at cost, because cost
 * is not recorded either. That makes it a retail valuation, and the screen says
 * so — labelling a retail figure "ombor qiymati" without qualification is how a
 * director ends up quoting it as an asset value.
 */
export async function getInventorySummary(): Promise<InventorySummary> {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    select: {
      id: true,
      sku: true,
      nameUz: true,
      stock: true,
      minStock: true,
      price: true,
      category: { select: { nameUz: true } },
    },
  });

  const rows: StockRow[] = products.map((product) => {
    const price = product.price === null ? null : Number(product.price);
    return {
      id: product.id,
      sku: product.sku,
      name: product.nameUz,
      categoryName: product.category.nameUz,
      stock: product.stock,
      minStock: product.minStock,
      price,
      value: price === null ? 0 : price * product.stock,
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
  /** Units sold across completed orders in the window. */
  unitsSold: number;
  revenue: number;
  stock: number;
  /**
   * How many periods of cover the remaining stock represents at this rate.
   * Null when nothing sold — dividing by zero would rank a dead part as
   * infinitely well stocked, which is true and useless.
   */
  coverPeriods: number | null;
}

export interface ProductMovement {
  fastMoving: MovementRow[];
  /** Active, in stock, and sold nothing at all in the window. */
  deadStock: MovementRow[];
}

/**
 * What sold and what sat, over the window.
 *
 * Ranked by units rather than by revenue: this is a stocking question, and a
 * cheap filter that leaves the shelf forty times a month is the thing to
 * reorder even though a single turbocharger outsells it in money. The revenue
 * column is still there, because the two answers together are what tells a
 * director whether a fast mover is worth its shelf space.
 */
export async function getProductMovement(
  period: Period,
  limit: number = 10,
): Promise<ProductMovement> {
  const [sold, products] = await Promise.all([
    prisma.orderItem.groupBy({
      by: ["productId"],
      where: {
        order: {
          status: { in: [...REVENUE_STATUSES] },
          createdAt: { gte: period.from, lt: period.to },
        },
      },
      _sum: { qty: true },
    }),
    prisma.product.findMany({
      where: { isActive: true },
      select: { id: true, sku: true, nameUz: true, stock: true, price: true },
    }),
  ]);

  /*
   * Revenue per product is computed from the line's own `unitPrice`, not from
   * the product's current price: an order line is a snapshot taken when the
   * sale happened, and repricing history to today's catalogue would rewrite
   * last month's revenue every time someone edits a part.
   */
  const lines = await prisma.orderItem.findMany({
    where: {
      order: {
        status: { in: [...REVENUE_STATUSES] },
        createdAt: { gte: period.from, lt: period.to },
      },
    },
    select: { productId: true, qty: true, unitPrice: true },
  });

  const revenueByProduct = new Map<string, number>();
  for (const line of lines) {
    const current = revenueByProduct.get(line.productId) ?? 0;
    revenueByProduct.set(line.productId, current + Number(line.unitPrice) * line.qty);
  }

  const unitsByProduct = new Map(
    sold.map((row) => [row.productId, row._sum.qty ?? 0] as const),
  );

  const rows: MovementRow[] = products.map((product) => {
    const unitsSold = unitsByProduct.get(product.id) ?? 0;
    return {
      id: product.id,
      sku: product.sku,
      name: product.nameUz,
      unitsSold,
      revenue: revenueByProduct.get(product.id) ?? 0,
      stock: product.stock,
      coverPeriods: unitsSold === 0 ? null : product.stock / unitsSold,
    };
  });

  return {
    fastMoving: rows
      .filter((row) => row.unitsSold > 0)
      .sort((a, b) => b.unitsSold - a.unitsSold || b.revenue - a.revenue)
      .slice(0, limit),
    /*
     * Dead stock is "in stock and did not move", not merely "did not move". A
     * part with nothing on the shelf sold nothing because there was nothing to
     * sell, and listing it here would send a director to rebalance a shelf that
     * is already empty.
     */
    deadStock: rows
      .filter((row) => row.unitsSold === 0 && row.stock > 0)
      .sort((a, b) => b.stock - a.stock)
      .slice(0, limit),
  };
}

/* ── Seller performance ──────────────────────────────────────────────────── */

export interface SellerScorecard {
  sellerId: string;
  name: string;
  revenue: number;
  completedOrders: number;
  cancelledOrders: number;
  /** Every order raised in the window, whatever became of it. */
  totalOrders: number;
  averageOrderValue: number;
  /** Share of this seller's orders that were cancelled, 0–100. */
  cancelledRate: number;
  /** Inquiries they were assigned in the window. */
  inquiries: number;
  /**
   * Share of those inquiries that became an order, 0–100. Counted through
   * `Order.inquiryId`, which is set when an order is raised from a board card,
   * so this is a measured figure rather than an estimated one.
   */
  conversionRate: number;
}

export async function getSellerScorecards(period: Period): Promise<SellerScorecard[]> {
  const window = { gte: period.from, lt: period.to };

  const [orders, sellers, inquiries, converted] = await Promise.all([
    prisma.order.groupBy({
      by: ["sellerId", "status"],
      where: { createdAt: window },
      _sum: { totalAmount: true },
      _count: { _all: true },
    }),
    prisma.user.findMany({
      where: { role: "SELLER" },
      select: { id: true, name: true, isActive: true },
    }),
    prisma.inquiry.groupBy({
      by: ["assignedSellerId"],
      where: { createdAt: window, assignedSellerId: { not: null } },
      _count: { _all: true },
    }),
    prisma.order.findMany({
      where: { createdAt: window, inquiryId: { not: null } },
      select: { sellerId: true, inquiryId: true },
    }),
  ]);

  const inquiryCount = new Map(
    inquiries.map((row) => [row.assignedSellerId ?? "", row._count._all] as const),
  );

  /*
   * One inquiry can only be converted once, even if several orders were raised
   * against it. Counting rows would let a seller who split one enquiry into
   * three orders report a conversion rate above 100%.
   */
  const convertedBySeller = new Map<string, Set<string>>();
  for (const order of converted) {
    if (order.inquiryId === null) {
      continue;
    }
    const set = convertedBySeller.get(order.sellerId) ?? new Set<string>();
    set.add(order.inquiryId);
    convertedBySeller.set(order.sellerId, set);
  }

  return sellers
    .map((seller) => {
      const rows = orders.filter((row) => row.sellerId === seller.id);

      const countOf = (status: string) =>
        rows.find((row) => row.status === status)?._count._all ?? 0;

      const revenue = rows
        .filter((row) => (REVENUE_STATUSES as readonly string[]).includes(row.status))
        .reduce((total, row) => total + Number(row._sum.totalAmount ?? 0), 0);

      const completedOrders = countOf("COMPLETED");
      const cancelledOrders = countOf("CANCELLED");
      const totalOrders = rows.reduce((total, row) => total + row._count._all, 0);
      const assigned = inquiryCount.get(seller.id) ?? 0;
      const won = convertedBySeller.get(seller.id)?.size ?? 0;

      return {
        sellerId: seller.id,
        name: seller.name,
        revenue,
        completedOrders,
        cancelledOrders,
        totalOrders,
        averageOrderValue: completedOrders === 0 ? 0 : revenue / completedOrders,
        cancelledRate: totalOrders === 0 ? 0 : (cancelledOrders / totalOrders) * 100,
        inquiries: assigned,
        conversionRate: assigned === 0 ? 0 : (won / assigned) * 100,
      };
    })
    /*
     * Sellers with no activity in the window are dropped rather than listed as
     * a row of zeros. A scorecard is a comparison, and a table where half the
     * rows are structurally empty makes the comparison harder, not fairer — the
     * staff page is where the full roster lives.
     */
    .filter((row) => row.totalOrders > 0 || row.inquiries > 0)
    .sort((a, b) => b.revenue - a.revenue);
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
  /** Customers whose first-ever order falls inside the window. */
  newCustomers: number;
  /** Customers who ordered in the window and had ordered before it. */
  returningCustomers: number;
  topCustomers: TopCustomer[];
}

/**
 * New against returning, and who spends the most.
 *
 * "New" is defined by first order rather than by `Customer.createdAt`, which is
 * when the record was typed in. A seller entering their whole address book on a
 * Monday would otherwise show forty new customers and no sales, and the ratio
 * would describe the seller's data entry rather than the business.
 */
export async function getCustomerAnalytics(
  period: Period,
  limit: number = 10,
): Promise<CustomerAnalytics> {
  const inWindow = await prisma.order.findMany({
    where: {
      status: { in: [...REVENUE_STATUSES] },
      createdAt: { gte: period.from, lt: period.to },
    },
    select: {
      customerId: true,
      totalAmount: true,
      customer: { select: { id: true, name: true, company: true } },
    },
  });

  const customerIds = [...new Set(inWindow.map((order) => order.customerId))];

  // One grouped read to find who had already bought before this window opened.
  const earlier = await prisma.order.groupBy({
    by: ["customerId"],
    where: {
      status: { in: [...REVENUE_STATUSES] },
      createdAt: { lt: period.from },
      customerId: { in: customerIds },
    },
    _count: { _all: true },
  });

  const hadOrderedBefore = new Set(earlier.map((row) => row.customerId));

  const totals = new Map<string, TopCustomer>();
  for (const order of inWindow) {
    const existing = totals.get(order.customerId) ?? {
      id: order.customer.id,
      name: order.customer.name,
      company: order.customer.company,
      orders: 0,
      revenue: 0,
    };

    existing.orders += 1;
    existing.revenue += Number(order.totalAmount);
    totals.set(order.customerId, existing);
  }

  return {
    newCustomers: customerIds.filter((id) => !hadOrderedBefore.has(id)).length,
    returningCustomers: customerIds.filter((id) => hadOrderedBefore.has(id)).length,
    topCustomers: [...totals.values()]
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit),
  };
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
 * 4. INVENTORY VALUE TREND (value over time)
 *    Needs: a periodic snapshot — `InventorySnapshot { takenAt, totalValue,
 *    lowStockCount, outOfStockCount }`, written by a scheduled job. `Product`
 *    holds only the current stock level, so history cannot be reconstructed
 *    after the fact; the series has to start being recorded before it can be
 *    drawn. The same table is what would answer "how many days has this part
 *    been below its minimum", which the brief also asks for.
 * ────────────────────────────────────────────────────────────────────────── */
