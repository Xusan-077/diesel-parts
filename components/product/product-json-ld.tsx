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
    mpn: product.oemNumbers[0],
    brand: { "@type": "Brand", name: brand.name },
    category: category.name[lang],
    description: product.description[lang],
  };

  return (
    // A native <script> is what the Next.js JSON-LD guide prescribes here —
    // next/script is for executable code, and this is data.
    //
    // `JSON.stringify` does not escape `<`, so a product name containing
    // `</script>` would close the tag early and inject markup. Escaping it to
    // its unicode form keeps the payload inert.
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
    />
  );
}
