import { brands } from "@/prisma/seed-data/brands";
import { categories } from "@/prisma/seed-data/categories";
import { Container } from "@/components/ui/container";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import type { Product } from "@/lib/types";
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
}

/**
 * One titled row of product cards: used by every home page product section.
 *
 * Stays a server component so the brand and category lookups run once at build
 * time — only the scrolling track below needs to ship to the browser.
 */
export function ProductRow({
  lang,
  title,
  products,
  viewAllHref,
  viewAllLabel,
  stock,
  requestPriceLabel,
  actions,
  carousel,
  ribbon,
  autoplay,
}: ProductRowProps) {
  if (products.length === 0) {
    return null;
  }

  const meta = Object.fromEntries(
    products.map((product) => [
      product.id,
      {
        categoryName: categories.find((c) => c.id === product.categoryId)?.name[lang] ?? "",
        brandName: brands.find((b) => b.id === product.brandId)?.name ?? "",
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
        carousel={carousel}
        meta={meta}
        ribbon={ribbon}
        autoplay={autoplay}
      />
    </Container>
  );
}
