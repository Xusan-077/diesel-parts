import { ClipboardList } from "lucide-react";
import { requireStaff } from "@/lib/auth/dal";
import { listOrders } from "@/lib/api/order-repository";
import { safeRead } from "@/lib/api/safe-read";
import { getPanelLocale } from "@/lib/i18n/panel-locale";
import type { OrderStatus } from "@/lib/api/backend-enums";
import type { OrderPage } from "@/lib/api/order-repository";
import { PageHeader } from "@/components/admin/page-header";
import { PanelCard } from "@/components/director/panel-card";
import { StatusTabs } from "@/components/director/status-tabs";
import { EmptyState } from "@/components/director/empty-state";
import { FilterBar, FilterField } from "@/components/director/filter-bar";
import {
  SellerOrdersPager,
  SellerOrdersTable,
} from "@/components/director/seller-orders-table";

const STATUSES: readonly OrderStatus[] = [
  "DRAFT",
  "PENDING",
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED",
];

function isOrderStatus(value: string): value is OrderStatus {
  return (STATUSES as readonly string[]).includes(value);
}

const EMPTY_PAGE: OrderPage = {
  items: [],
  total: 0,
  page: 1,
  pageSize: 20,
  totalPages: 1,
};

/**
 * The seller's order list — every order raised under their account, filtered by
 * status. A director opening it to support a seller sees the whole floor
 * instead (the scope is `backend/`'s, keyed off the caller's own token), so the
 * seller column only appears for them.
 *
 * Server-rendered and URL-driven, the same shape as `/director/warehouse`: the
 * status tabs and the pager are links, so a filtered list is a shareable
 * address and the back button works.
 */
export default async function SellerOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const user = await requireStaff();
  const params = await searchParams;
  const { locale, dict } = await getPanelLocale();

  const status =
    params.status && isOrderStatus(params.status) ? params.status : undefined;
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);

  const orders = await safeRead(
    "seller order list",
    () => listOrders(user, { status, page }),
    EMPTY_PAGE,
  );

  const hrefFor = (overrides: { status?: string; page?: number }) => {
    const next = new URLSearchParams();
    const nextStatus = overrides.status ?? status ?? "";
    if (nextStatus && nextStatus !== "all") next.set("status", nextStatus);
    const nextPage = overrides.page ?? page;
    if (nextPage > 1) next.set("page", String(nextPage));
    const query = next.toString();
    return "/admin/seller/orders" + (query ? "?" + query : "");
  };

  const tabs = [
    { value: "all", label: "Barchasi", href: hrefFor({ status: "all", page: 1 }) },
    ...STATUSES.map((value) => ({
      value,
      label: dict.status[value],
      href: hrefFor({ status: value, page: 1 }),
    })),
  ];

  const dateFormat = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const rows = orders.data.items.map((order) => ({
    id: order.id,
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    sellerName: order.sellerName,
    itemCount: order.itemCount,
    total: order.totalAmount,
    date: dateFormat.format(order.createdAt),
    status: order.status,
    statusLabel: dict.status[order.status],
  }));

  return (
    <div>
      <PageHeader
        eyebrow="Sotuvchi paneli"
        title="Buyurtmalar"
        description="Sizga biriktirilgan buyurtmalar, holati bo'yicha."
      />

      <div className="mt-8">
        <FilterBar>
          <FilterField label="Holat bo'yicha filtr">
            <StatusTabs value={status ?? "all"} options={tabs} />
          </FilterField>
        </FilterBar>
      </div>

      <div className="mt-4">
        <PanelCard
          title="Buyurtmalar"
          meta={orders.data.total > 0 ? String(orders.data.total) : undefined}
        >
          {rows.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              message="Bu holatda buyurtma topilmadi."
            />
          ) : (
            <>
              {/* A SELLER only ever sees their own orders here, so their name on
                  every row says nothing; anyone above them sees the whole floor
                  and needs it. */}
              <SellerOrdersTable rows={rows} showSeller={user.role !== "SELLER"} />
              <SellerOrdersPager
                page={orders.data.page}
                totalPages={orders.data.totalPages}
                hrefFor={(next) => hrefFor({ page: next })}
              />
            </>
          )}
        </PanelCard>
      </div>
    </div>
  );
}
