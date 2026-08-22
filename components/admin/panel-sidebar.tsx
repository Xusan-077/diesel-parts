"use client";

import { ChevronLeft } from "lucide-react";
import { Icon } from "@/components/ui/icon";
import { BrandMark } from "@/components/layout/brand-mark";
import { PanelNav, type NavGroupView } from "./panel-nav";

/*
 * The head used to carry a `Monogram` — the initials "DP" in a boxed chip —
 * written when the panel had no logo file to point at. It does now: the same
 * `BrandMark` the storefront's header sets, which is drawn as paths rather
 * than linked as a PNG precisely so it can follow whatever foreground it is
 * placed on. Here that is the rail's ordinary `text-foreground`; the mark's
 * upper half keeps the brand red either way.
 *
 * Sized `h-7` rather than the header's `h-8`: the mark is wider than it is
 * tall (383×278), and at h-8 it measures 44px across, which does not fit the
 * 40px the collapsed 72px rail leaves between its gutters.
 */

/**
 * The panel's left edge.
 *
 * One component, two mounts: a permanent column on a desktop and the body of
 * the drawer on a phone. They render the same tree because they are the same
 * navigation — the previous version kept two copies and they had already
 * drifted on which controls each one carried.
 *
 * The collapse belongs to the desktop mount only. In a drawer that is already
 * an overlay, folding it to a 72px strip of glyphs saves nothing and costs the
 * labels.
 */
export function PanelSidebar({
  brand,
  groups,
  navLabel,
  collapsed,
  onToggleCollapse,
  collapseLabel,
  onNavigate,
}: {
  brand: string;
  groups: NavGroupView[];
  navLabel: string;
  /** Omitted in the drawer, where there is nothing to collapse into. */
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  collapseLabel?: string;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="rail-head flex items-center justify-between gap-3 px-4 py-4">
        <span className="flex min-w-0 items-center gap-3 text-foreground">
          <BrandMark className="h-7" />
          <span className="rail-wide type-label truncate">{brand}</span>
        </span>

        {onToggleCollapse ? (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-expanded={collapsed === false}
            aria-label={collapseLabel}
            title={collapseLabel}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-border text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
          >
            <Icon icon={ChevronLeft} size="sm" className="rail-chevron" />
          </button>
        ) : null}
      </div>

      {/*
       * `overflow-y-auto` on the scroller and not on the aside: the aside is
       * the fixed element, and giving it its own scroll container is what
       * turns a pinned footer into one that scrolls away with the list.
       */}
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-6">
        <PanelNav
          groups={groups}
          label={navLabel}
          collapsed={collapsed}
          onNavigate={onNavigate}
        />
      </div>
    </div>
  );
}
