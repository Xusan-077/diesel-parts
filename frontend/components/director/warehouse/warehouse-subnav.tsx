"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";

/**
 * The warehouse module's own second row of navigation.
 *
 * The sidebar is one flat list of sections with no room for a sub-tree, so the
 * warehouse area carries its tabs itself. Quieter than the sidebar's active
 * plate on purpose — the sidebar already answers "which section", this only
 * answers "which page inside it" — a hairline underline that slides between
 * tabs rather than a second filled surface competing with the spine.
 *
 * Phase 2 movements (write-off, transfer, inventory count) sit here disabled
 * with a "Tez orada" tag: the map of the module is visible before the roads
 * are built, but nothing dead is clickable.
 */

interface Tab {
  href: string;
  label: string;
  /** Longest-prefix match, so `/reports/stock` still lights "Hisobotlar". */
  match: string;
}

const TABS: readonly Tab[] = [
  { href: "/director/warehouse", label: "Boshqaruv", match: "/director/warehouse" },
  { href: "/director/warehouse/products", label: "Mahsulotlar", match: "/director/warehouse/products" },
  { href: "/director/warehouse/warehouses", label: "Omborlar", match: "/director/warehouse/warehouses" },
  { href: "/director/warehouse/incomes", label: "Qabullar", match: "/director/warehouse/incomes" },
  { href: "/director/warehouse/reports/stock", label: "Hisobotlar", match: "/director/warehouse/reports" },
];

const SOON: readonly string[] = ["Chiqim", "Ko'chirish", "Inventarizatsiya"];

function activeMatch(pathname: string): string | undefined {
  return TABS.map((tab) => tab.match)
    .filter((match) => pathname === match || pathname.startsWith(`${match}/`))
    .sort((a, b) => b.length - a.length)[0];
}

export function WarehouseSubnav() {
  const pathname = usePathname();
  const active = activeMatch(pathname);
  const reduce = useReducedMotion();

  return (
    <nav
      aria-label="Ombor bo'limlari"
      className="mt-6 flex flex-wrap items-center gap-x-1 gap-y-2 border-b border-border"
    >
      {TABS.map((tab) => {
        const isActive = tab.match === active;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            className={
              "relative px-3 pb-2.5 pt-1 text-sm transition-colors " +
              (isActive ? "text-foreground" : "text-muted hover:text-foreground")
            }
          >
            {tab.label}
            {isActive ? (
              <motion.span
                layoutId="warehouse-subnav-underline"
                transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 40 }}
                className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent-strong"
              />
            ) : null}
          </Link>
        );
      })}

      <span className="ml-auto hidden items-center gap-1.5 pb-2 pl-3 lg:flex">
        {SOON.map((label) => (
          <span
            key={label}
            aria-disabled="true"
            title="Tez orada"
            className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted/70"
          >
            {label}
            <span className="rounded-full bg-surface-muted px-1.5 py-0.5 text-[10px] font-medium text-muted">
              tez orada
            </span>
          </span>
        ))}
      </span>
    </nav>
  );
}
