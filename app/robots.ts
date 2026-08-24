import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site-config";


export default function robots(): MetadataRoute.Robots {
  return {
    // Account pages are per-user and behind a session; keep crawlers out.
    // The pattern lost its `/*/` prefix with the locale segment: the profile
    // now lives at `/account`, not `/uz/account`.
    //
    // `/admin`, `/director` and `/seller` are the three internal panels —
    // each already ships its own `robots: { index: false }` in its root
    // layout, but that only stops indexing; a crawler still spends budget
    // fetching every route under them without this. Each panel's own sign-in
    // screen lives inside its prefix now (`/director/login`,
    // `/seller/login`), so no separate `/login` entry is needed for it.
    // `/field-preview` is a throwaway component harness, not meant for a
    // search result either.
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/account", "/api/", "/admin", "/director", "/seller", "/field-preview"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
