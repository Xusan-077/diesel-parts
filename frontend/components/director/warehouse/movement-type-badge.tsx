import { Badge } from "@/components/ui/shadcn/badge";
import type { WarehouseMovementType } from "@/lib/api/warehouse-repository";

/**
 * The stock ledger's vocabulary, in Uzbek and coloured by direction.
 *
 * Stock coming in reads success, stock leaving reads danger, a reservation or
 * its release is neutral movement (`info` / `secondary`), and an adjustment is
 * a warning — someone changed a count by hand. Phase 1 only ever writes
 * `PURCHASE`; the rest are labelled now so the ledger is readable the day
 * their endpoints land.
 */
const CONFIG: Record<
  WarehouseMovementType,
  { label: string; variant: "success" | "destructive" | "info" | "warning" | "secondary" }
> = {
  PURCHASE: { label: "Qabul", variant: "success" },
  IN: { label: "Kirim", variant: "success" },
  TRANSFER_IN: { label: "Ko'chirish (kirim)", variant: "success" },
  RELEASE: { label: "Zaxiradan chiqdi", variant: "info" },
  OUT: { label: "Chiqim", variant: "destructive" },
  WRITE_OFF: { label: "Hisobdan chiqarish", variant: "destructive" },
  TRANSFER_OUT: { label: "Ko'chirish (chiqim)", variant: "destructive" },
  RESERVE: { label: "Zaxiraga olindi", variant: "secondary" },
  INVENTORY_ADJUSTMENT: { label: "Tuzatish", variant: "warning" },
};

export function MovementTypeBadge({ type }: { type: WarehouseMovementType }) {
  const config = CONFIG[type] ?? { label: type, variant: "secondary" as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

/** `+12` / `−3` — a signed quantity coloured the same way as the badge. */
export function signedQuantity(type: WarehouseMovementType, quantity: number): {
  text: string;
  tone: "in" | "out";
} {
  const isOut =
    type === "OUT" || type === "WRITE_OFF" || type === "TRANSFER_OUT" || type === "RESERVE";
  const magnitude = Math.abs(quantity);
  return {
    text: (isOut ? "−" : "+") + magnitude,
    tone: isOut ? "out" : "in",
  };
}
