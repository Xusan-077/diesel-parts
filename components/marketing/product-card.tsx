import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { Product } from "@/lib/types";
import type { Locale } from "@/lib/i18n/locales";
import type { Dictionary } from "@/lib/i18n/dictionaries";

const STOCK_VARIANT: Record<Product["stockStatus"], "success" | "warning" | "danger"> = {
  available: "success",
  limited: "warning",
  out_of_stock: "danger",
};

function stockKey(status: Product["stockStatus"]): keyof Dictionary["common"]["stock"] {
  return status === "out_of_stock" ? "outOfStock" : status;
}

interface ProductCardProps {
  product: Product;
  lang: Locale;
  categoryName: string;
  brandName: string;
  stock: Dictionary["common"]["stock"];
  requestPriceLabel: string;
}

export function ProductCard({
  product,
  lang,
  categoryName,
  brandName,
  stock,
  requestPriceLabel,
}: ProductCardProps) {
  return (
    <Link
      href={`/${lang}/products/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-lg border border-border bg-white/2 transition-colors hover:border-accent/60"
    >
      <div className="flex aspect-4/3 items-center justify-center bg-linear-to-br from-white/6 to-transparent text-sm text-muted">
        {product.imageLabels[0]}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-center justify-between text-xs text-muted">
          <span>{brandName}</span>
          <Badge variant={STOCK_VARIANT[product.stockStatus]}>{stock[stockKey(product.stockStatus)]}</Badge>
        </div>
        <h3 className="text-sm font-medium text-foreground group-hover:text-accent">
          {product.name[lang]}
        </h3>
        <p className="text-xs text-muted">{categoryName}</p>
        <p className="mt-auto text-sm font-medium text-accent">{requestPriceLabel}</p>
      </div>
    </Link>
  );
}
