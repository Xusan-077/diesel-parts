import { listBrands, listCategories } from "@/lib/api/product-repository";
import { safeRead } from "@/lib/api/safe-read";
import { getProductStats } from "@/lib/api/product-stats-repository";
import type { ProductStats } from "@/lib/product-stats";
import { Container } from "@/components/ui/container";
import { DataUnavailable } from "@/components/ui/data-unavailable";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import type { Brand, Category, Product } from "@/lib/types";
import { ProductCarousel } from "./product-carousel";

interface ProductRowProps {
  lang: Locale;
  title: string;
  products: readonly Product[];
  viewAllHref: string;
  viewAllLabel: string;
  stock: Dictionary["common"]["stock"];
  requestPriceLabel: string;
  actions: Dictionary["productActions"];
  productDict: Dictionary["product"];
  carousel: {
    prev: string;
    next: string;
    pause: string;
    play: string;
  };
  /** Corner label applied to every card in this row. */
  ribbon?: string;
  /** Advance on a timer. Reserved for the one lead row, never all of them. */
  autoplay?: boolean;
  /**
   * The read that was supposed to fill this row failed.
   *
   * Kept separate from `products.length === 0` on purpose: an empty row and an
   * unreadable one look the same in the data but mean opposite things to a
   * visitor. A collection that is genuinely empty stays hidden, exactly as
   * before; only a failed read is worth a sentence of explanation.
   */
  unavailable?: boolean;
  /** Shown in place of the cards when `unavailable`. */
  unavailableLabel?: string;
}

/**
 * One titled row of product cards: used by every home page product section.
 *
 * Stays a server component so the brand and category lookups run once at build
 * time — only the scrolling track below needs to ship to the browser.
 */
export async function ProductRow({
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
  ribbon,
  autoplay,
  unavailable = false,
  unavailableLabel,
}: ProductRowProps) {
  if (unavailable) {
    return (
      <Container as="section" className="py-16">
        <h2 className="text-2xl font-semibold text-foreground">{title}</h2>
        <DataUnavailable className="mt-8" message={unavailableLabel ?? ""} />
      </Container>
    );
  }

  if (products.length === 0) {
    return null;
  }

  /*
   * Names only. Losing them costs a caption under each card, not the row, so
   * the cards render with the fields blank rather than taking the page down —
   * the same tolerance `ProductCard` already has for a deleted brand row.
   */
  const [brands, categories, stats] = await Promise.all([
    safeRead("product row brands", listBrands, [] as Brand[]),
    safeRead("product row categories", listCategories, [] as Category[]),
    // Same tolerance: no figures means no line under the card, not no row.
    safeRead(
      "product row stats",
      () => getProductStats(products.map((product) => product.id)),
      new Map<string, ProductStats>(),
    ),
  ]);

  const meta = Object.fromEntries(
    products.map((product) => [
      product.id,
      {
        categoryName: categories.data.find((c) => c.id === product.categoryId)?.name[lang] ?? "",
        brandName: brands.data.find((b) => b.id === product.brandId)?.name ?? "",
      },
    ])
  );

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
        stats={Object.fromEntries(stats.data)}
        ribbon={ribbon}
        autoplay={autoplay}
      />
    </Container>
  );
}
