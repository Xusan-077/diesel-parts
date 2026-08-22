"use client";

import { useHomeProducts } from "@/hooks/use-home-products";
import { Container } from "@/components/ui/container";
import { DataUnavailable } from "@/components/ui/data-unavailable";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import type { HomeCollection, HomeProductsResponse } from "@/lib/product-collections";
import { ProductCarousel } from "./product-carousel";
import { SectionMarker } from "./section-marker";

interface HomeProductRowProps {
  lang: Locale;
  /** Which of the three home collections this row draws. */
  collection: HomeCollection;
  title: string;
  viewAllHref: string;
  viewAllLabel: string;
  stock: Dictionary["common"]["stock"];
  requestPriceLabel: string;
  actions: Dictionary["productActions"];
  productDict: Dictionary["product"];
  carousel: {
    prev: string;
    next: string;
  };
  /** Shown in place of the cards when the request failed. */
  unavailableLabel: string;
  /** Announced to a screen reader while the skeleton is on screen. */
  loadingLabel: string;
  /** Label on the button that refetches after a failure. */
  retryLabel: string;
  /**
   * The collections as the page's own server render read them, seeding React
   * Query so the cards are server-rendered rather than fetched on mount.
   * `undefined` when that read failed, which leaves the row to fetch.
   */
  initialData?: HomeProductsResponse;
  /** Corner label applied to every card in this row. */
  ribbon?: string;
}

/**
 * One titled row of product cards, backed by `/api/products/home`.
 *
 * A client component with a server-rendered first frame. The page reads the
 * collections during its own render and hands them down as `initialData`, so
 * the cards are in the HTML — which is what a crawler is served, and what a
 * visitor sees before any JavaScript has run. React Query owns them from there:
 * it refetches when the seed goes stale and it is what a "try again" press
 * calls, so a row that failed can recover without reloading the page.
 *
 * All three rows share one query key, so the seed is written once and a refetch
 * is one request no matter how many rows read from it.
 *
 * The three states below are deliberately not the same shape. A pending read
 * holds the row's height so nothing under it jumps when the cards land, a
 * failed one keeps the heading and explains the gap, and a collection that came
 * back genuinely empty renders nothing at all — an empty row and an unreadable
 * one look identical in the data and mean opposite things to a visitor.
 *
 * A seeded row never renders the pending state at all: it is the branch for a
 * visit whose server-side read failed, where the browser is the second chance.
 */
export function HomeProductRow({
  lang,
  collection,
  title,
  viewAllHref,
  viewAllLabel,
  stock,
  requestPriceLabel,
  actions,
  productDict,
  carousel,
  unavailableLabel,
  loadingLabel,
  retryLabel,
  initialData,
  ribbon,
}: HomeProductRowProps) {
  const { products, meta, stats, isPending, isError, retry } = useHomeProducts(
    collection,
    lang,
    { initialData },
  );

  if (isPending) {
    return (
      <Container as="section" className="py-16">
        <h2 className="text-2xl font-semibold text-foreground">{title}</h2>
        <HomeProductRowSkeleton label={loadingLabel} />
      </Container>
    );
  }

  if (isError) {
    return (
      <Container as="section" className="py-16">
        <h2 className="text-2xl font-semibold text-foreground">{title}</h2>
        <DataUnavailable className="mt-8" message={unavailableLabel} />
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={retry}
            className="rounded-md border border-border px-4 py-2 text-sm text-foreground transition-colors hover:border-accent/60 hover:text-accent-strong"
          >
            {retryLabel}
          </button>
        </div>
      </Container>
    );
  }

  if (products.length === 0) {
    return null;
  }

  return (
    <Container>
      <ProductCarousel
        lang={lang}
        title={title}
        products={products}
        viewAllHref={viewAllHref}
        viewAllLabel={viewAllLabel}
        stock={stock}
        requestPriceLabel={requestPriceLabel}
        actions={actions}
        productDict={productDict}
        carousel={carousel}
        meta={meta}
        stats={stats}
        ribbon={ribbon}
      />
      <SectionMarker label={title} href={viewAllHref} />
    </Container>
  );
}

/**
 * The row's shape before the cards arrive.
 *
 * Card-shaped blocks in the row's own layout — one and a half on a phone, four
 * across above `lg` — rather than a spinner, so the space the cards will occupy
 * is already reserved and the sections below it do not shift when they land.
 */
function HomeProductRowSkeleton({ label }: { label: string }) {
  return (
    <div aria-busy="true" className="mt-8">
      <span className="sr-only">{label}</span>
      <div
        aria-hidden="true"
        className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-6 sm:grid-cols-3 lg:grid-cols-4"
      >
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className={
              // The third and fourth only exist on the widths that show them;
              // a phone shows two, which is what the carousel opens on.
              "h-80 animate-pulse rounded-lg border border-border bg-surface-muted" +
              (index === 2 ? " hidden sm:block" : index === 3 ? " hidden lg:block" : "")
            }
          />
        ))}
      </div>
    </div>
  );
}
