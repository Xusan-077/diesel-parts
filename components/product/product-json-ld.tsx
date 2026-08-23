import type { Product, Category, Brand } from "@/lib/types";
import type { Locale } from "@/lib/i18n/locales";
import { SITE_URL } from "@/lib/site-config";
import { CURRENCY } from "@/lib/format-price";

/** schema.org's `ItemAvailability` enum has no direct match for "limited" —
 *  Google's own examples map a low-stock state to `LimitedAvailability`. */
const AVAILABILITY: Record<Product["stockStatus"], string> = {
  available: "https://schema.org/InStock",
  limited: "https://schema.org/LimitedAvailability",
  out_of_stock: "https://schema.org/OutOfStock",
};

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
    // `null` on every row nobody has photographed yet — Google accepts a
    // Product with no `image`, so it is left off rather than pointing at the
    // fallback glyph, which is not a photograph of the part.
    ...(product.imageUrl ? { image: `${SITE_URL}${product.imageUrl}` } : {}),
    // Only priced rows get an `offers` block: a `Offer` with no `price` is
    // invalid, and the "contact us" products genuinely have none to report.
    ...(product.price !== null
      ? {
          offers: {
            "@type": "Offer",
            url: `${SITE_URL}/products/${product.slug}`,
            priceCurrency: CURRENCY,
            price: product.price,
            availability: AVAILABILITY[product.stockStatus],
          },
        }
      : {}),
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
