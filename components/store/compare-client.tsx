"use client";

import Link from "next/link";
import { Scale, X } from "lucide-react";
import { StockBadge } from "@/components/product/stock-badge";
import { StoreEmpty } from "@/components/store/store-empty";
import { useCompare } from "@/hooks/use-store";
import { useResolvedProducts } from "@/hooks/use-resolved-products";
import { ResolvedProductsSkeleton } from "@/components/store/resolved-products-skeleton";
import { formatPrice } from "@/lib/format-price";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import { Icon } from "@/components/ui/icon";

interface CompareClientProps {
  lang: Locale;
  dict: Dictionary["compare"];
  stock: Dictionary["common"]["stock"];
}

export function CompareClient({ lang, dict, stock }: CompareClientProps) {
  const compare = useCompare();
  const { items, isLoading } = useResolvedProducts(compare.ids, lang);

  if (isLoading) {
    return <ResolvedProductsSkeleton count={compare.ids.length} />;
  }

  if (items.length === 0) {
    return (
      <StoreEmpty
        icon={Scale}
        message={dict.empty}
        ctaHref={`/${lang}/products`}
        ctaLabel={dict.emptyCta}
      />
    );
  }

  const rows: { label: string; render: (item: (typeof items)[number]) => React.ReactNode }[] = [
    { label: dict.rowBrand, render: (item) => item.brandName },
    { label: dict.rowCategory, render: (item) => item.categoryName },
    { label: dict.rowSku, render: (item) => item.product.sku },
    { label: dict.rowOem, render: (item) => item.product.oemNumbers.join(", ") },
    {
      label: dict.rowPrice,
      render: (item) => {
        const price = formatPrice(item.product.price, lang);
        return price ? (
          <span className="font-semibold">{price}</span>
        ) : (
          <span className="text-accent-strong">{dict.priceOnRequest}</span>
        );
      },
    },
    {
      label: dict.rowStock,
      render: (item) => <StockBadge status={item.product.stockStatus} stock={stock} />,
    },
    {
      label: dict.rowModels,
      render: (item) => (
        <span className="text-xs leading-relaxed">
          {item.product.compatibleModels.join(", ")}
        </span>
      ),
    },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-muted">
          {dict.limitNote.replace("{max}", String(compare.max))}
        </p>
        <button
          type="button"
          onClick={compare.clear}
          className="text-sm text-muted transition-colors hover:text-accent-strong"
        >
          {dict.clear}
        </button>
      </div>

      {/* Wide tables scroll inside their own container rather than the page. */}
      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-3xl border-collapse text-sm">
          <thead>
            <tr>
              <th className="w-40 border-b border-border p-3 text-left align-bottom" />
              {items.map(({ product }) => (
                <th
                  key={product.id}
                  className="min-w-56 border-b border-l border-border p-3 text-left align-bottom"
                >
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      href={`/${lang}/products/${product.slug}`}
                      className="text-sm font-medium text-foreground transition-colors hover:text-accent-strong"
                    >
                      {product.name[lang]}
                    </Link>
                    <button
                      type="button"
                      onClick={() => compare.remove(product.id)}
                      aria-label={dict.remove}
                      title={dict.remove}
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:text-accent-strong"
                    >
                      <Icon icon={X} />
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="align-top">
                <th
                  scope="row"
                  className="border-b border-border p-3 text-left font-medium text-muted"
                >
                  {row.label}
                </th>
                {items.map((item) => (
                  <td
                    key={item.product.id}
                    className="border-b border-l border-border p-3 text-foreground"
                  >
                    {row.render(item)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
