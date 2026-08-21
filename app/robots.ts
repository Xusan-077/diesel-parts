import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site-config";


export default function robots(): MetadataRoute.Robots {
  return {
    // Account pages are per-user and behind a session; keep crawlers out.
    // The pattern lost its `/*/` prefix with the locale segment: the profile
    // now lives at `/account`, not `/uz/account`.
    rules: { userAgent: "*", allow: "/", disallow: ["/account", "/api/"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
