"use client";
import Link from "next/link";
import { PageHeader } from "@/components/seller/page-header";
import { QueryErrorState } from "@/components/seller/query-error-state";
import { Skeleton } from "@/components/ui/shadcn/skeleton";
import { CloseShiftForm } from "@/components/seller/cashier/close-shift-form";
import { useCurrentShift } from "@/hooks/seller/queries/use-current-shift";

export default function CloseShiftPage() {
  const query = useCurrentShift();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Smenani yopish"
        description="Naqd pulni sanang va haqiqiy qoldiqni kiriting."
      />
      {query.isError ? (
        <QueryErrorState
          error={query.error}
          onRetry={() => void query.refetch()}
        />
      ) : query.isLoading ? (
        <Skeleton className="h-80 bg-surface-muted" />
      ) : query.data ? (
        <CloseShiftForm key={query.data.id} shift={query.data} />
      ) : (
        <p>
          Ochiq smena yo‘q.{" "}
          <Link href="/seller/cashier" className="text-accent-strong underline">
            Kassaga qaytish
          </Link>
        </p>
      )}
    </div>
  );
}
