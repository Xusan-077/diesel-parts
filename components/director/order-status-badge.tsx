import { Badge } from "@/components/ui/shadcn/badge";
import type { OrderStatus } from "@/lib/api/backend-enums";

/**
 * Which badge tone an order status wears, director-panel wide.
 *
 * Kept to the project's own two-colour status pair (success/warning) plus
 * destructive for CANCELLED, rather than a distinct hue per status: the
 * dashboard's existing STATUS_TONE map (app/director/(panel)/page.tsx) made
 * the same call deliberately — colouring every status spends the palette on
 * "this order is proceeding normally". CONFIRMED and DRAFT stay neutral for
 * that reason.
 */
const TONE: Record<OrderStatus, "secondary" | "warning" | "default" | "success" | "destructive"> = {
  DRAFT: "secondary",
  PENDING: "warning",
  CONFIRMED: "default",
  COMPLETED: "success",
  CANCELLED: "destructive",
};

export function OrderStatusBadge({ status, label }: { status: OrderStatus; label: string }) {
  return <Badge variant={TONE[status]}>{label}</Badge>;
}
