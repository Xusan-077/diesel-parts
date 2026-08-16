import Link from "next/link";
import { ProductActions } from "@/components/product/product-actions";
import { StockBadge } from "@/components/product/stock-badge";
import { formatPrice } from "@/lib/format-price";
import type { Product } from "@/lib/types";
import type { Locale } from "@/lib/i18n/locales";
import type { Dictionary } from "@/lib/i18n/dictionaries";

interface ProductCardProps {
  product: Product;
  lang: Locale;
  categoryName: string;
  brandName: string;
  stock: Dictionary["common"]["stock"];
  /** Shown in place of a price when the product has none yet. */
  requestPriceLabel: string;
  actions: Dictionary["productActions"];
  /** Optional corner label, e.g. "New" on the newest-products row. */
  ribbon?: string;
}

export function ProductCard({
  product,
  lang,
  categoryName,
  brandName,
  stock,
  requestPriceLabel,
  actions,
  ribbon,
}: ProductCardProps) {
  const price = formatPrice(product.price, lang);

  return (
    // The title link is stretched over the whole card, so the action buttons
    // have to sit above it rather than nested inside it.
    <article className="group relative flex flex-col overflow-hidden rounded-lg border border-border bg-surface-muted transition-colors hover:border-accent/60">
      <div className="relative flex aspect-4/3 items-center justify-center bg-linear-to-br from-surface-hover to-transparent text-sm text-muted">
        {ribbon ? (
          <span className="absolute left-3 top-3 rounded-full bg-accent px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-accent-foreground">
            {ribbon}
          </span>
        ) : null}
        {product.imageLabels[0]}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-center justify-between text-xs text-muted">
          <span>{brandName}</span>
          <StockBadge status={product.stockStatus} stock={stock} />
        </div>

        <h3 className="text-sm font-medium text-foreground">
          <Link
            href={`/${lang}/products/${product.slug}`}
            className="transition-colors after:absolute after:inset-0 group-hover:text-accent-strong"
          >
            {product.name[lang]}
          </Link>
        </h3>

        <p className="text-xs text-muted">{categoryName}</p>

        <div className="mt-auto flex items-end justify-between gap-2 pt-3">
          {price ? (
            <p className="text-base font-semibold text-foreground">{price}</p>
          ) : (
            <p className="text-sm font-medium text-accent-strong">{requestPriceLabel}</p>
          )}
          <ProductActions
            productId={product.id}
            price={product.price}
            lang={lang}
            dict={actions}
            className="relative z-10"
          />
        </div>
      </div>
    </article>
  );
}
