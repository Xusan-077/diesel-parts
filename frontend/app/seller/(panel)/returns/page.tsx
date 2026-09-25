"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { useReturns } from "@/hooks/seller/queries/use-returns";
import { ReturnsTable } from "@/components/seller/returns-table";
import { PageHeader } from "@/components/seller/page-header";
import { FilterBar, FilterField } from "@/components/seller/filter-bar";
import { Input } from "@/components/seller/ui/input";
import { Select } from "@/components/seller/ui/select";
import { Button } from "@/components/seller/ui/button";
import { Calendar } from "@/components/ui/shadcn/calendar";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/shadcn/popover";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { RETURN_STATUS_LABEL } from "@/lib/seller/return-labels";
import type { ReturnStatus } from "@/lib/api/seller-panel/types";
import { dateRangeQuery } from "@/lib/seller/return-dates";

export default function SellerReturnsPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ReturnStatus | "ALL">("ALL");
  const [range, setRange] = useState<DateRange>();
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search, 300);
  const { data, isLoading, isFetching, isError, error, refetch } = useReturns({
    page,
    limit: 20,
    search: debouncedSearch || undefined,
    status: status === "ALL" ? undefined : status,
    ...dateRangeQuery(range),
  });
  return (
    <div>
      <PageHeader
        title="Qaytarishlar"
        description="Sotuvlar bo‘yicha qaytarishlar tarixi."
        actions={
          <Button onClick={() => router.push("/seller/returns/new")}>
            <Plus className="size-4" />
            Yangi qaytarish
          </Button>
        }
      />
      <div className="mt-8 space-y-4">
        <FilterBar>
          <FilterField label="Qidirish">
            <Input
              aria-label="Sotuv yoki mijoz qidirish"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Sotuv ID yoki mijoz..."
              className="w-full sm:w-56"
            />
          </FilterField>
          <FilterField label="Holat">
            <Select
              aria-label="Holat"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as ReturnStatus | "ALL");
                setPage(1);
              }}
              options={[
                { value: "ALL", label: "Barchasi" },
                ...Object.entries(RETURN_STATUS_LABEL).map(
                  ([value, label]) => ({ value, label }),
                ),
              ]}
            />
          </FilterField>
          <FilterField label="Sana oralig‘i">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="secondary">
                  {range?.from
                    ? range.from.toLocaleDateString("uz-UZ") +
                      (range.to
                        ? " — " + range.to.toLocaleDateString("uz-UZ")
                        : " — ...")
                    : "Sanani tanlash"}
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                className="w-auto p-0 bg-surface text-foreground"
              >
                <Calendar
                  mode="range"
                  selected={range}
                  onSelect={(value) => {
                    setRange(value);
                    setPage(1);
                  }}
                />
                <Button
                  variant="ghost"
                  className="m-2"
                  onClick={() => {
                    setRange(undefined);
                    setPage(1);
                  }}
                >
                  Tozalash
                </Button>
              </PopoverContent>
            </Popover>
          </FilterField>
        </FilterBar>
        <div aria-busy={isFetching}>
          <ReturnsTable
            returns={data?.data}
            meta={data?.meta}
            isLoading={isLoading}
            isError={isError}
            error={error}
            onRetry={() => void refetch()}
            onPageChange={setPage}
          />
        </div>
      </div>
    </div>
  );
}
