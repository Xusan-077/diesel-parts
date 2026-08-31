"use client";

import Link from "next/link";
import { toast } from "sonner";
import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { StockBadge } from "@/components/product/stock-badge";
import { StoreEmpty } from "@/components/store/store-empty";
import { useCart } from "@/hooks/use-store";
import { formatPrice, sumPrices } from "@/lib/format-price";
import { cartLineCount, cartUnitCount, MAX_QUANTITY } from "@/lib/store/cart";
import { useResolvedProducts } from "@/hooks/use-resolved-products";
import { usePruneMissing } from "@/hooks/use-prune-missing";
import { ResolvedProductsSkeleton } from "@/components/store/resolved-products-skeleton";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import { Icon } from "@/components/ui/icon";
import { ProductImage } from "@/components/product/product-image";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface CartClientProps {
  lang: Locale;
  dict: Dictionary["cart"];
  stock: Dictionary["common"]["stock"];
}

export function CartClient({ lang, dict, stock }: CartClientProps) {
  const cart = useCart();

  const ids = cart.items.map((item) => item.productId);
  const { items: resolved, isLoading, isSuccess } = useResolvedProducts(ids, lang);
  // A part the director retires stops resolving. Left alone it would keep
  // padding the header badge with a line this page cannot render or remove.
  usePruneMissing(ids, resolved, isSuccess, cart.remove);

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
  /*
   * Counted off the rendered lines rather than the store, so the summary can
   * never disagree with the list above it while a prune is still settling —
   * but counted by the same function the header badge uses, so the two can
   * never disagree about what counting means.
   */
  const unitCount = cartUnitCount(lines);
  const lineCount = cartLineCount(lines);
  const totalLabel = formatPrice(total, lang);

  if (isLoading) {
    return <ResolvedProductsSkeleton count={cart.items.length} />;
  }

  if (lines.length === 0) {
    return (
      <StoreEmpty
        icon={ShoppingCart}
        message={dict.empty}
        ctaHref="/products"
        ctaLabel={dict.emptyCta}
      />
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_20rem] lg:items-start">
      <div>
        <div className="flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              cart.clear();
              toast.success(dict.toastCleared);
            }}
          >
            {dict.clear}
          </Button>
        </div>

        <ul className="mt-4 flex flex-col gap-4">
          {lines.map(({ product, brandName, categoryName, quantity }) => (
            <li
              key={product.id}
              className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 sm:flex-row sm:items-center"
            >
              <ProductImage
                src={product.imageUrl}
                alt=""
                fallbackIconSize="lg"
                className="h-20 w-full shrink-0 rounded-md sm:w-28"
              />

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted">{brandName}</span>
                  <StockBadge status={product.stockStatus} stock={stock} />
                </div>
                <Link
                  href={`/products/${product.slug}`}
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
                  onClick={() => {
                    cart.remove(product.id);
                    toast.success(dict.toastRemoved);
                  }}
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

      <aside className="lg:sticky lg:top-40">
        <Card>
          <CardHeader>
            <CardTitle>{dict.summaryTitle}</CardTitle>
          </CardHeader>

          <CardContent>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">{dict.summaryLines}</dt>
                <dd className="tabular-nums text-foreground">{lineCount}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">{dict.summaryUnits}</dt>
                <dd className="tabular-nums text-foreground">{unitCount}</dd>
              </div>
              <Separator className="my-1" />
              <div className="flex justify-between">
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

            <Link href="/checkout" className={buttonVariants({ size: "lg", className: "mt-6 w-full" })}>
              {dict.checkout}
            </Link>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
