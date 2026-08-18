import type { Metadata } from "next";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/locales";
import { resolveCatalogScope } from "@/lib/catalog-menu";
import { DEFAULT_PAGE_SIZE } from "@/lib/api/product-query";
import { listBrands, listCategories, queryProducts } from "@/lib/api/product-repository";
import { localeAlternates } from "@/lib/seo";
import { ProductCatalogClient } from "@/components/product/product-catalog-client";
import { Container } from "@/components/ui/container";

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ group?: string | string[]; category?: string | string[] }>;
}): Promise<Metadata> {
  const { lang: rawLang } = await params;
  const lang = isLocale(rawLang) ? rawLang : DEFAULT_LOCALE;
  const dict = getDictionary(lang);

  const { group, category } = await searchParams;
  const scope = resolveCatalogScope({
    group: firstParam(group),
    category: firstParam(category),
  });

  return {
    title: `${scope ? scope.label[lang] : dict.catalog.title} — ${dict.meta.siteName}`,
    description: dict.catalog.subtitle,
    alternates: localeAlternates(lang, "/products"),
  };
}

export default async function ProductsPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{
    q?: string | string[];
    group?: string | string[];
    category?: string | string[];
  }>;
}) {
  const { lang: rawLang } = await params;
  const lang = isLocale(rawLang) ? rawLang : DEFAULT_LOCALE;
  const dict = getDictionary(lang);

  const { q, group, category } = await searchParams;
  const initialSearch = firstParam(q) ?? "";
  const scope = resolveCatalogScope({
    group: firstParam(group),
    category: firstParam(category),
  });

  // Rendered on the server and handed to React Query as `initialData`, so the
  // first paint already has products instead of a spinner.
  const [initialData, categories, brands] = await Promise.all([
    queryProducts({
      q: initialSearch,
      brandId: "all",
      categoryId: "all",
      categoryIds: scope?.categoryIds,
      availability: "all",
      sort: "newest",
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
      lang,
    }),
    listCategories(),
    listBrands(),
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
          categories={categories}
          brands={brands}
          initialData={initialData}
        />
      </div>
    </Container>
  );
}
