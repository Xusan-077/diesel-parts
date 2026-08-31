"use client";

import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/seller/ui/button";
import { useUpdateOrderStatus } from "@/hooks/seller/mutations/use-update-order-status";
import { useCancelOrder } from "@/hooks/seller/mutations/use-cancel-order";
import { ORDER_STATUS_LABEL } from "@/lib/seller/order-status-labels";
import {
  ORDER_STATUS_SEQUENCE,
  ORDER_STATUS_TRANSITIONS,
  canTransitionOrderStatus,
  type Order,
  type OrderStatus,
} from "@/lib/api/seller-panel/types";

/** Stepper for NEW -> CONFIRMED -> PREPARING -> COMPLETED; only the next legal step (per backend's ALLOWED_TRANSITIONS) is clickable, and Cancel disables itself once the order is no longer cancellable. */
export function OrderStatusStepper({ order }: { order: Order }) {
  const updateStatus = useUpdateOrderStatus();
  const cancelOrder = useCancelOrder();

  if (order.status === "CANCELLED") {
    return (
      <div className="flex items-center gap-2 rounded-md border border-danger bg-danger-surface px-4 py-3 text-sm text-danger">
        <X className="h-4 w-4" />
        Bu buyurtma bekor qilingan
      </div>
    );
  }

  const currentIndex = ORDER_STATUS_SEQUENCE.indexOf(order.status);
  const nextStatus = ORDER_STATUS_TRANSITIONS[order.status].find((s) => s !== "CANCELLED");
  const canCancel = canTransitionOrderStatus(order.status, "CANCELLED");
  const pending = updateStatus.isPending || cancelOrder.isPending;

  return (
    <div className="flex flex-col gap-4">
      <ol className="flex items-center gap-1">
        {ORDER_STATUS_SEQUENCE.map((step, index) => {
          const reached = index <= currentIndex;
          const isLast = index === ORDER_STATUS_SEQUENCE.length - 1;
          return (
            <li key={step} className="flex flex-1 items-center gap-1">
              <div className="flex flex-col items-center gap-1.5">
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-medium",
                    reached
                      ? "border-accent bg-accent text-accent-foreground"
                      : "border-border bg-surface-muted text-muted"
                  )}
                >
                  {reached ? <Check className="h-3.5 w-3.5" /> : index + 1}
                </span>
                <span className={cn("seller-eyebrow whitespace-nowrap", reached && "text-foreground")}>
                  {ORDER_STATUS_LABEL[step]}
                </span>
              </div>
              {isLast ? null : (
                <div className={cn("mb-4 h-px flex-1", index < currentIndex ? "bg-accent" : "bg-border")} />
              )}
            </li>
          );
        })}
      </ol>

      <div className="flex flex-wrap gap-2">
        {nextStatus ? (
          <Button
            size="sm"
            loading={updateStatus.isPending}
            disabled={pending}
            onClick={() => updateStatus.mutate({ id: order.id, status: nextStatus as OrderStatus })}
          >
            {ORDER_STATUS_LABEL[nextStatus]}ga o&apos;tkazish
          </Button>
        ) : null}
        {canCancel ? (
          <Button
            variant="danger"
            size="sm"
            loading={cancelOrder.isPending}
            disabled={pending}
            onClick={() => cancelOrder.mutate({ id: order.id })}
          >
            Bekor qilish
          </Button>
        ) : null}
      </div>
    </div>
  );
}
