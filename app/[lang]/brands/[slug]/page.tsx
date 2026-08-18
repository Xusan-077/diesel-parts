import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { brands } from "@/prisma/seed-data/brands";
import { products } from "@/prisma/seed-data/products";
import { categories } from "@/prisma/seed-data/categories";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { DEFAULT_LOCALE, isLocale, SUPPORTED_LOCALES } from "@/lib/i18n/locales";
import { localeAlternates } from "@/lib/seo";
import { ProductCard } from "@/components/marketing/product-card";
import { Container } from "@/components/ui/container";

export function generateStaticParams() {
  return SUPPORTED_LOCALES.flatMap((lang) => brands.map((brand) => ({ lang, slug: brand.slug })));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}): Promise<Metadata> {
  const { lang: rawLang, slug } = await params;
  const brand = brands.find((b) => b.slug === slug);
  const lang = isLocale(rawLang) ? rawLang : DEFAULT_LOCALE;
  if (!brand) {
    return {};
  }
  const dict = getDictionary(lang);
  return {
    title: `${brand.name} — ${dict.meta.siteName}`,
    description: dict.brands.subtitle,
    alternates: localeAlternates(lang, `/brands/${brand.slug}`),
  };
}

export default async function BrandDetailPage({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}) {
  const { lang: rawLang, slug } = await params;
  const lang = isLocale(rawLang) ? rawLang : DEFAULT_LOCALE;
  const dict = getDictionary(lang);

  const brand = brands.find((b) => b.slug === slug);
  if (!brand) {
    notFound();
  }

  const brandProducts = products.filter((p) => p.brandId === brand.id);

  return (
    <Container as="main" className="pb-24 pt-12">
      <p className="text-sm text-muted">{dict.brands.title}</p>
      <h1 className="mt-1 text-3xl font-semibold text-foreground">{brand.name}</h1>
      <p className="mt-2 text-muted">
        {brandProducts.length} {dict.brands.productsFromBrand}
      </p>

      <div className="mt-10 grid grid-cols-2 gap-6 lg:grid-cols-3">
        {brandProducts.map((product) => {
          const category = categories.find((c) => c.id === product.categoryId)!;
          return (
            <ProductCard
              key={product.id}
              product={product}
              lang={lang}
              categoryName={category.name[lang]}
              brandName={brand.name}
              stock={dict.common.stock}
              requestPriceLabel={dict.common.requestPrice}
              actions={dict.productActions}
            />
          );
        })}
      </div>
    </Container>
  );
}
