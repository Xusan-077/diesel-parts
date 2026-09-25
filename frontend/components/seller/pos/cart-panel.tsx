"use client";

import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/seller/ui/button";
import { Input } from "@/components/seller/ui/input";
import { formatMoney } from "@/lib/seller/format";
import { cartSubtotal, type CartLine } from "./cart-types";

export function CartPanel({
  lines,
  discount,
  onDiscountChange,
  onUpdateQty,
  onRemove,
  onCheckout,
  checkoutDisabled,
}: {
  lines: CartLine[];
  discount: number;
  onDiscountChange: (value: number) => void;
  onUpdateQty: (productId: string, qty: number) => void;
  onRemove: (productId: string) => void;
  onCheckout: () => void;
  checkoutDisabled: boolean;
}) {
  const subtotal = cartSubtotal(lines);
  const total = Math.max(0, subtotal - discount);

  function changeQty(line: CartLine, delta: number) {
    const next = line.qty + delta;
    if (next < 1) return;
    if (next > line.availableQuantity) {
      toast.error(`${line.nameEn} — omborda ${line.availableQuantity} dona qoldi`);
      return;
    }
    onUpdateQty(line.productId, next);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-border">
        {lines.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-8 text-center text-muted">
            <ShoppingCart className="h-8 w-8" />
            <p className="text-sm">Savatcha bo&apos;sh — mahsulot qidiring va qo&apos;shing</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {lines.map((line) => (
              <li key={line.productId} className="flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{line.nameEn}</p>
                  <p className="font-mono text-xs text-muted">
                    {line.sku} · {formatMoney(line.unitPrice ?? 0)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button type="button" size="sm" variant="secondary" onClick={() => changeQty(line, -1)}>
                    <Minus className="h-3.5 w-3.5" />
                  </Button>
                  <span className="w-8 text-center font-mono text-sm">{line.qty}</span>
                  <Button type="button" size="sm" variant="secondary" onClick={() => changeQty(line, 1)}>
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <span className="w-24 shrink-0 text-right font-mono text-sm text-foreground">
                  {formatMoney((line.unitPrice ?? 0) * line.qty)}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  aria-label="O'chirish"
                  onClick={() => onRemove(line.productId)}
                >
                  <Trash2 className="h-4 w-4 text-danger" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-3 border-t border-border pt-4">
        <label className="flex items-center justify-between gap-3 text-sm">
          <span className="text-muted">Chegirma (so&apos;m)</span>
          <Input
            type="number"
            min={0}
            value={discount || ""}
            onChange={(e) => onDiscountChange(Math.max(0, Number(e.target.value) || 0))}
            className="w-32 text-right"
          />
        </label>
        <div className="flex justify-between text-sm text-muted">
          <span>Oraliq summa</span>
          <span className="font-mono">{formatMoney(subtotal)}</span>
        </div>
        <div className="flex justify-between border-t border-border pt-2 text-base font-semibold text-foreground">
          <span>Jami</span>
          <span className="font-mono">{formatMoney(total)}</span>
        </div>

        <Button type="button" size="md" disabled={checkoutDisabled} onClick={onCheckout} className="mt-1">
          Sotuvni yakunlash
        </Button>
      </div>
    </div>
  );
}
