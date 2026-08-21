import { NextResponse } from "next/server";
import { getProductsByIds } from "@/lib/api/product-repository";
import { MAX_PAGE_SIZE } from "@/lib/api/product-query";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/locales";

/**
 * Resolves localStorage-held product ids for the cart, wishlist and compare
 * list. Unknown ids are dropped rather than erroring: those lists outlive
 * catalog changes.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const params = new URL(request.url).searchParams;

  const ids = (params.get("ids") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0)
    // The same cap the catalog listing uses, so both read paths bound a
    // request the same way.
    .slice(0, MAX_PAGE_SIZE);

  if (ids.length === 0) {
    return NextResponse.json({ items: [] });
  }

  const rawLang = params.get("lang");
  const lang = rawLang !== null && isLocale(rawLang) ? rawLang : DEFAULT_LOCALE;

  return NextResponse.json({ items: await getProductsByIds(ids, lang) });
}
