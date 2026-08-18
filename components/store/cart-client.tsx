"use client";

import Link from "next/link";
import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { StockBadge } from "@/components/product/stock-badge";
import { StoreEmpty } from "@/components/store/store-empty";
import { useCart } from "@/hooks/use-store";
import { formatPrice, sumPrices } from "@/lib/format-price";
import { MAX_QUANTITY } from "@/lib/store/cart";
import { useResolvedProducts } from "@/hooks/use-resolved-products";
import { ResolvedProductsSkeleton } from "@/components/store/resolved-products-skeleton";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import { Icon } from "@/components/ui/icon";

interface CartClientProps {
  lang: Locale;
  dict: Dictionary["cart"];
  stock: Dictionary["common"]["stock"];
}

export function CartClient({ lang, dict, stock }: CartClientProps) {
  const cart = useCart();

  const { items: resolved, isLoading } = useResolvedProducts(
    cart.items.map((item) => item.productId),
    lang,
  );
  const byId = new Map(resolved.map((entry) => [entry.product.id, entry]));

  const lines = cart.items
    .map((item) => {
      const entry = byId.get(item.productId);
      return entry ? { ...entry, quantity: item.quantity } : null;
    })
    .filter((line): line is NonNullable<typeof line> => line !== null);

  const { total, unpriced } = sumPrices(
    lines.map((line) => ({ price: line.product.price, quantity: line.quantity }))
  );
  const totalLabel = formatPrice(total, lang);

  if (isLoading) {
    return <ResolvedProductsSkeleton count={cart.items.length} />;
  }

  if (lines.length === 0) {
    return (
      <StoreEmpty
        icon={ShoppingCart}
        message={dict.empty}
        ctaHref={`/${lang}/products`}
        ctaLabel={dict.emptyCta}
      />
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_20rem] lg:items-start">
      <div>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={cart.clear}
            className="text-sm text-muted transition-colors hover:text-accent-strong"
          >
            {dict.clear}
          </button>
        </div>

        <ul className="mt-4 flex flex-col gap-4">
          {lines.map(({ product, brandName, categoryName, quantity }) => (
            <li
              key={product.id}
              className="flex flex-col gap-4 rounded-lg border border-border bg-surface-muted p-4 sm:flex-row sm:items-center"
            >
              <div className="flex h-20 w-full shrink-0 items-center justify-center rounded-md bg-linear-to-br from-surface-hover to-transparent text-xs text-muted sm:w-28">
                {product.imageLabels[0]}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted">{brandName}</span>
                  <StockBadge status={product.stockStatus} stock={stock} />
                </div>
                <Link
                  href={`/${lang}/products/${product.slug}`}
                  className="mt-1 block text-sm font-medium text-foreground transition-colors hover:text-accent-strong"
                >
                  {product.name[lang]}
                </Link>
                <p className="mt-1 text-xs text-muted">
                  {categoryName} · {product.sku}
                </p>
                <p className="mt-1 text-sm font-medium text-foreground">
                  {formatPrice(product.price, lang) ?? dict.priceOnRequest}
                  {product.price !== null && quantity > 1 ? (
                    <span className="ml-2 text-xs font-normal text-muted">
                      × {quantity} = {formatPrice(product.price * quantity, lang)}
                    </span>
                  ) : null}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div
                  className="flex items-center rounded-md border border-border"
                  role="group"
                  aria-label={dict.quantity}
                >
                  <button
                    type="button"
                    onClick={() => cart.setQuantity(product.id, quantity - 1)}
                    aria-label={dict.decrease}
                    className="flex h-9 w-9 items-center justify-center text-muted transition-colors hover:text-accent-strong"
                  >
                    <Icon icon={Minus} />
                  </button>
                  <span className="w-10 text-center text-sm tabular-nums text-foreground">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => cart.setQuantity(product.id, quantity + 1)}
                    disabled={quantity >= MAX_QUANTITY}
                    aria-label={dict.increase}
                    className="flex h-9 w-9 items-center justify-center text-muted transition-colors hover:text-accent-strong disabled:opacity-40"
                  >
                    <Icon icon={Plus} />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => cart.remove(product.id)}
                  aria-label={dict.remove}
                  title={dict.remove}
                  className="flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted transition-colors hover:border-accent/60 hover:text-accent-strong"
                >
                  <Icon icon={Trash2} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <aside className="rounded-lg border border-border bg-surface-muted p-6 lg:sticky lg:top-40">
        <h2 className="text-base font-semibold text-foreground">{dict.summaryTitle}</h2>

        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">{dict.summaryLines}</dt>
            <dd className="tabular-nums text-foreground">{cart.lineCount}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">{dict.summaryUnits}</dt>
            <dd className="tabular-nums text-foreground">{cart.unitCount}</dd>
          </div>
          <div className="flex justify-between border-t border-border pt-3">
            <dt className="text-muted">{dict.summaryPrice}</dt>
            <dd className="font-medium text-foreground">
              {total > 0 ? totalLabel : dict.priceOnRequest}
            </dd>
          </div>
        </dl>

        {unpriced > 0 ? (
          <p className="mt-3 text-xs leading-relaxed text-accent-strong">
            {dict.unpricedNote.replace("{count}", String(unpriced))}
          </p>
        ) : null}

        <p className="mt-3 text-xs leading-relaxed text-muted">{dict.priceNote}</p>

        <Link
          href={`/${lang}/request-quote`}
          className="mt-6 flex h-11 items-center justify-center rounded-md bg-accent text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/90"
        >
          {dict.checkout}
        </Link>
      </aside>
    </div>
  );
}
