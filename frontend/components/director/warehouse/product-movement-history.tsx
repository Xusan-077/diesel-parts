"use client";

import { useState } from "react";
import { useProductMovements } from "@/hooks/admin/use-warehouse";
import { requestErrorMessage } from "@/lib/api/request-error";
import type { MovementPage } from "@/lib/api/warehouse-repository";
import { Button } from "@/components/ui/shadcn/button";
import { MovementsTable } from "./movements-table";

/**
 * One product's stock ledger on its detail page.
 *
 * The page number is local state, not the URL: it is a sub-section of a
 * product page, not the thing the page is about, and a director paging
 * through history is not sharing "page 4 of this part's movements". Seeded
 * from the server's first page so the history is there on first paint.
 */
export function ProductMovementHistory({
  productId,
  initialData,
}: {
  productId: string;
  initialData?: MovementPage;
}) {
  const [page, setPage] = useState(1);
  const query = { page } as const;
  const history = useProductMovements(productId, query, page === 1 ? initialData : undefined);

  if (history.isError) {
    return (
      <div className="py-6 text-center">
        <p className="type-body text-muted">
          {requestErrorMessage(history.error, "Harakatlar yuklanmadi.")}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => void history.refetch()}
        >
          Qayta urinish
        </Button>
      </div>
    );
  }

  const rows = history.data?.items ?? [];
  const meta = history.data?.meta;

  return (
    <div>
      <div className="overflow-x-auto">
        {history.isPending ? (
          <div aria-busy="true" className="flex flex-col gap-2">
            <span className="sr-only">Yuklanmoqda…</span>
            {Array.from({ length: 5 }, (_, index) => (
              <div key={index} aria-hidden="true" className="h-10 animate-pulse rounded-md bg-surface-muted" />
            ))}
          </div>
        ) : (
          <MovementsTable rows={rows} showProduct={false} />
        )}
      </div>

      {meta && meta.totalPages > 1 ? (
        <nav aria-label="Sahifalar" className="mt-4 flex items-center gap-3 text-sm">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page <= 1 || history.isFetching}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
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
            disabled={page >= meta.totalPages || history.isFetching}
            onClick={() => setPage((current) => current + 1)}
          >
            Keyingi →
          </Button>
        </nav>
      ) : null}
    </div>
  );
}
