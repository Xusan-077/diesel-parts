"use client";

import type { ReactNode } from "react";
import { useScrollDirection } from "@/hooks/use-scroll-direction";
import { isHeaderCondensed } from "@/lib/scroll-direction";

/**
 * The sticky shell around the three header rows.
 *
 * Three rows of chrome is a lot to keep on screen while someone reads a spec
 * table, so the shell collapses the top bar — and, on a phone, the search row
 * — once the visitor is reading downwards, and brings them back the moment
 * they scroll up or return to the top.
 *
 * Only this component subscribes to scroll. Everything below it stays a
 * server component and reacts through the `data-condensed` attribute, which
 * the rows read with Tailwind's `group-data-[condensed]/header:` variant.
 *
 * The collapse animates `grid-template-rows` from `1fr` to `0fr` rather than a
 * hardcoded height, so nothing has to know how tall the top bar is and a
 * wrapped phone number cannot clip. `prefers-reduced-motion` already flattens
 * every transition in globals.css, so the rows simply snap for those visitors.
 */
export function HeaderShell({
  topbar,
  children,
}: {
  topbar: ReactNode;
  children: ReactNode;
}) {
  const condensed = isHeaderCondensed(useScrollDirection());

  return (
    <header
      data-condensed={condensed ? "" : undefined}
      className="group/header sticky top-0 z-50 border-b border-border bg-background"
    >
      <div className="grid grid-rows-[1fr] transition-[grid-template-rows] duration-300 ease-out group-data-[condensed]/header:grid-rows-[0fr]">
        <div className="overflow-hidden">{topbar}</div>
      </div>
      {children}
    </header>
  );
}
