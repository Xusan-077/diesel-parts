"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselLabels,
} from "@/components/ui/carousel";
import { Icon } from "@/components/ui/icon";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import type { Product } from "@/lib/types";
import type { ProductStats } from "@/lib/product-stats";
import { ProductCard } from "./product-card";

interface ProductCarouselProps {
  lang: Locale;
  title: string;
  products: readonly Product[];
  viewAllHref: string;
  viewAllLabel: string;
  stock: Dictionary["common"]["stock"];
  requestPriceLabel: string;
  actions: Dictionary["productActions"];
  productDict: Dictionary["product"];
  carousel: Omit<CarouselLabels, "region">;
  /** Resolved on the server so the cards stay free of lookup logic. */
  meta: Record<string, { categoryName: string; brandName: string }>;
  /** Rating and sold counts, keyed by product id. Also read on the server. */
  stats: Record<string, ProductStats>;
  /** Corner label applied to every card in this row. */
  ribbon?: string;
}

/**
 * A titled collection of parts: a grid on a desktop, a carousel on a phone.
 *
 * One track, not two. Embla is switched off above `lg` through its own
 * breakpoint option, which leaves the DOM it was managing untouched — so the
 * same flex row the carousel drags becomes a four-column grid with nothing but
 * CSS, and neither layout is rendered twice or swapped in after hydration.
 *
 * The reason for the split is width. Four cards fill a desktop row, and a row
 * that scrolls when everything already fits hides parts behind an arrow for no
 * reason. A phone fits one and a half, and that half card is the affordance
 * that says the row keeps going — which is worth far more there than a grid two
 * cards wide and four screens tall.
 */
export function ProductCarousel({
  lang,
  title,
  products,
  viewAllHref,
  viewAllLabel,
  stock,
  requestPriceLabel,
  actions,
  productDict,
  carousel,
  meta,
  stats,
  ribbon,
}: ProductCarouselProps) {
  if (products.length === 0) {
    return null;
  }

  return (
    <Carousel
      labels={{ region: title, ...carousel }}
      /*
        Above `lg` the carousel deactivates itself rather than being replaced.
        An inactive Embla writes no transform and takes no drag, so what is
        left is the plain flex row underneath — which the classes below turn
        into the grid.
      */
      opts={{
        align: "start",
        containScroll: "trimSnaps",
        breakpoints: { "(min-width: 1024px)": { active: false } },
      }}
      className="py-16"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-3">
        <h2 className="text-2xl font-semibold text-foreground">{title}</h2>

        <div className="flex items-center gap-2">
          <Link
            href={viewAllHref}
            className="group mr-1 flex shrink-0 items-center gap-1.5 text-sm text-accent-strong transition-colors hover:underline"
          >
            {viewAllLabel}
            <Icon
              icon={ArrowRight}
              className="transition-transform duration-200 group-hover:translate-x-0.5"
            />
          </Link>
          {/* Nothing to scroll past once every card is on screen. */}
          <CarouselPrevious className="lg:hidden" />
          <CarouselNext className="lg:hidden" />
        </div>
      </div>

      <CarouselContent
        viewportClassName="lg:cursor-default lg:active:cursor-default"
        // The track's negative margin and each item's matching padding are the
        // carousel's gutter; the grid brings its own, so both are cancelled at
        // the same breakpoint Embla stands down at.
        className="mt-8 lg:ml-0 lg:grid lg:grid-cols-4 lg:gap-6"
      >
        {products.map((product) => (
          <CarouselItem
            key={product.id}
            className="basis-2/3 sm:basis-1/2 md:basis-1/3 lg:basis-auto lg:pl-0"
          >
            <ProductCard
              product={product}
              lang={lang}
              categoryName={meta[product.id]?.categoryName ?? ""}
              brandName={meta[product.id]?.brandName ?? ""}
              stock={stock}
              requestPriceLabel={requestPriceLabel}
              actions={actions}
              productDict={productDict}
              stats={stats[product.id]}
              ribbon={ribbon}
            />
          </CarouselItem>
        ))}
      </CarouselContent>
    </Carousel>
  );
}
