import Link from "next/link";
import { cn } from "@/lib/utils";
import type { BreadcrumbItem } from "@/lib/breadcrumb";

/**
 * The trail from the home page to here.
 *
 * A `<nav>` wrapping an ordered list, which is what a breadcrumb is: the
 * order carries the meaning, so it is not a `<ul>`. The separators are drawn
 * by the list items rather than inserted as text nodes, so a screen reader
 * reads four place names instead of "Home slash Products slash".
 *
 * Stays a Server Component. Every caller already knows its own trail, so
 * there is nothing here worth a kilobyte of JavaScript.
 */
export function Breadcrumb({
  items,
  label,
  className,
}: {
  items: readonly BreadcrumbItem[];
  /** Names the landmark, e.g. "Sahifa yo'li". */
  label: string;
  className?: string;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <nav aria-label={label} className={cn("min-w-0", className)}>
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted">
        {items.map((item, index) => (
          <li
            key={`${item.label}-${index}`}
            className={cn(
              "flex min-w-0 items-center gap-1.5",
              // The separator belongs to the crumb that follows it, so the
              // first crumb has none and none can be left dangling at the end.
              index > 0 &&
                "before:text-border-strong before:content-['/'] before:[margin-inline-end:0.125rem]"
            )}
          >
            {item.href ? (
              <Link
                href={item.href}
                className="truncate transition-colors hover:text-accent-strong"
              >
                {item.label}
              </Link>
            ) : (
              // The page you are on: named, not linked, and marked as current
              // so a screen reader says where the trail ends.
              <span aria-current="page" className="truncate text-foreground">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/**
 * The same trail as structured data.
 *
 * Google prints a breadcrumb in the result snippet in place of the raw URL,
 * which on a catalog of slug-named parts is the difference between a result
 * reading "dieselparts.uz › Forsunkalar › CAT" and one reading
 * "dieselparts.uz/products/cat-fuel-injector-3126".
 */
export function BreadcrumbJsonLd({ items }: { items: readonly BreadcrumbItem[] }) {
  if (items.length === 0) {
    return null;
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.label,
      ...(item.href ? { item: item.href } : {}),
    })),
  };

  return (
    // Same escaping as ProductJsonLd: `JSON.stringify` leaves `<` alone, so a
    // product name containing `</script>` would close the tag early.
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
    />
  );
}
