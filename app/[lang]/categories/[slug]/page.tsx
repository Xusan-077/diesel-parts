import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { categories } from "@/lib/data/categories";
import { products } from "@/lib/data/products";
import { brands } from "@/lib/data/brands";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { DEFAULT_LOCALE, isLocale, SUPPORTED_LOCALES } from "@/lib/i18n/locales";
import { ProductCard } from "@/components/marketing/product-card";

export function generateStaticParams() {
  return SUPPORTED_LOCALES.flatMap((lang) => categories.map((category) => ({ lang, slug: category.slug })));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}): Promise<Metadata> {
  const { lang: rawLang, slug } = await params;
  const category = categories.find((c) => c.slug === slug);
  const lang = isLocale(rawLang) ? rawLang : DEFAULT_LOCALE;
  if (!category) {
    return {};
  }
  const dict = getDictionary(lang);
  return {
    title: `${category.name[lang]} — ${dict.meta.siteName}`,
    description: dict.categories.subtitle,
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

  const category = categories.find((c) => c.slug === slug);
  if (!category) {
    notFound();
  }

  const categoryProducts = products.filter((p) => p.categoryId === category.id);

  return (
    <main className="mx-auto max-w-7xl px-6 pb-24 pt-24">
      <p className="text-sm text-muted">{dict.categories.title}</p>
      <h1 className="mt-1 text-3xl font-semibold text-foreground">{category.name[lang]}</h1>
      <p className="mt-2 text-muted">
        {categoryProducts.length} {dict.categories.productsInCategory}
      </p>

      <div className="mt-10 grid grid-cols-2 gap-6 lg:grid-cols-3">
        {categoryProducts.map((product) => {
          const brand = brands.find((b) => b.id === product.brandId)!;
          return (
            <ProductCard
              key={product.id}
              product={product}
              lang={lang}
              categoryName={category.name[lang]}
              brandName={brand.name}
              stock={dict.common.stock}
              requestPriceLabel={dict.common.requestPrice}
            />
          );
        })}
      </div>
    </main>
  );
}
