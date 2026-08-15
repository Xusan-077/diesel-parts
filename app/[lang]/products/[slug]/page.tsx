import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { products } from "@/lib/data/products";
import { categories } from "@/lib/data/categories";
import { brands } from "@/lib/data/brands";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { DEFAULT_LOCALE, isLocale, SUPPORTED_LOCALES } from "@/lib/i18n/locales";
import { ProductGallery } from "@/components/product/product-gallery";
import { SpecsTable } from "@/components/product/specs-table";
import { StockBadge } from "@/components/product/stock-badge";
import { RelatedProducts } from "@/components/product/related-products";
import { ProductJsonLd } from "@/components/product/product-json-ld";
import { InquiryDialog } from "@/components/forms/inquiry-dialog";

export function generateStaticParams() {
  return SUPPORTED_LOCALES.flatMap((lang) => products.map((product) => ({ lang, slug: product.slug })));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}): Promise<Metadata> {
  const { lang: rawLang, slug } = await params;
  const product = products.find((p) => p.slug === slug);
  const lang = isLocale(rawLang) ? rawLang : DEFAULT_LOCALE;
  if (!product) {
    return {};
  }
  const dict = getDictionary(lang);
  return {
    title: `${product.name[lang]} — ${dict.meta.siteName}`,
    description: product.description[lang],
  };
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}) {
  const { lang: rawLang, slug } = await params;
  const lang = isLocale(rawLang) ? rawLang : DEFAULT_LOCALE;
  const dict = getDictionary(lang);

  const product = products.find((p) => p.slug === slug);
  if (!product) {
    notFound();
  }

  const category = categories.find((c) => c.id === product.categoryId)!;
  const brand = brands.find((b) => b.id === product.brandId)!;

  return (
    <main className="mx-auto max-w-7xl px-6 pb-24 pt-24">
      <ProductJsonLd product={product} category={category} brand={brand} lang={lang} />

      <div className="grid gap-12 lg:grid-cols-2">
        <ProductGallery imageLabels={product.imageLabels} galleryAlt={dict.product.galleryAlt} />

        <div>
          <p className="text-sm text-muted">{brand.name}</p>
          <h1 className="mt-1 text-3xl font-semibold text-foreground">{product.name[lang]}</h1>

          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-muted">
            <span>
              {dict.product.skuLabel}: {product.sku}
            </span>
            <span>
              {dict.product.oemLabel}: {product.oemNumber}
            </span>
            <StockBadge status={product.stockStatus} stock={dict.common.stock} />
          </div>

          <p className="mt-6 text-foreground">{product.description[lang]}</p>

          <div>
            <h2 className="mt-8 text-lg font-semibold text-foreground">
              {dict.product.compatibleModelsTitle}
            </h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {product.compatibleModels.map((model) => (
                <li key={model} className="rounded-full border border-border px-3 py-1 text-xs text-muted">
                  {model}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <p className="text-2xl font-semibold text-accent">{dict.common.requestPrice}</p>
            <InquiryDialog productId={product.id} productSlug={product.slug} dict={dict.inquiry} />
          </div>
        </div>
      </div>

      <div className="mt-16">
        <SpecsTable specs={product.specs} lang={lang} title={dict.product.specificationsTitle} />
      </div>

      <div className="mt-16">
        <RelatedProducts
          product={product}
          lang={lang}
          title={dict.product.relatedProductsTitle}
          stock={dict.common.stock}
          requestPriceLabel={dict.common.requestPrice}
        />
      </div>
    </main>
  );
}
