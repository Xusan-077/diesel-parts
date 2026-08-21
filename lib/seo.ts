import type { Metadata } from "next";

/**
 * Canonical URL for one page.
 *
 * This has to be set per page rather than once in the layout: Next.js passes a
 * layout's `alternates` down to every page that does not define its own, so a
 * single canonical in the layout would tell crawlers that all 20 pages are the
 * home page.
 *
 * There is no `languages` map any more. The locale left the URL when it moved
 * into the language store, so all three translations of a page now share one
 * address and there is no alternate URL to point an `hreflang` at; emitting one
 * would claim a URL that does not exist. The cost is real — crawlers index
 * whichever language the cookie-less request renders, which is Uzbek — and it
 * is the trade the URL-free design makes.
 *
 * @param path Route below the origin, e.g. `/products`. Empty for home.
 */
export function canonicalPath(path = ""): Metadata["alternates"] {
  return { canonical: path === "" ? "/" : path };
}
