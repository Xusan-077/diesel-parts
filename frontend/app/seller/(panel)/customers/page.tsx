"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { useCustomers } from "@/hooks/seller/queries/use-customers";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { CustomerTable } from "@/components/seller/customer-table";
import { Input } from "@/components/seller/ui/input";

export default function SellerCustomersPage() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [page, setPage] = useState(1);

  const query = { page, limit: 20, search: debouncedSearch || undefined };
  const { data, isLoading, isError, error, refetch } = useCustomers(query);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-foreground">Mijozlar</h1>

      <div className="relative w-full max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Ism yoki telefon bo'yicha qidirish"
          className="pl-9"
        />
      </div>

      <CustomerTable
        customers={data?.data}
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
