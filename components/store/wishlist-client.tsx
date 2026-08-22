"use client";

import Link from "next/link";
import { toast } from "sonner";
import { Heart, MessageCircle, Trash2 } from "lucide-react";
import { StockBadge } from "@/components/product/stock-badge";
import { StoreEmpty } from "@/components/store/store-empty";
import { useCart, useWishlist } from "@/hooks/use-store";
import { useResolvedProducts } from "@/hooks/use-resolved-products";
import { usePruneMissing } from "@/hooks/use-prune-missing";
import { ResolvedProductsSkeleton } from "@/components/store/resolved-products-skeleton";
import { formatPrice } from "@/lib/format-price";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import { Icon } from "@/components/ui/icon";

interface WishlistClientProps {
  lang: Locale;
  dict: Dictionary["wishlist"];
  stock: Dictionary["common"]["stock"];
}

export function WishlistClient({ lang, dict, stock }: WishlistClientProps) {
  const wishlist = useWishlist();
  const cart = useCart();
  const { items, isLoading, isSuccess } = useResolvedProducts(wishlist.ids, lang);
  usePruneMissing(wishlist.ids, items, isSuccess, wishlist.remove);

  if (isLoading) {
    return <ResolvedProductsSkeleton count={wishlist.ids.length} />;
  }

  if (items.length === 0) {
    return (
      <StoreEmpty
        icon={Heart}
        message={dict.empty}
        ctaHref="/products"
        ctaLabel={dict.emptyCta}
      />
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted">
          {dict.count.replace("{count}", String(items.length))}
        </p>
        <button
          type="button"
          onClick={() => {
            wishlist.clear();
            toast.success(dict.toastCleared);
          }}
          className="text-sm text-muted transition-colors hover:text-accent-strong"
        >
          {dict.clear}
        </button>
      </div>

      <ul className="mt-6 flex flex-col gap-4">
        {items.map(({ product, brandName, categoryName }) => (
          <li
            key={product.id}
            className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 sm:flex-row sm:items-center"
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
                href={`/products/${product.slug}`}
                className="mt-1 block text-sm font-medium text-foreground transition-colors hover:text-accent-strong"
              >
                {product.name[lang]}
              </Link>
              <p className="mt-1 text-xs text-muted">
                {categoryName} · {product.sku}
              </p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {formatPrice(product.price, lang) ?? (
                  <span className="font-medium text-accent-strong">{dict.priceOnRequest}</span>
                )}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {product.price === null ? (
                <Link
                  href="/contact"
                  className="flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-accent/60 hover:text-accent-strong"
                >
                  <Icon icon={MessageCircle} />
                  {dict.contact}
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    cart.add(product.id);
                    toast.success(dict.toastCartAdded);
                  }}
                  className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover active:bg-accent-active"
                >
                  {dict.addToCart}
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  wishlist.remove(product.id);
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
  );
}
