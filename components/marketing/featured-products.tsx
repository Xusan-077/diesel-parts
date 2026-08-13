import { products } from "@/lib/data/products";
import { categories } from "@/lib/data/categories";
import { brands } from "@/lib/data/brands";
import type { Locale } from "@/lib/i18n/locales";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { ProductCard } from "./product-card";

const FEATURED_COUNT = 4;

export function FeaturedProducts({
  lang,
  stock,
  requestPriceLabel,
}: {
  lang: Locale;
  stock: Dictionary["common"]["stock"];
  requestPriceLabel: string;
}) {
  const featured = products.slice(0, FEATURED_COUNT);

  return (
    <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
      {featured.map((product) => {
        const category = categories.find((c) => c.id === product.categoryId)!;
        const brand = brands.find((b) => b.id === product.brandId)!;
        return (
          <ProductCard
            key={product.id}
            product={product}
            lang={lang}
            categoryName={category.name[lang]}
            brandName={brand.name}
            stock={stock}
            requestPriceLabel={requestPriceLabel}
          />
        );
      })}
    </div>
  );
}
