import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { products } from "@/prisma/seed-data/products";
import { categories } from "@/prisma/seed-data/categories";
import { brands } from "@/prisma/seed-data/brands";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { DEFAULT_LOCALE, isLocale, SUPPORTED_LOCALES } from "@/lib/i18n/locales";
import { ProductGallery } from "@/components/product/product-gallery";
import { SpecsTable } from "@/components/product/specs-table";
import { StockBadge } from "@/components/product/stock-badge";
import { ProductActions } from "@/components/product/product-actions";
import { formatPrice } from "@/lib/format-price";
import { localeAlternates } from "@/lib/seo";
import { RelatedProducts } from "@/components/product/related-products";
import { ProductJsonLd } from "@/components/product/product-json-ld";
import { InquiryDialog } from "@/components/forms/inquiry-dialog";
import { Container } from "@/components/ui/container";

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
    alternates: localeAlternates(lang, `/products/${product.slug}`),
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
    <Container as="main" className="pb-24 pt-12">
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
              {dict.product.oemLabel}: {product.oemNumbers.join(", ")}
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
            {formatPrice(product.price, lang) ? (
              <div>
                <p className="text-xs uppercase tracking-wide text-muted">
                  {dict.product.priceLabel}
                </p>
                <p className="mt-1 text-3xl font-semibold text-foreground">
                  {formatPrice(product.price, lang)}
                </p>
              </div>
            ) : (
              <p className="text-2xl font-semibold text-accent-strong">{dict.common.requestPrice}</p>
            )}

            <ProductActions
              productId={product.id}
              price={product.price}
              lang={lang}
              dict={dict.productActions}
            />
            <InquiryDialog
              productId={product.id}
              productSlug={product.slug}
              dict={dict.inquiry}
              closeLabel={dict.common.close}
            />
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
          actions={dict.productActions}
        />
      </div>
    </Container>
  );
}
