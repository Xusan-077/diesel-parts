"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { useProducts } from "@/hooks/seller/queries/use-products";
import { useCategories, useBrands } from "@/hooks/seller/queries/use-catalog";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { ProductTable } from "@/components/seller/product-table";
import { Input } from "@/components/seller/ui/input";
import { Select } from "@/components/seller/ui/select";
import type { StockStatus } from "@/lib/api/seller-panel/types";

const STOCK_OPTIONS: { value: StockStatus; label: string }[] = [
  { value: "IN_STOCK", label: "Mavjud" },
  { value: "LOW_STOCK", label: "Kam qoldi" },
  { value: "OUT_OF_STOCK", label: "Tugagan" },
];

export default function SellerProductsPage() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [categoryId, setCategoryId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [stockStatus, setStockStatus] = useState<StockStatus | "">("");
  const [page, setPage] = useState(1);

  const categories = useCategories();
  const brands = useBrands();

  const query = {
    page,
    limit: 20,
    search: debouncedSearch || undefined,
    categoryId: categoryId || undefined,
    brandId: brandId || undefined,
    stockStatus: stockStatus || undefined,
  };
  const { data, isLoading, isError, error, refetch } = useProducts(query);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-foreground">Mahsulotlar</h1>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="SKU yoki nomi bo'yicha qidirish"
            className="pl-9"
          />
        </div>
        <Select
          className="w-auto min-w-40"
          placeholder="Barcha kategoriyalar"
          value={categoryId}
          onChange={(e) => {
            setCategoryId(e.target.value);
            setPage(1);
          }}
          options={(categories.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
        />
        <Select
          className="w-auto min-w-36"
          placeholder="Barcha brendlar"
          value={brandId}
          onChange={(e) => {
            setBrandId(e.target.value);
            setPage(1);
          }}
          options={(brands.data ?? []).map((b) => ({ value: b.id, label: b.name }))}
        />
        <Select
          className="w-auto min-w-36"
          placeholder="Barcha holatlar"
          value={stockStatus}
          onChange={(e) => {
            setStockStatus(e.target.value as StockStatus | "");
            setPage(1);
          }}
          options={STOCK_OPTIONS}
        />
      </div>

      <ProductTable
        products={data?.data}
        meta={data?.meta}
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={() => refetch()}
        onPageChange={setPage}
      />
    </div>
  );
}
