import type { Dictionary } from "@/lib/i18n/dictionaries";

export interface BreadcrumbItem {
  label: string;
  /** Absent on the last crumb, which is the page you are already on. */
  href?: string;
}

/**
 * The trail for a route whose every segment names itself.
 *
 * A path is only enough to build a breadcrumb when its segments are known
 * words. `/delivery` is; `/products/cat-fuel-injector-3126` is not — the
 * segment there is a slug, and printing it would put "cat-fuel-injector-3126"
 * on the page where the product's name belongs. So this resolves the static
 * routes and returns nothing for the rest, which supply their own trail from
 * the data they already loaded.
 *
 * Keeping that decision here rather than in the component is what makes it
 * testable without a router.
 */
export function staticRouteLabels(dict: Dictionary): Record<string, string> {
  return {
    products: dict.nav.allProducts,
    brands: dict.nav.brands,
    // No `categories` entry: the catalogue has /categories/[slug] but no
    // index, so naming that segment would put a link to a 404 in a trail.
    partnership: dict.nav.partnership,
    services: dict.nav.services,
    delivery: dict.nav.delivery,
    payment: dict.nav.payment,
    about: dict.nav.about,
    contact: dict.nav.contacts,
    blog: dict.blog.title,
    cart: dict.cart.title,
    wishlist: dict.wishlist.title,
    compare: dict.compare.title,
    account: dict.account.profileTitle,
    "request-quote": dict.requestQuote.title,
  };
}

/** Splits a pathname into its segments, tolerating trailing slashes. */
export function pathSegments(pathname: string): string[] {
  return pathname.split("/").filter((segment) => segment.length > 0);
}

export interface BuildOptions {
  pathname: string;
  homeLabel: string;
  labels: Record<string, string>;
}

/**
 * Builds the trail for a path, or returns `null` when it cannot name every
 * segment.
 *
 * `null` and `[]` mean different things and both happen: `[]` is the home
 * page, which has no trail and is not supposed to show one, and `null` is a
 * route this cannot describe — a product, a brand, a blog post — where the
 * page itself renders a richer trail. Returning a half-built trail for those
 * would race the page's own and show two.
 */
export function buildBreadcrumbs({
  pathname,
  homeLabel,
  labels,
}: BuildOptions): BreadcrumbItem[] | null {
  const segments = pathSegments(pathname);
  if (segments.length === 0) {
    return [];
  }

  const items: BreadcrumbItem[] = [{ label: homeLabel, href: "/" }];

  let href = "";
  for (const segment of segments) {
    const label = labels[segment];
    if (label === undefined) {
      return null;
    }
    href += `/${segment}`;
    items.push({ label, href });
  }

  return finalise(items);
}

/**
 * Drops the `href` from the last crumb.
 *
 * The final crumb is the page the reader is on, and a link to where you
 * already are is a link that does nothing. Applied centrally so a page
 * assembling its own trail cannot forget it.
 */
export function finalise(items: readonly BreadcrumbItem[]): BreadcrumbItem[] {
  return items.map((item, index) =>
    index === items.length - 1 ? { label: item.label } : { ...item }
  );
}
