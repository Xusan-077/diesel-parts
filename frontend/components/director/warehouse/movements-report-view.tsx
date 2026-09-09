"use client";

import { useRouter } from "next/navigation";
import { useMovementsReport, useWarehouses } from "@/hooks/admin/use-warehouse";
import { requestErrorMessage } from "@/lib/api/request-error";
import type { MovementsReportQuery } from "@/lib/schemas";
import type { MovementPage } from "@/lib/api/warehouse-repository";
import { FilterBar, FilterField } from "@/components/director/filter-bar";
import { Button } from "@/components/ui/shadcn/button";
import { Input } from "@/components/ui/shadcn/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/shadcn/select";
import { MovementsTable } from "./movements-table";

const TYPE_OPTIONS = [
  { value: "all", label: "Barcha turlar" },
  { value: "PURCHASE", label: "Qabul" },
  { value: "OUT", label: "Chiqim" },
  { value: "RESERVE", label: "Zaxiraga olindi" },
  { value: "RELEASE", label: "Zaxiradan chiqdi" },
  { value: "INVENTORY_ADJUSTMENT", label: "Tuzatish" },
] as const;

export function MovementsReportView({
  query,
  initialData,
}: {
  query: MovementsReportQuery;
  initialData?: MovementPage;
}) {
  const router = useRouter();
  const warehouses = useWarehouses();
  const report = useMovementsReport(query, initialData);

  function navigate(next: Partial<Record<"warehouseId" | "type" | "dateFrom" | "dateTo" | "page", string>>) {
    const params = new URLSearchParams();
    const merged = {
      warehouseId: next.warehouseId ?? query.warehouseId ?? "",
      type: next.type ?? query.type ?? "",
      dateFrom: next.dateFrom ?? query.dateFrom ?? "",
      dateTo: next.dateTo ?? query.dateTo ?? "",
      page: next.page ?? "",
    };
    if (merged.warehouseId) params.set("warehouseId", merged.warehouseId);
    if (merged.type && merged.type !== "all") params.set("type", merged.type);
    if (merged.dateFrom) params.set("dateFrom", merged.dateFrom);
    if (merged.dateTo) params.set("dateTo", merged.dateTo);
    if (merged.page && merged.page !== "1") params.set("page", merged.page);
    const search = params.toString();
    router.replace("/director/warehouse/reports/movements" + (search ? "?" + search : ""));
  }

  const rows = report.data?.items ?? [];
  const meta = report.data?.meta;

  return (
    <div>
      <FilterBar>
        <FilterField label="Ombor">
          <Select
            value={query.warehouseId ?? "all"}
            onValueChange={(value) => navigate({ warehouseId: value === "all" ? "" : value })}
          >
            <SelectTrigger className="h-9 w-48" aria-label="Ombor bo'yicha filtr">
              <SelectValue placeholder="Barcha omborlar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Barcha omborlar</SelectItem>
              {(warehouses.data ?? []).map((warehouse) => (
                <SelectItem key={warehouse.id} value={warehouse.id}>
                  {warehouse.code} · {warehouse.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>

        <FilterField label="Turi">
          <Select
            value={query.type ?? "all"}
            onValueChange={(value) => navigate({ type: value })}
          >
            <SelectTrigger className="h-9 w-44" aria-label="Tur bo'yicha filtr">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TYPE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>

        <FilterField label="Sanadan">
          <Input
            type="date"
            value={query.dateFrom ?? ""}
            onChange={(event) => navigate({ dateFrom: event.target.value })}
            className="h-9 w-40"
          />
        </FilterField>

        <FilterField label="Sanagacha">
          <Input
            type="date"
            value={query.dateTo ?? ""}
            onChange={(event) => navigate({ dateTo: event.target.value })}
            className="h-9 w-40"
          />
        </FilterField>
      </FilterBar>

      <div className="panel mt-4 overflow-x-auto">
        {report.isPending ? (
          <div aria-busy="true" className="flex flex-col gap-2">
            <span className="sr-only">Yuklanmoqda…</span>
            {Array.from({ length: 8 }, (_, index) => (
              <div key={index} aria-hidden="true" className="h-10 animate-pulse rounded-md bg-surface-muted" />
            ))}
          </div>
        ) : report.isError ? (
          <div className="py-6 text-center">
            <p className="type-body text-muted">
              {requestErrorMessage(report.error, "Hisobot yuklanmadi.")}
            </p>
            <Button type="button" variant="outline" size="sm" className="mt-4" onClick={() => void report.refetch()}>
              Qayta urinish
            </Button>
          </div>
        ) : (
          <MovementsTable rows={rows} stickyHeader />
        )}
      </div>

      {meta && meta.totalPages > 1 ? (
        <nav aria-label="Sahifalar" className="mt-4 flex items-center gap-3 text-sm">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={meta.page <= 1 || report.isFetching}
            onClick={() => navigate({ page: String(meta.page - 1) })}
          >
            ← Oldingi
          </Button>
          <span className="font-mono text-xs text-muted">
            {meta.page} / {meta.totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={meta.page >= meta.totalPages || report.isFetching}
            onClick={() => navigate({ page: String(meta.page + 1) })}
          >
            Keyingi →
          </Button>
        </nav>
      ) : null}
    </div>
  );
}
