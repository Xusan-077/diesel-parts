import { Badge } from "@/components/ui/shadcn/badge";
import type { StockStatus } from "@/lib/types";

/** The exact three states `deriveStockStatus()` (lib/api/stock-status.ts) produces. */
const TONE: Record<StockStatus, "success" | "warning" | "destructive"> = {
  available: "success",
  limited: "warning",
  out_of_stock: "destructive",
};

const LABEL: Record<StockStatus, string> = {
  available: "Mavjud",
  limited: "Kam qoldi",
  out_of_stock: "Tugagan",
};

export function StockStatusBadge({ status }: { status: StockStatus }) {
  return <Badge variant={TONE[status]}>{LABEL[status]}</Badge>;
}
