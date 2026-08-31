import type { Metadata } from "next";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/server-locale";
import { getCatalogScope } from "@/lib/api/catalog-repository";
import { DEFAULT_PAGE_SIZE } from "@/lib/api/product-query";
import {
  getPriceBounds,
  listBrands,
  listCategories,
  queryProducts,
} from "@/lib/api/product-repository";
import { safeRead } from "@/lib/api/safe-read";
import type { CatalogScope } from "@/lib/catalog-tree";
import type { Brand, Category } from "@/lib/types";
import { canonicalPath } from "@/lib/seo";
import { ProductCatalogClient } from "@/components/product/product-catalog-client";
import { Container } from "@/components/ui/container";

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ group?: string | string[]; category?: string | string[] }>;
}): Promise<Metadata> {
  const lang = await getLocale();
  const dict = getDictionary(lang);

  const { group, category } = await searchParams;
  // A menu the database cannot answer for costs this page its title, not the
  // page itself — the grid below still renders the whole catalog.
  const { data: scope } = await safeRead(
    "catalog scope metadata",
    () => getCatalogScope({ group: firstParam(group), category: firstParam(category) }),
    null as CatalogScope | null,
  );

  return {
    title: `${scope ? scope.label[lang] : dict.catalog.title} — ${dict.meta.siteName}`,
    description: dict.catalog.subtitle,
    alternates: canonicalPath("/products"),
  };
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string | string[];
    group?: string | string[];
    category?: string | string[];
  }>;
}) {
  const lang = await getLocale();
  const dict = getDictionary(lang);

  const { q, group, category } = await searchParams;
  const initialSearch = firstParam(q) ?? "";
  const { data: scope } = await safeRead(
    "catalog scope",
    () => getCatalogScope({ group: firstParam(group), category: firstParam(category) }),
    null as CatalogScope | null,
  );

  /*
   * Rendered on the server and handed to React Query as `initialData`, so the
   * first paint already has products instead of a spinner.
   *
   * When the read fails there is deliberately no seed: `null` leaves React
   * Query to fetch `/api/products` itself, so the visitor gets the catalog's
   * own "could not load / try again" state with a working retry button rather
   * than a server error page — and the moment the database comes back, one
   * click fills the grid without a reload.
   */
  const [initialData, categories, brands, priceBounds] = await Promise.all([
    safeRead(
      "catalog first page",
      () =>
        queryProducts({
          q: initialSearch,
          brandIds: [],
          categoryId: "all",
          categoryIds: scope?.categoryIds,
          availability: "all",
          priceMin: null,
          priceMax: null,
          sort: "newest",
          page: 1,
          pageSize: DEFAULT_PAGE_SIZE,
          lang,
        }),
      null,
    ),
    // The filter panel degrades to the groups it can still fill rather than
    // taking the page with it: an empty category list is a panel without a
    // tree, and null bounds are a panel without a price slider.
    safeRead("catalog categories", listCategories, [] as Category[]),
    safeRead("catalog brands", listBrands, [] as Brand[]),
    safeRead("catalog price bounds", getPriceBounds, null),
  ]);

  return (
    <Container as="main" className="pb-24 pt-12">
      <h1 className="text-3xl font-semibold text-foreground">
        {scope ? scope.label[lang] : dict.catalog.title}
      </h1>
      <p className="mt-2 text-muted">{dict.catalog.subtitle}</p>

      <div className="mt-10">
        <ProductCatalogClient
          // Remount so the seeded search and scope reset on a new menu click.
          key={`${initialSearch}|${firstParam(group) ?? ""}|${firstParam(category) ?? ""}`}
          lang={lang}
          initialSearch={initialSearch}
          scopeCategoryIds={scope?.categoryIds}
          scopeLabel={scope?.label[lang]}
          clearScopeLabel={dict.catalog.clearScope}
          dict={dict.catalog}
          stockDict={dict.common.stock}
          requestPriceLabel={dict.common.requestPrice}
          actions={dict.productActions}
          productDict={dict.product}
          categories={categories.data}
          brands={brands.data}
          priceBounds={priceBounds.data}
          initialData={initialData.data}
        />
      </div>
    </Container>
  );
}
