"use client";

import { useState } from "react";
import { useOrders } from "@/hooks/seller/queries/use-orders";
import { OrdersTable } from "@/components/seller/orders-table";
import { PageHeader } from "@/components/seller/page-header";
import { FilterBar, FilterField } from "@/components/seller/filter-bar";
import { Input } from "@/components/seller/ui/input";
import { cn } from "@/lib/utils";
import { ORDER_STATUS_LABEL } from "@/lib/seller/order-status-labels";
import type { OrderStatus } from "@/lib/api/seller-panel/types";

const STATUS_TABS: { value: OrderStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "Barchasi" },
  { value: "NEW", label: ORDER_STATUS_LABEL.NEW },
  { value: "CONFIRMED", label: ORDER_STATUS_LABEL.CONFIRMED },
  { value: "PREPARING", label: ORDER_STATUS_LABEL.PREPARING },
  { value: "COMPLETED", label: ORDER_STATUS_LABEL.COMPLETED },
  { value: "CANCELLED", label: ORDER_STATUS_LABEL.CANCELLED },
];

export default function SellerOrdersPage() {
  const [status, setStatus] = useState<OrderStatus | "ALL">("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  const query = {
    page,
    limit: 20,
    status: status === "ALL" ? undefined : status,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  };
  const { data, isLoading, isError, error, refetch } = useOrders(query);

  return (
    <div>
      <PageHeader
        title="Buyurtmalar"
        description="Sizga biriktirilgan buyurtmalar, holati bo'yicha."
      />

      <div className="mt-8 space-y-4">
        <FilterBar>
          <FilterField label="Holat bo'yicha">
            <div className="flex flex-wrap gap-1 rounded-md border border-border bg-surface p-1">
              {STATUS_TABS.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => {
                    setStatus(tab.value);
                    setPage(1);
                  }}
                  className={cn(
                    "rounded-sm px-3 py-1.5 text-xs font-medium transition-colors",
                    status === tab.value
                      ? "bg-accent text-accent-foreground"
                      : "text-muted hover:text-foreground",
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </FilterField>

          <FilterField label="Sana oralig'i">
            <div className="flex items-center gap-2">
              <Input
                type="date"
                aria-label="Sanadan"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setPage(1);
                }}
                className="w-auto"
              />
              <span className="text-xs text-muted">—</span>
              <Input
                type="date"
                aria-label="Sanagacha"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setPage(1);
                }}
                className="w-auto"
              />
            </div>
          </FilterField>
        </FilterBar>

        <OrdersTable
          orders={data?.data}
          meta={data?.meta}
          isLoading={isLoading}
          isError={isError}
          error={error}
          onRetry={() => refetch()}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}
