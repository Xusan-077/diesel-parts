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
  className,
}: {
  status: Product["stockStatus"];
  stock: Dictionary["common"]["stock"];
  /** Lets a caller place the badge — the catalog card corners it on the picture. */
  className?: string;
}) {
  const label = status === "out_of_stock" ? stock.outOfStock : stock[status];
  return (
    <Badge variant={STOCK_VARIANT[status]} className={className}>
      {label}
    </Badge>
  );
}
