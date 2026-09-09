"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/director/warehouse/reports/stock", label: "Qoldiqlar" },
  { href: "/director/warehouse/reports/movements", label: "Harakatlar" },
  { href: "/director/warehouse/reports/low-stock", label: "Kam qolganlar" },
] as const;

/**
 * The three warehouse reports, as a segmented control under the page header —
 * one recessed strip so they read as views of one thing, not three pages that
 * happen to be near each other.
 */
export function ReportsTabs() {
  const pathname = usePathname();

  return (
    <div className="inline-flex rounded-lg border border-border bg-surface-muted/60 p-1">
      {TABS.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm transition-colors",
              active
                ? "bg-surface text-foreground shadow-xs"
                : "text-muted hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
