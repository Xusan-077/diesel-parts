"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

/**
 * One filter group: a heading that opens and closes, and its control.
 *
 * `<details>` rather than a state hook and a div. It is the element that means
 * this, it is keyboard-operable and announced correctly without a line of ARIA,
 * and — the reason that matters here — its contents are findable by the
 * browser's own find-in-page even while collapsed.
 *
 * Every group opens by default. A panel that arrives shut hides the fact that
 * there are filters at all, which is the opposite of the problem the sidebar
 * exists to solve; being able to shut the ones you are done with is what the
 * accordion buys, on a rail where the brand and category lists run long.
 */
export function FilterSection({
  label,
  toggleLabel,
  children,
}: {
  label: string;
  /** Sentence for the summary, e.g. "Expand or collapse Brand". */
  toggleLabel: string;
  children: ReactNode;
}) {
  return (
    <details open className="group/filter border-b border-border pb-3 last:border-b-0 last:pb-0">
      <summary
        title={toggleLabel}
        className="flex cursor-pointer list-none items-center justify-between rounded-sm py-2 [&::-webkit-details-marker]:hidden"
      >
        <h3 className="type-eyebrow text-muted transition-colors group-open/filter:text-foreground">
          {label}
        </h3>
        <Icon
          icon={ChevronDown}
          size="xs"
          aria-hidden
          className="text-muted transition-transform duration-200 group-open/filter:rotate-180"
        />
      </summary>
      <div className="mt-1">{children}</div>
    </details>
  );
}

/**
 * A long list, shown short.
 *
 * Two dozen categories and every brand in the catalog would each fill a screen
 * on their own, and a reader who has to scroll past one to reach the other
 * cannot see that the second exists. Cutting both to a handful keeps the whole
 * panel readable at a glance; the count on the toggle says what is being held
 * back, so opening it is a decision rather than a gamble.
 *
 * The cut-off list is rendered, not hidden with CSS: the point is that the rows
 * are not there yet, and a `display: none` row still answers find-in-page and
 * still takes tab focus.
 */
export function ShowMoreList<T>({
  items,
  limit,
  moreLabel,
  lessLabel,
  children,
  className,
}: {
  items: readonly T[];
  /** How many rows to show while collapsed. */
  limit: number;
  /** Carries `{count}` — how many rows are still held back. */
  moreLabel: string;
  lessLabel: string;
  children: (visible: T[]) => ReactNode;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const overflows = items.length > limit;
  const visible = expanded || !overflows ? [...items] : items.slice(0, limit);

  return (
    <div className={className}>
      {children(visible)}

      {overflows ? (
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="mt-1.5 text-sm text-accent-strong transition-opacity hover:underline"
        >
          {expanded
            ? lessLabel
            : moreLabel.replace("{count}", String(items.length - limit))}
        </button>
      ) : null}
    </div>
  );
}

/**
 * How a selectable row is coloured, with none of its padding.
 *
 * The 2px left rail is the field treatment used across this codebase — see
 * `fieldRail` — so a selected filter, a focused input and a checked box all
 * mark themselves the same way. Unselected rows carry the rail in transparent
 * rather than dropping it, or every row would shift 2px sideways as the
 * selection moved down the list.
 *
 * Padding is left to whatever fills the row, because a branch in the category
 * tree is two controls sharing one row — a label and a chevron — and the
 * padding has to belong to the buttons so both are clickable edge to edge.
 */
export function filterRowTone(selected: boolean, className?: string): string {
  return cn(
    "rounded-sm border-l-2 text-sm transition-colors",
    selected
      ? "border-accent bg-accent-subtle font-medium text-accent-strong"
      : "border-transparent text-foreground hover:bg-surface-hover",
    className
  );
}

/** A row that is one control end to end: an option, a leaf, an availability. */
export function filterRowClass(selected: boolean, className?: string): string {
  return filterRowTone(
    selected,
    cn("flex w-full items-center gap-2 py-1.5 pl-2 pr-1.5 text-left", className)
  );
}
