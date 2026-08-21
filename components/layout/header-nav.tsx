"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { buildMainNav, isNavItemActive } from "@/lib/nav";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { Container } from "@/components/ui/container";

export function HeaderNav({ nav }: { nav: Dictionary["nav"] }) {
  const pathname = usePathname();
  const items = buildMainNav(nav);

  return (
    <nav className="hidden border-b border-border bg-surface-muted lg:block">
      <Container className="flex items-center gap-7">
        {items.map((item) => {
          const active = isNavItemActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "whitespace-nowrap border-b-2 py-2.5 text-sm transition-colors",
                active
                  ? "border-accent text-accent-strong"
                  : "border-transparent text-muted hover:text-foreground"
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </Container>
    </nav>
  );
}
