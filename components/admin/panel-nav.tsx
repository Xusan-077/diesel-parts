"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { currentNavHref, type AdminNavItem } from "@/lib/auth/admin-nav";

/**
 * The panel's spine.
 *
 * One hairline rule runs the height of the navigation, and the active section
 * is marked on that same rule. The mark is the only colour in the chrome, and
 * it only ever means "you are here".
 *
 * A 2px stroke on its own was doing too much work: it clears 3:1 as a
 * graphical indicator (`--accent-strong` is 5.17:1 on light, 8.65:1 on dark),
 * but two pixels at the far edge of a 240px sidebar is easy to miss on a
 * glance, and hunting for it is exactly what a sidebar should never cost. It
 * now sits against an `--accent-subtle` tint that fills the row, so the state
 * has an area as well as an edge. Weight and ink still change too — the state
 * is never carried by colour alone.
 */
export function PanelNav({ items }: { items: AdminNavItem[] }) {
  const pathname = usePathname();
  const currentHref = currentNavHref(
    pathname,
    items.map((item) => item.href),
  );

  return (
    <nav aria-label="Panel bo'limlari" className="border-l border-border">
      <ul className="flex flex-col gap-1">
        {items.map((item) => {
          const active = item.href === currentHref;

          return (
            <li key={item.href} className="relative">
              {active ? (
                <span
                  aria-hidden="true"
                  className="absolute -left-px top-0 h-full w-0.5 bg-accent-strong"
                />
              ) : null}
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                /*
                 * `rounded-r-sm`: the tint is anchored to the spine, so its
                 * left edge stays square and the 2px mark lands flush on it
                 * instead of clipping a rounded corner.
                 */
                className={`block rounded-r-sm py-2 pr-3 pl-4 text-sm transition-colors ${
                  active
                    ? "bg-accent-subtle font-medium text-foreground"
                    : "text-muted hover:bg-surface-hover hover:text-foreground"
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
