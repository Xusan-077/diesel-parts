"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AdminNavItem } from "@/lib/auth/admin-nav";

/**
 * The panel's spine.
 *
 * One hairline rule runs the height of the navigation, and the active section is
 * marked by a solid brand-orange segment on that same rule — the only colour in
 * the chrome, and it only ever means "you are here". The label also changes
 * weight and ink, so the state is never carried by colour alone.
 */
export function PanelNav({ items }: { items: AdminNavItem[] }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Panel bo'limlari" className="border-l border-border">
      <ul>
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

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
                className={`block py-2 pl-4 text-sm transition-colors ${
                  active
                    ? "font-medium text-foreground"
                    : "text-muted hover:text-foreground"
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
