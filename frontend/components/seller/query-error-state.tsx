"use client";

import { AlertTriangle, ShieldOff } from "lucide-react";
import { Button } from "@/components/seller/ui/button";
import { SellerApiError } from "@/lib/api/seller-panel/client";

/**
 * The shared real-error-state for every list/detail view: a 403 from a
 * seller-restricted endpoint (e.g. a VIEWER-role account) reads as "Access
 * restricted", anything else gets a retry button. Never crashes the page.
 */
export function QueryErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  if (error instanceof SellerApiError && error.status === 403) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-md border border-border bg-surface px-6 py-12 text-center">
        <ShieldOff className="h-8 w-8 text-muted" />
        <div>
          <p className="text-sm font-medium text-foreground">Kirish cheklangan</p>
          <p className="mt-1 text-xs text-muted">{error.message}</p>
        </div>
      </div>
    );
  }

  const message = error instanceof SellerApiError ? error.message : "Ma'lumotlarni yuklab bo'lmadi";

  return (
    <div className="flex flex-col items-center gap-3 rounded-md border border-border bg-surface px-6 py-12 text-center">
      <AlertTriangle className="h-8 w-8 text-danger" />
      <div>
        <p className="text-sm font-medium text-foreground">Xatolik yuz berdi</p>
        <p className="mt-1 text-xs text-muted">{message}</p>
      </div>
      {onRetry ? (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Qayta urinish
        </Button>
      ) : null}
    </div>
  );
}
