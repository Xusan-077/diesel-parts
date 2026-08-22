import { NextResponse } from "next/server";
import { homeRowSize, readHomeProducts } from "@/lib/api/home-products";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/lib/i18n/locales";

/**
 * The home page's three product rows, for every read after the first.
 *
 * The first one does not come through here: the page seeds React Query from its
 * own server render, so the cards are in the HTML a crawler is served. This is
 * what the rows refetch against once that seed goes stale, and what a "try
 * again" press after a failure calls.
 *
 * A failed catalog read answers 503 rather than an empty 200, for the same
 * reason `/api/catalog` does: an empty row looks like a shop with nothing in
 * it, while a refusal is something the row can show a retry button for.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const params = new URL(request.url).searchParams;
  const rawLang = params.get("lang");
  const lang: Locale = rawLang !== null && isLocale(rawLang) ? rawLang : DEFAULT_LOCALE;

  try {
    return NextResponse.json(await readHomeProducts(homeRowSize(params.get("limit")), lang));
  } catch (error) {
    console.error("[api/products/home] failed to read the home collections:", error);
    return NextResponse.json({ error: "products_unavailable" }, { status: 503 });
  }
}
