import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site-config";


export default function robots(): MetadataRoute.Robots {
  return {
    // Account pages are per-user and behind a session; keep crawlers out.
    // The pattern lost its `/*/` prefix with the locale segment: the profile
    // now lives at `/account`, not `/uz/account`.
    //
    // `/admin` and `/seller` are the two internal panels — each already ships
    // its own `robots: { index: false }` in its root layout, but that only
    // stops indexing; a crawler still spends budget fetching every route
    // under them without this. `/login` is the seller panel's public sign-in
    // screen (`app/(seller-auth)/login`), and `/field-preview` is a
    // throwaway component harness, neither meant for a search result.
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/account", "/api/", "/admin", "/seller", "/login", "/field-preview"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
