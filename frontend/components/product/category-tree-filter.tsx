"use client";

import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Icon } from "@/components/ui/icon";
import { branchIndex, buildCategoryTree, type CategoryTreeNode } from "@/lib/catalog-tree";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import type { Category } from "@/lib/types";
import { cn } from "@/lib/utils";
import { filterRowClass, filterRowTone, ShowMoreList } from "./filter-section";

/** How many branches the panel shows before it offers the rest. */
const VISIBLE_BRANCHES = 6;

export interface CategoryTreeFilterProps {
  categories: Category[];
  lang: Locale;
  /** The selected category id, or "all". */
  value: string;
  onChange: (categoryId: string) => void;
  dict: Dictionary["catalog"];
}

/**
 * The catalog tree, as the thing you filter by.
 *
 * One category at a time, not a checkbox set. A part hangs off exactly one
 * category, so ticking two is a union the reader almost never means — and the
 * two-level menu already gives them the wider view: picking a branch searches
 * that branch and everything under it.
 *
 * Branches open and close independently of what is selected. Selecting a branch
 * does not close it, and opening one does not select it, because "show me what
 * is in here" and "filter by this" are different intentions and a control that
 * conflates them makes the second unreachable.
 */
export function CategoryTreeFilter({
  categories,
  lang,
  value,
  onChange,
  dict,
}: CategoryTreeFilterProps) {
  const tree = useMemo(() => buildCategoryTree(categories), [categories]);
  const branches = useMemo(() => branchIndex(tree), [tree]);

  /*
   * Only the branch holding the selection starts open, and it is re-derived
   * whenever the selection moves to a different branch — arriving with a filter
   * already set (a restored URL, a chip, the menu's own scope) has to show the
   * reader where they are. Everything the reader opens by hand is remembered
   * alongside it, so a manual open is never undone by a later selection.
   */
  const selectedBranch = branches.get(value);
  const [opened, setOpened] = useState<ReadonlySet<string>>(
    () => new Set(selectedBranch === undefined ? [] : [selectedBranch])
  );
  const [trackedBranch, setTrackedBranch] = useState(selectedBranch);

  if (trackedBranch !== selectedBranch) {
    setTrackedBranch(selectedBranch);
    if (selectedBranch !== undefined && !opened.has(selectedBranch)) {
      setOpened(new Set([...opened, selectedBranch]));
    }
  }

  function toggleBranch(id: string) {
    setOpened((current) => {
      const next = new Set(current);
      if (!next.delete(id)) {
        next.add(id);
      }
      return next;
    });
  }

  function renderBranch(node: CategoryTreeNode) {
    const isOpen = opened.has(node.id);
    const hasChildren = node.children.length > 0;

    return (
      <li key={node.id}>
        <div className={filterRowTone(value === node.id, "flex items-center")}>
          <button
            type="button"
            onClick={() => onChange(node.id)}
            aria-pressed={value === node.id}
            className="min-w-0 flex-1 truncate py-1.5 pl-2 pr-1 text-left"
          >
            {node.name[lang]}
          </button>

          {hasChildren ? (
            <button
              type="button"
              onClick={() => toggleBranch(node.id)}
              aria-expanded={isOpen}
              aria-label={dict.categoryExpand.replace("{label}", node.name[lang])}
              title={dict.categoryExpand.replace("{label}", node.name[lang])}
              className="flex size-7 shrink-0 items-center justify-center rounded-sm text-muted transition-colors hover:text-foreground"
            >
              <Icon
                icon={ChevronRight}
                size="xs"
                className={cn("transition-transform duration-200", isOpen && "rotate-90")}
              />
            </button>
          ) : (
            // Keeps the labels of childless branches aligned with the rest.
            <span className="size-7 shrink-0" aria-hidden />
          )}
        </div>

        {hasChildren && isOpen ? (
          // The 1px rule down the left is the only thing marking depth: an
          // indent alone reads as a wobble once a name wraps.
          <ul className="ml-3 border-l border-border pl-1">
            {node.children.map((child) => (
              <li key={child.id}>
                <button
                  type="button"
                  onClick={() => onChange(child.id)}
                  aria-pressed={value === child.id}
                  className={filterRowClass(value === child.id, "w-full")}
                >
                  <span className="truncate">{child.name[lang]}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </li>
    );
  }

  return (
    <ShowMoreList
      items={tree}
      limit={VISIBLE_BRANCHES}
      moreLabel={`${dict.showMore} ({count})`}
      lessLabel={dict.showLess}
    >
      {(visible) => (
        <ul>
          {/* The way back out. Without a row for it, clearing the category
              means finding the chip above the grid or resetting everything. */}
          <li>
            <button
              type="button"
              onClick={() => onChange("all")}
              aria-pressed={value === "all"}
              className={filterRowClass(value === "all", "w-full")}
            >
              {dict.allCategories}
            </button>
          </li>
          {visible.map(renderBranch)}
        </ul>
      )}
    </ShowMoreList>
  );
}
