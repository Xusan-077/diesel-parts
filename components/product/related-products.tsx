import { products } from "@/lib/data/products";
import { categories } from "@/lib/data/categories";
import { brands } from "@/lib/data/brands";
import { getRelatedProducts } from "@/lib/filters";
import type { Product } from "@/lib/types";
import type { Locale } from "@/lib/i18n/locales";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { ProductCard } from "@/components/marketing/product-card";

const RELATED_COUNT = 4;

export function RelatedProducts({
  product,
  lang,
  title,
  stock,
  requestPriceLabel,
}: {
  product: Product;
  lang: Locale;
  title: string;
  stock: Dictionary["common"]["stock"];
  requestPriceLabel: string;
}) {
  const related = getRelatedProducts(product, products, RELATED_COUNT);

  if (related.length === 0) {
    return null;
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <div className="mt-6 grid grid-cols-2 gap-6 lg:grid-cols-4">
        {related.map((item) => {
          const category = categories.find((c) => c.id === item.categoryId)!;
          const brand = brands.find((b) => b.id === item.brandId)!;
          return (
            <ProductCard
              key={item.id}
              product={item}
              lang={lang}
              categoryName={category.name[lang]}
              brandName={brand.name}
              stock={stock}
              requestPriceLabel={requestPriceLabel}
            />
          );
        })}
      </div>
    </div>
  );
}
