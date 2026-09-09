"use client";

import { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { adminKeys } from "@/lib/api/admin/keys";
import { fetchWarehouseProducts } from "@/lib/api/admin/warehouse";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { formatInteger } from "@/lib/analytics/format";
import type { WarehouseProductRow } from "@/lib/api/warehouse-repository";
import { Spinner } from "@/components/ui/spinner";

/**
 * Finds a catalog part and adds it as a receipt line.
 *
 * A search box rather than a per-row combobox: a receipt is built by finding
 * parts one after another, and a picker that lives above the table — with the
 * part's current on-hand and cost visible before it is added — reads as
 * "adding to the list" instead of "editing a cell". Already-added parts are
 * dimmed and cannot be added twice.
 */
export function ProductSearchAdd({
  chosenIds,
  onPick,
}: {
  chosenIds: ReadonlySet<string>;
  onPick: (product: WarehouseProductRow) => void;
}) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const debounced = useDebouncedValue(term.trim(), 350);

  const results = useQuery({
    queryKey: adminKeys.warehouse.products.list({ q: debounced, page: 1 }),
    queryFn: () => fetchWarehouseProducts({ q: debounced, page: 1 }),
    enabled: open && debounced.length >= 2,
    staleTime: 60_000,
  });

  const rows = results.data?.items ?? [];

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-dashed border-border px-3 text-sm text-muted transition-colors hover:border-solid hover:text-foreground"
        >
          <Plus className="size-4" aria-hidden="true" />
          Mahsulot qo&apos;shish
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className="z-100 w-[28rem] overflow-hidden rounded-md border border-border bg-surface shadow-lg"
        >
          <div className="flex items-center gap-2 border-b border-border px-3">
            <Search className="size-4 text-muted" aria-hidden="true" />
            <input
              autoFocus
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder="Nom, SKU yoki OEM raqami"
              aria-label="Mahsulot qidirish"
              className="h-10 w-full bg-transparent text-sm text-foreground placeholder:text-muted focus:outline-none"
            />
            {results.isFetching ? <Spinner /> : null}
          </div>

          <ul className="max-h-72 overflow-y-auto p-1">
            {debounced.length < 2 ? (
              <li className="px-3 py-6 text-center text-sm text-muted">
                Qidirish uchun kamida 2 ta belgi kiriting
              </li>
            ) : results.isPending ? (
              <li className="px-3 py-6 text-center text-sm text-muted">Qidirilmoqda…</li>
            ) : rows.length === 0 ? (
              <li className="px-3 py-6 text-center text-sm text-muted">Hech narsa topilmadi</li>
            ) : (
              rows.map((product) => {
                const added = chosenIds.has(product.id);
                return (
                  <li key={product.id}>
                    <button
                      type="button"
                      disabled={added}
                      onClick={() => {
                        onPick(product);
                        setOpen(false);
                        setTerm("");
                      }}
                      className="flex w-full items-center gap-3 rounded-sm px-3 py-2 text-left text-sm transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-foreground">{product.name}</span>
                        <span className="block truncate font-mono text-xs text-muted">
                          {product.sku}
                          {product.oemNumbers[0] ? ` · ${product.oemNumbers[0]}` : ""}
                        </span>
                      </span>
                      <span className="shrink-0 text-right font-mono text-xs text-muted">
                        {formatInteger(product.onHand)} {product.unit}
                        {added ? <span className="block text-accent-strong">qo&apos;shilgan</span> : null}
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
