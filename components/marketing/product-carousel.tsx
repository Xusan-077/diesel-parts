"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  Carousel,
  CarouselAutoplayToggle,
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
  carousel: Omit<CarouselLabels, "region">;
  /** Resolved on the server so the cards stay free of lookup logic. */
  meta: Record<string, { categoryName: string; brandName: string }>;
  /** Corner label applied to every card in this row. */
  ribbon?: string;
  /** Advance on a timer. Reserved for the one lead row, never all of them. */
  autoplay?: boolean;
}

/**
 * A titled row of product cards that scrolls.
 *
 * The grid it replaces could only ever show four parts; a supplier's real pitch
 * is the depth of the shelf, so the row now runs as far as the collection does.
 * One and a half cards are visible on a phone — the half card is the affordance
 * that says the row keeps going.
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
  carousel,
  meta,
  ribbon,
  autoplay = false,
}: ProductCarouselProps) {
  if (products.length === 0) {
    return null;
  }

  return (
    <Carousel
      labels={{ region: title, ...carousel }}
      autoplay={autoplay}
      opts={{ align: "start", containScroll: "trimSnaps" }}
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
          {autoplay ? <CarouselAutoplayToggle /> : null}
          <CarouselPrevious />
          <CarouselNext />
        </div>
      </div>

      <CarouselContent className="mt-8">
        {products.map((product) => (
          <CarouselItem
            key={product.id}
            className="basis-2/3 sm:basis-1/2 lg:basis-1/3 xl:basis-1/4"
          >
            <ProductCard
              product={product}
              lang={lang}
              categoryName={meta[product.id]?.categoryName ?? ""}
              brandName={meta[product.id]?.brandName ?? ""}
              stock={stock}
              requestPriceLabel={requestPriceLabel}
              actions={actions}
              ribbon={ribbon}
            />
          </CarouselItem>
        ))}
      </CarouselContent>
    </Carousel>
  );
}
