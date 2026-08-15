import type { Product, Category, Brand } from "@/lib/types";
import type { Locale } from "@/lib/i18n/locales";

export function ProductJsonLd({
  product,
  category,
  brand,
  lang,
}: {
  product: Product;
  category: Category;
  brand: Brand;
  lang: Locale;
}) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name[lang],
    sku: product.sku,
    mpn: product.oemNumber,
    brand: { "@type": "Brand", name: brand.name },
    category: category.name[lang],
    description: product.description[lang],
  };

  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
  );
}
