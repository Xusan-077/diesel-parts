import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { DEFAULT_LOCALE, isLocale, SUPPORTED_LOCALES } from "@/lib/i18n/locales";
import { DEFAULT_PAGE_SIZE } from "@/lib/api/product-query";
import { listBrands, listCategories, queryProducts } from "@/lib/api/product-repository";
import { localeAlternates } from "@/lib/seo";
import { ProductCard } from "@/components/marketing/product-card";
import { Container } from "@/components/ui/container";

/** Catalog content changes rarely; an hour keeps the page static and fresh enough. */
export const revalidate = 3600;

export async function generateStaticParams() {
  const categories = await listCategories();
  return SUPPORTED_LOCALES.flatMap((lang) =>
    categories.map((category) => ({ lang, slug: category.slug })),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}): Promise<Metadata> {
  const { lang: rawLang, slug } = await params;
  const categories = await listCategories();
  const category = categories.find((c) => c.slug === slug);
  const lang = isLocale(rawLang) ? rawLang : DEFAULT_LOCALE;
  if (!category) {
    return {};
  }
  const dict = getDictionary(lang);
  return {
    title: `${category.name[lang]} — ${dict.meta.siteName}`,
    description: dict.categories.subtitle,
    alternates: localeAlternates(lang, `/categories/${category.slug}`),
  };
}

export default async function CategoryDetailPage({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}) {
  const { lang: rawLang, slug } = await params;
  const lang = isLocale(rawLang) ? rawLang : DEFAULT_LOCALE;
  const dict = getDictionary(lang);

  const categories = await listCategories();
  const category = categories.find((c) => c.slug === slug);
  if (!category) {
    notFound();
  }

  const [page, brands] = await Promise.all([
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
    listBrands(),
  ]);

  const brandNameById = new Map(brands.map((brand) => [brand.id, brand.name]));

  return (
    <Container as="main" className="pb-24 pt-12">
      <p className="text-sm text-muted">{dict.categories.title}</p>
      <h1 className="mt-1 text-3xl font-semibold text-foreground">{category.name[lang]}</h1>
      <p className="mt-2 text-muted">
        {page.total} {dict.categories.productsInCategory}
      </p>

      <div className="mt-10 grid grid-cols-2 gap-6 lg:grid-cols-3">
        {page.items.map((product) => (
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
          />
        ))}
      </div>
    </Container>
  );
}
