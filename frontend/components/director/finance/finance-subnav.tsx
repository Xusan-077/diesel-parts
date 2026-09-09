"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";

/**
 * The finance module's own second row of navigation — the three tabs the
 * brief asks for. Quieter than the sidebar's active plate on purpose: the
 * sidebar answers "which section", this answers "which page inside it".
 * Same treatment as `WarehouseSubnav`, minus the "Tez orada" column (every
 * finance tab exists).
 */

interface Tab {
  href: string;
  label: string;
  /** Exact match — the finance routes do not nest. */
  match: string;
}

const TABS: readonly Tab[] = [
  { href: "/director/finance", label: "To'lovlar", match: "/director/finance" },
  { href: "/director/finance/expenses", label: "Xarajatlar", match: "/director/finance/expenses" },
  { href: "/director/finance/debts", label: "Qarzdorlik", match: "/director/finance/debts" },
];

function activeMatch(pathname: string): string | undefined {
  return TABS.map((tab) => tab.match)
    .filter((match) => pathname === match || pathname.startsWith(`${match}/`))
    .sort((a, b) => b.length - a.length)[0];
}

export function FinanceSubnav() {
  const pathname = usePathname();
  const active = activeMatch(pathname);
  const reduce = useReducedMotion();

  return (
    <nav
      aria-label="Moliya bo'limlari"
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
                layoutId="finance-subnav-underline"
                transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 40 }}
                className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent-strong"
              />
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
