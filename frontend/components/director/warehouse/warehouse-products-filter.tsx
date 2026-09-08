"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useWarehouses } from "@/hooks/admin/use-warehouse";
import type { WarehouseProductListQuery } from "@/lib/schemas";
import { FilterBar, FilterField } from "@/components/director/filter-bar";
import { Input } from "@/components/ui/shadcn/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/shadcn/select";

/**
 * The warehouse products table's controls. Search, status and warehouse are
 * all URL state — a director who sends someone "low stock in W2" is sending
 * that exact listing — so every change navigates rather than setting local
 * state. The search box is the one exception worth a delay: it holds its own
 * value while typing and writes it to the URL 350ms after the last keystroke.
 */

const STATUS_OPTIONS = [
  { value: "all", label: "Barcha holatlar" },
  { value: "available", label: "Mavjud" },
  { value: "limited", label: "Kam qoldi" },
  { value: "out_of_stock", label: "Tugagan" },
] as const;

export function WarehouseProductsFilter({ query }: { query: WarehouseProductListQuery }) {
  const router = useRouter();
  const warehouses = useWarehouses();

  const [term, setTerm] = useState(query.q);
  const debounced = useDebouncedValue(term, 350);
  // Skip the first run: the debounced value starts equal to the URL, and
  // navigating to the page you are already on just to match it is noise.
  const lastPushed = useRef(query.q);

  function navigate(next: Partial<Record<"q" | "status" | "warehouseId" | "page", string>>) {
    const params = new URLSearchParams();
    const q = next.q ?? query.q;
    const status = next.status ?? query.status ?? "";
    const warehouseId = next.warehouseId ?? query.warehouseId ?? "";
    if (q) params.set("q", q);
    if (status && status !== "all") params.set("status", status);
    if (warehouseId) params.set("warehouseId", warehouseId);
    const search = params.toString();
    router.replace("/director/warehouse/products" + (search ? "?" + search : ""));
  }

  useEffect(() => {
    if (debounced === lastPushed.current) return;
    lastPushed.current = debounced;
    navigate({ q: debounced, page: "1" });
    // navigate is stable enough for this effect's purpose; re-running on query
    // identity would fire a redundant navigation after every URL change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  return (
    <FilterBar>
      <FilterField label="Nom, SKU, OEM yoki shtrix-kod">
        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted"
          />
          <Input
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            className="h-9 w-64 pl-8 font-mono"
            placeholder="DP-INJ-3126"
            aria-label="Qidiruv"
          />
        </div>
      </FilterField>

      <FilterField label="Holat">
        <Select
          value={query.status ?? "all"}
          onValueChange={(value) => navigate({ status: value, page: "1" })}
        >
          <SelectTrigger className="h-9 w-44" aria-label="Holat bo'yicha filtr">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterField>

      <FilterField label="Ombor">
        <Select
          value={query.warehouseId ?? "all"}
          onValueChange={(value) =>
            navigate({ warehouseId: value === "all" ? "" : value, page: "1" })
          }
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
    </FilterBar>
  );
}
