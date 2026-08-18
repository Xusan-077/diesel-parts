import { DEFAULT_LOCALE } from "@/lib/i18n/locales";
import { listBrands, listCategories, queryProducts } from "@/lib/api/product-repository";
import type { Product } from "@/lib/types";
import type { Locale } from "@/lib/i18n/locales";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { ProductCard } from "@/components/marketing/product-card";

const RELATED_COUNT = 4;

export async function RelatedProducts({
  product,
  lang,
  title,
  stock,
  requestPriceLabel,
  actions,
}: {
  product: Product;
  lang: Locale;
  title: string;
  stock: Dictionary["common"]["stock"];
  requestPriceLabel: string;
  actions: Dictionary["productActions"];
}) {
  const [page, brands, categories] = await Promise.all([
    queryProducts({
      q: "",
      brandId: "all",
      categoryId: product.categoryId,
      categoryIds: undefined,
      availability: "all",
      sort: "newest",
      page: 1,
      // One extra, because the product being viewed is in its own category and
      // queryProducts has no "exclude this id" parameter.
      pageSize: RELATED_COUNT + 1,
      lang: lang ?? DEFAULT_LOCALE,
    }),
    listBrands(),
    listCategories(),
  ]);

  const related = page.items
    .filter((candidate) => candidate.id !== product.id)
    .slice(0, RELATED_COUNT);

  if (related.length === 0) {
    return null;
  }

  const brandNameById = new Map(brands.map((brand) => [brand.id, brand.name]));
  const categoryNameById = new Map(categories.map((category) => [category.id, category.name[lang]]));

  return (
    <div>
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <div className="mt-6 grid grid-cols-2 gap-6 lg:grid-cols-4">
        {related.map((item) => (
          <ProductCard
            key={item.id}
            product={item}
            lang={lang}
            categoryName={categoryNameById.get(item.categoryId) ?? ""}
            brandName={brandNameById.get(item.brandId) ?? ""}
            stock={stock}
            requestPriceLabel={requestPriceLabel}
            actions={actions}
          />
        ))}
      </div>
    </div>
  );
}
