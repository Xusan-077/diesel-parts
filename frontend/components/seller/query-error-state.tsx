"use client";

import { AlertTriangle, ShieldOff } from "lucide-react";
import { Button } from "@/components/seller/ui/button";
import { SellerApiError } from "@/lib/api/seller-panel/client";
import { actionErrorMessage } from "@/lib/seller/action-errors";

/**
 * The shared real-error-state for every list/detail view: a 403 from a
 * seller-restricted endpoint (e.g. a VIEWER-role account) reads as "Access
 * restricted", anything else gets a retry button. Never crashes the page.
 */
export function QueryErrorState({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry?: () => void;
}) {
  if (error instanceof SellerApiError && error.status === 403) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-surface px-6 py-12 text-center">
        <span className="grid size-12 place-items-center rounded-full bg-surface-muted text-muted">
          <ShieldOff className="size-5" />
        </span>
        <div className="space-y-1">
          <p className="type-title text-foreground">Kirish cheklangan</p>
          <p className="type-body text-muted">
            Bu bo‘lim uchun ruxsatingiz yo‘q.
          </p>
        </div>
      </div>
    );
  }

  const message = actionErrorMessage(
    error,
    "Ma’lumotlarni yuklab bo‘lmadi. Qayta urinib ko‘ring.",
  );

  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-surface px-6 py-12 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-danger-surface text-danger">
        <AlertTriangle className="size-5" />
      </span>
      <div className="space-y-1">
        <p className="type-title text-foreground">Xatolik yuz berdi</p>
        <p className="type-body text-muted">{message}</p>
      </div>
      {onRetry ? (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Qayta urinish
        </Button>
      ) : null}
    </div>
  );
}
