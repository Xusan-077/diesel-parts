import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site-config";


export default function robots(): MetadataRoute.Robots {
  return {
    // Account pages are per-user and behind a session; keep crawlers out.
    rules: { userAgent: "*", allow: "/", disallow: ["/*/account", "/api/"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
