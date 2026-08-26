"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  BookUser,
  ChevronDown,
  ClipboardList,
  Contact,
  FolderTree,
  History,
  Inbox,
  LayoutDashboard,
  Package,
  Percent,
  Star,
  Users,
  Warehouse,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { currentNavHref } from "@/lib/auth/admin-nav";
import type { NavGroupId } from "@/lib/admin/nav-groups";
import { Icon } from "@/components/ui/icon";

/**
 * The glyph each section is recognised by.
 *
 * Keyed here rather than on `ADMIN_NAV` on purpose: that list is authorisation
 * data, read by the route guard as well as by this component, and an icon is
 * not something the guard should have an opinion about. It also cannot travel
 * with the server's props — a component reference does not serialise — so the
 * href is the join. A section with no glyph falls back to a dot, so adding a
 * route can never render a hole.
 */
const GLYPH: Record<string, LucideIcon> = {
  "/director": LayoutDashboard,
  "/admin/seller": LayoutDashboard,
  "/director/products": Package,
  "/director/warehouse": Warehouse,
  "/director/customers": BookUser,
  "/director/categories": FolderTree,
  "/director/discounts": Percent,
  "/admin/seller/inquiries": Inbox,
  "/admin/seller/orders": ClipboardList,
  "/admin/seller/customers": Contact,
  "/director/users": Users,
  "/director/reviews": Star,
  "/director/audit": History,
};

export interface NavLink {
  href: string;
  label: string;
}

export interface NavGroupView {
  id: NavGroupId;
  label: string;
  items: NavLink[];
}

function NavRow({
  item,
  active,
  onNavigate,
}: {
  item: NavLink;
  active: boolean;
  onNavigate?: () => void;
}) {
  const glyph = GLYPH[item.href];

  return (
    <li>
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        onClick={onNavigate}
        /* `title` is the label when the rail is folded and the text is gone.
           Kept unconditionally: a tooltip on a labelled row is harmless, and a
           conditional one would need the rail's state in React, which is
           exactly the coupling the attribute-driven fold avoids. */
        title={item.label}
        className={
          "rail-row flex h-10 items-center gap-3 rounded-md px-3 text-sm transition-colors " +
          (active
            ? "nav-plate font-medium"
            : "border border-transparent text-muted hover:bg-surface-hover hover:text-foreground")
        }
      >
        {glyph ? (
          <Icon icon={glyph} size="sm" className={active ? "" : "text-muted"} />
        ) : (
          <span aria-hidden="true" className="h-1 w-1 shrink-0 rounded-full bg-current" />
        )}
        <span className="rail-wide truncate">{item.label}</span>
      </Link>
    </li>
  );
}

/**
 * The panel's spine.
 *
 * Four jobs, not ten links. The grouping comes from `groupNav`; what happens
 * here is the marking and the folding:
 *
 *   - the active row is a filled accent plate with its own 1px edge — the same
 *     material as the primary button, so "you are here" and "you can press
 *     this" read as one vocabulary. Redundant by construction: fill, edge,
 *     weight and `aria-current` all say it, so the state survives
 *     colour-blindness, forced-colors and a screen reader;
 *   - a group can be folded away, and the group holding the current page
 *     cannot — folding the section you are looking at hides the only row that
 *     was answering "where am I".
 *
 * A group of one renders bare. A heading over a single link names the only
 * thing under it, which is furniture.
 */
export function PanelNav({
  groups,
  label,
  collapsed = false,
  onNavigate,
}: {
  groups: NavGroupView[];
  /** The nav landmark's accessible name, from the panel dictionary. */
  label: string;
  /**
   * Whether the rail is folded to glyphs.
   *
   * Needed here and not only in CSS because of one reachability bug: the
   * control that unfolds a group is the group heading, and the heading is the
   * first thing the fold hides. Someone who closed "Katalog" and then
   * collapsed the rail would be left with three routes on screen and no way
   * back to the other three. Collapsing the rail therefore reopens every
   * group — there is no heading competing for the space any more, so nothing
   * is gained by keeping them shut.
   */
  collapsed?: boolean;
  /** Closes the drawer on a phone, where the nav sits over the page. */
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const [folded, setFolded] = useState<readonly NavGroupId[]>([]);

  const currentHref = useMemo(
    () =>
      currentNavHref(
        pathname,
        groups.flatMap((group) => group.items.map((item) => item.href)),
      ),
    [pathname, groups],
  );

  return (
    <nav aria-label={label} className="flex flex-col gap-6">
      {groups.map((group) => {
        // Folding the section you are looking at hides the only row that was
        // answering "where am I", so the current group cannot be closed either.
        const holdsCurrent = group.items.some((item) => item.href === currentHref);
        const open = collapsed || holdsCurrent || !folded.includes(group.id);

        if (group.items.length === 1) {
          return (
            <ul key={group.id} className="flex flex-col gap-1">
              <NavRow
                item={group.items[0]}
                active={group.items[0].href === currentHref}
                onNavigate={onNavigate}
              />
            </ul>
          );
        }

        return (
          <div key={group.id}>
            <button
              type="button"
              onClick={() =>
                setFolded((was) =>
                  was.includes(group.id)
                    ? was.filter((id) => id !== group.id)
                    : [...was, group.id],
                )
              }
              aria-expanded={open}
              aria-controls={"nav-group-" + group.id}
              /* `rail-wide`: with the rail folded there is no room for a
                 heading, and the rows below it stay reachable as glyphs. */
              className="rail-wide type-eyebrow mb-2 flex w-full items-center justify-between gap-2 rounded-sm px-3 text-muted transition-colors hover:text-foreground"
            >
              {group.label}
              <motion.span
                aria-hidden="true"
                animate={{ rotate: open ? 0 : -90 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                className="grid place-items-center"
              >
                <Icon icon={ChevronDown} size="xs" />
              </motion.span>
            </button>

            <AnimatePresence initial={false}>
              {open ? (
                <motion.div
                  id={"nav-group-" + group.id}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden"
                >
                  <ul className="flex flex-col gap-1">
                    {group.items.map((item) => (
                      <NavRow
                        key={item.href}
                        item={item}
                        active={item.href === currentHref}
                        onNavigate={onNavigate}
                      />
                    ))}
                  </ul>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        );
      })}
    </nav>
  );
}
