import { Badge } from "@/components/ui/badge";
import type { Product } from "@/lib/types";
import type { Dictionary } from "@/lib/i18n/dictionaries";

const STOCK_VARIANT: Record<Product["stockStatus"], "success" | "warning" | "danger"> = {
  available: "success",
  limited: "warning",
  out_of_stock: "danger",
};

export function StockBadge({
  status,
  stock,
}: {
  status: Product["stockStatus"];
  stock: Dictionary["common"]["stock"];
}) {
  const label = status === "out_of_stock" ? stock.outOfStock : stock[status];
  return <Badge variant={STOCK_VARIANT[status]}>{label}</Badge>;
}
