import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/server-locale";
import { DEFAULT_PAGE_SIZE } from "@/lib/api/product-query";
import { listBrands, listCategories, queryProducts } from "@/lib/api/product-repository";
import { safeRead } from "@/lib/api/safe-read";
import { getProductStats } from "@/lib/api/product-stats-repository";
import { DataUnavailable } from "@/components/ui/data-unavailable";
import { PageUnavailable } from "@/components/layout/page-unavailable";
import type { Brand, Category } from "@/lib/types";
import type { ProductStats } from "@/lib/product-stats";
import { canonicalPath } from "@/lib/seo";
import { ProductCard } from "@/components/marketing/product-card";
import { Container } from "@/components/ui/container";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { data: categories } = await safeRead(
    "category metadata",
    listCategories,
    [] as Category[],
  );
  const category = categories.find((c) => c.slug === slug);
  const lang = await getLocale();
  if (!category) {
    return {};
  }
  const dict = getDictionary(lang);
  return {
    title: `${category.name[lang]} — ${dict.meta.siteName}`,
    description: dict.categories.subtitle,
    alternates: canonicalPath(`/categories/${category.slug}`),
  };
}

export default async function CategoryDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const lang = await getLocale();
  const dict = getDictionary(lang);

  /*
   * The category row carries this page's title and its identity, so an
   * unreadable one leaves nothing to degrade — the notice becomes the page.
   * Kept apart from the missing-row case below, which is a real 404.
   */
  const lookup = await safeRead("category", listCategories, [] as Category[]);
  if (!lookup.ok) {
    return (
      <PageUnavailable title={dict.common.pageUnavailable} message={dict.common.dataUnavailable} />
    );
  }

  const category = lookup.data.find((c) => c.slug === slug);
  if (!category) {
    notFound();
  }

  // The grid is what can be lost: the heading and the count still render, with
  // a notice where the cards would be.
  const [page, brands] = await Promise.all([
    safeRead(
      "category products",
      () =>
        queryProducts({
          q: "",
          brandId: "all",
          categoryId: category.id,
          categoryIds: undefined,
          availability: "all",
          sort: "newest",
          page: 1,
          pageSize: DEFAULT_PAGE_SIZE,
          lang,
        }),
      null,
    ),
    safeRead("category page brands", listBrands, [] as Brand[]),
  ]);

  const brandNameById = new Map(brands.data.map((brand) => [brand.id, brand.name]));

  /*
   * Ratings and sold counts for the page in two grouped queries. Decoration on
   * a listing, so a failed read costs the line under each card and nothing
   * else — `safeRead` hands back an empty map and `ProductStatsRow` renders
   * nothing for a product it has no figures for.
   */
  const stats = await safeRead(
    "product stats",
    () => getProductStats((page.data?.items ?? []).map((product) => product.id)),
    new Map<string, ProductStats>(),
  );

  return (
    <Container as="main" className="pb-24 pt-12">
      <p className="text-sm text-muted">{dict.categories.title}</p>
      <h1 className="mt-1 text-3xl font-semibold text-foreground">{category.name[lang]}</h1>
      {page.data ? (
        <p className="mt-2 text-muted">
          {page.data.total} {dict.categories.productsInCategory}
        </p>
      ) : null}

      {page.data === null ? (
        <DataUnavailable className="mt-10" message={dict.common.productsUnavailable} />
      ) : (
        <div className="mt-10 grid grid-cols-2 gap-6 lg:grid-cols-3">
          {page.data.items.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              lang={lang}
              categoryName={category.name[lang]}
              // Empty rather than a crash: a product whose brand row was deleted
              // should still appear in the grid.
              brandName={brandNameById.get(product.brandId) ?? ""}
              stock={dict.common.stock}
              requestPriceLabel={dict.common.requestPrice}
              actions={dict.productActions}
              productDict={dict.product}
              stats={stats.data.get(product.id)}
            />
          ))}
        </div>
      )}
    </Container>
  );
}
