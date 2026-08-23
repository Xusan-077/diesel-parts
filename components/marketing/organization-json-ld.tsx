import { COMPANY_NAME, OG_IMAGE, SITE_LOCATION, SITE_PHONES, SITE_URL } from "@/lib/site-config";
import type { Dictionary } from "@/lib/i18n/dictionaries";

/**
 * The business itself, once, on the home page.
 *
 * `AutoPartsStore` is schema.org's own subtype of `LocalBusiness` (via
 * `AutomotiveBusiness`) for exactly this trade, so it satisfies both a
 * generic "does the site identify its business" check and the more specific
 * automotive one Google's rich-result docs describe.
 *
 * Home-page-only rather than in the root layout: repeating it on every page
 * would be the same block twenty times over for no reader — a crawler only
 * needs the business identified once per site, and the home page is where it
 * looks.
 */
export function OrganizationJsonLd({ footer }: { footer: Dictionary["footer"] }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "AutoPartsStore",
    name: COMPANY_NAME,
    url: SITE_URL,
    image: `${SITE_URL}${OG_IMAGE.url}`,
    telephone: SITE_PHONES[0].tel,
    email: footer.email,
    address: {
      "@type": "PostalAddress",
      streetAddress: footer.address,
      addressCountry: "UZ",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: SITE_LOCATION.lat,
      longitude: SITE_LOCATION.lon,
    },
  };

  return (
    // Same escaping as BreadcrumbJsonLd and ProductJsonLd — `JSON.stringify`
    // leaves `<` alone, so a raw `</script>` in any field would close the tag.
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
    />
  );
}
