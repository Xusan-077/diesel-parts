"use client";

import { useState } from "react";
import { Search, ScanLine, PackageX } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/seller/ui/input";
import { Button } from "@/components/seller/ui/button";
import { Badge } from "@/components/seller/ui/badge";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useProducts } from "@/hooks/seller/queries/use-products";
import { fetchProductByBarcode } from "@/lib/api/seller-panel/products";
import { SellerApiError } from "@/lib/api/seller-panel/client";
import { formatMoney } from "@/lib/seller/format";
import { STOCK_STATUS_LABEL, STOCK_STATUS_TONE } from "@/lib/seller/stock-status-labels";
import type { SellerProduct } from "@/lib/api/seller-panel/types";

/**
 * One input serves both a typed catalog search (debounced, name/SKU/OEM) and
 * a USB barcode scanner: a scanner types the code fast and ends with Enter,
 * so Enter tries an exact barcode match first and only falls back to the
 * regular search results already on screen. No hidden input / separate
 * scanner dialog — this keeps the POS to one focused control.
 */
export function ProductSearchPanel({ onAdd }: { onAdd: (product: SellerProduct) => void }) {
  const [raw, setRaw] = useState("");
  const [scanning, setScanning] = useState(false);
  const search = useDebouncedValue(raw, 300);

  const { data, isLoading, isError, error } = useProducts({
    search: search || undefined,
    limit: 20,
  });

  async function handleEnter() {
    const code = raw.trim();
    if (!code) return;
    setScanning(true);
    try {
      const product = await fetchProductByBarcode(code);
      onAdd(product);
      setRaw("");
      toast.success(`${product.nameEn} qo'shildi`);
    } catch (err) {
      // Not a barcode match — the typed text may still be a valid name/SKU
      // search, whose results are already showing below; say nothing louder
      // than that unless it was an unexpected failure.
      if (!(err instanceof SellerApiError && err.status === 404)) {
        toast.error(err instanceof SellerApiError ? err.message : "Qidiruvda xatolik");
      }
    } finally {
      setScanning(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <Input
          autoFocus
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void handleEnter();
            }
          }}
          placeholder="Nomi, SKU yoki shtrix-kod bo'yicha qidirish..."
          className="pl-9 pr-9"
        />
        <ScanLine
          className={`pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 ${scanning ? "text-accent" : "text-muted"}`}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-border">
        {isError ? (
          <div className="p-4 text-sm text-danger">
            {error instanceof SellerApiError ? error.message : "Mahsulotlarni yuklab bo'lmadi"}
          </div>
        ) : isLoading ? (
          <div className="space-y-2 p-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-md bg-surface-muted" />
            ))}
          </div>
        ) : !data || data.data.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-8 text-center text-muted">
            <PackageX className="h-8 w-8" />
            <p className="text-sm">Mahsulot topilmadi</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {data.data.map((product) => {
              const outOfStock = product.availableQuantity <= 0;
              return (
                <li key={product.id} className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{product.nameEn}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-muted">{product.sku}</span>
                      <Badge tone={STOCK_STATUS_TONE[product.stockStatus]}>
                        {STOCK_STATUS_LABEL[product.stockStatus]} · {product.availableQuantity}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="font-mono text-sm text-foreground">
                      {formatMoney(product.price ?? 0)}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={outOfStock}
                      onClick={() => onAdd(product)}
                    >
                      Qo&apos;shish
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
