import Link from "next/link";
import { CardGallery } from "@/components/product/card-gallery";
import { ProductCartControl } from "@/components/product/product-cart-control";
import { ProductSaveActions } from "@/components/product/product-save-actions";
import { ProductStatsRow } from "@/components/product/product-stats-row";
import { StockBadge } from "@/components/product/stock-badge";
import { cardEyebrow } from "@/lib/card-eyebrow";
import { EMPTY_STATS, type ProductStats } from "@/lib/product-stats";
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
  /** Strings for the rating, order count and gallery controls. */
  productDict: Dictionary["product"];
  /**
   * Rating, review count and orders. Absent where the caller had no cheap way
   * to read them, which the card renders as the same zeros an unreviewed part
   * gets — see below.
   */
  stats?: ProductStats;
  /** Optional corner label, e.g. "New" on the newest-products row. */
  ribbon?: string;
}

/**
 * One part, as it appears in every grid and row on the site.
 *
 * The card is a column with a fixed head and a pinned foot: the picture is a
 * 4:3 box whatever it holds, and the cart control sits on `mt-auto`. So a
 * two-word name and a name that wraps to three lines produce cards of exactly
 * the same height, with the buttons on one line across the grid — which is what
 * makes a row of them scannable rather than a ragged edge.
 *
 * Everything a visitor can decide happens here. The quantity, the cart, saving
 * it for later, holding it against another part, and looking at the other
 * photographs are all on the card; the page behind the title is for the spec
 * table and the reviews. A grid where every part costs a page visit to act on
 * is a grid nobody buys from.
 *
 * The order of the body is deliberate and not the usual one: price, then brand
 * and name, then the numbers. In a catalog of parts that are largely
 * interchangeable, price is the first thing being compared down the column, so
 * it leads and is the only figure set at reading size.
 */
export function ProductCard({
  product,
  lang,
  categoryName,
  brandName,
  stock,
  requestPriceLabel,
  actions,
  productDict,
  stats,
  ribbon,
}: ProductCardProps) {
  const price = formatPrice(product.price, lang);

  return (
    /*
      `@container` rather than viewport breakpoints below: this card is three
      to a row on a desktop grid, two on a phone, and a fifth of a carousel
      on the home page. What its controls can fit depends on how wide the
      card is, which no viewport breakpoint knows.
    */
    // The title link is stretched over the whole card, so every control has to
    // sit above it rather than nested inside it.
    <article className="group @container relative flex h-full flex-col overflow-hidden rounded-lg border border-border bg-surface-muted transition-colors hover:border-accent/60">
      <div className="relative">
        <CardGallery
          frames={product.imageLabels}
          alt={product.name[lang]}
          dict={productDict}
        />

        {ribbon ? (
          <span className="absolute left-3 top-3 z-10 rounded-full bg-accent px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-accent-foreground">
            {ribbon}
          </span>
        ) : null}

        <ProductSaveActions
          product={product}
          brandName={brandName}
          categoryName={categoryName}
          lang={lang}
          dict={actions}
          className="absolute right-3 top-3 z-10"
        />

        {/*
          Availability sits on the picture rather than beside the price. Two
          cards to a row on a phone leaves about 140px for a price and a badge,
          which is not enough for both — the badge wrapped, and a card whose
          badge wrapped stood a line taller than the card beside it. Here it
          costs no height at all, and it is a fact about the part in the
          picture, which is a reasonable thing to read off the picture.
        */}
        <StockBadge
          status={product.stockStatus}
          stock={stock}
          className="absolute bottom-2 left-3 z-10"
        />
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        {price ? (
          <p className="text-base font-semibold text-foreground">{price}</p>
        ) : (
          <p className="text-base font-medium text-accent-strong">{requestPriceLabel}</p>
        )}

        {/*
          One line, always — the brand where the name has not already said it,
          the category where it has. See lib/card-eyebrow.ts for why.
        */}
        <p className="type-eyebrow text-muted">
          {cardEyebrow(product.name[lang], brandName, categoryName)}
        </p>

        {/*
          Exactly two lines, whether the name needs them or not: reserved by
          the minimum, capped by the clamp. Without the cap a three-line name
          pushes one card past its neighbours; the full name is on the page
          behind the link.
        */}
        <h3 className="line-clamp-2 min-h-10 text-sm font-medium leading-tight text-foreground">
          <Link
            href={`/products/${product.slug}`}
            className="transition-colors after:absolute after:inset-0 group-hover:text-accent-strong"
          >
            {product.name[lang]}
          </Link>
        </h3>

        {/*
          Always drawn, even on a part nobody has reviewed or ordered — that is
          what `placeholder` is for. A line that appears on some cards and not
          others is the thing that makes a grid look broken.

          Two lines are reserved for it. On a narrow card the score and the
          order count cannot share a line, so the block wraps; without the
          minimum, the cards that wrap would stand a line taller than the cards
          that do not, which is the same raggedness the name clamp above
          prevents.
        */}
        <div className="min-h-9">
          <ProductStatsRow
            stats={stats ?? EMPTY_STATS}
            lang={lang}
            dict={productDict}
            placeholder
          />
        </div>

        <ProductCartControl
          product={product}
          brandName={brandName}
          categoryName={categoryName}
          lang={lang}
          dict={actions}
          requestPriceLabel={requestPriceLabel}
          className="relative z-10 mt-auto pt-3"
        />
      </div>
    </article>
  );
}
