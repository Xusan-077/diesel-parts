import type { Metadata } from "next";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/locales";
import { ProductCatalogClient } from "@/components/product/product-catalog-client";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const dict = getDictionary(lang);
  return {
    title: `${dict.catalog.title} — ${dict.meta.siteName}`,
    description: dict.catalog.subtitle,
  };
}

export default async function ProductsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang = isLocale(rawLang) ? rawLang : DEFAULT_LOCALE;
  const dict = getDictionary(lang);

  return (
    <main className="mx-auto max-w-7xl px-6 pb-24 pt-24">
      <h1 className="text-3xl font-semibold text-foreground">{dict.catalog.title}</h1>
      <p className="mt-2 text-muted">{dict.catalog.subtitle}</p>

      <div className="mt-10">
        <ProductCatalogClient
          lang={lang}
          dict={dict.catalog}
          stockDict={dict.common.stock}
          requestPriceLabel={dict.common.requestPrice}
        />
      </div>
    </main>
  );
}
