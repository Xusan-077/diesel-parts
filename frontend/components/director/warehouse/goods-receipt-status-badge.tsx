import { Badge } from "@/components/ui/shadcn/badge";
import type { GoodsReceiptStatus } from "@/lib/api/warehouse-repository";

/**
 * A goods receipt's lifecycle: DRAFT is editable and has moved no stock,
 * APPROVED has moved it (green, done), CANCELLED is a draft that was dropped
 * (grey, not an error — nothing happened).
 */
const CONFIG: Record<
  GoodsReceiptStatus,
  { label: string; variant: "warning" | "success" | "secondary" }
> = {
  DRAFT: { label: "Qoralama", variant: "warning" },
  APPROVED: { label: "Tasdiqlangan", variant: "success" },
  CANCELLED: { label: "Bekor qilingan", variant: "secondary" },
};

export function GoodsReceiptStatusBadge({ status }: { status: GoodsReceiptStatus }) {
  const config = CONFIG[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
