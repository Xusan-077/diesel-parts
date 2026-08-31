import type { ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ChevronRight, Inbox } from "lucide-react";
import { Icon } from "@/components/ui/icon";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * The nothing-here state.
 *
 * A centred glyph and one sentence, on the card's own surface. Not the dashed
 * `DataUnavailable` box, which says something went wrong — an empty stock
 * warning list is the best possible news and should not be drawn as a fault.
 *
 * `role="status"` rather than `alert`: a screen reader announces it on arrival
 * instead of interrupting.
 */
export function PanelListEmpty({
  message,
  icon = Inbox,
}: {
  message: string;
  icon?: LucideIcon;
}) {
  return (
    <div role="status" className="flex flex-col items-center justify-center gap-3 py-12">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-surface-muted">
        <Icon icon={icon} size="md" className="text-muted" />
      </span>
      <p className="type-body text-center text-muted">{message}</p>
    </div>
  );
}

export interface PanelListRow {
  id: string;
  /** The row's silhouette. Falls back to initials when a glyph would lie. */
  icon?: LucideIcon;
  /** Two letters, for a person or a company. Used when `icon` is absent. */
  initials?: string;
  title: string;
  /** The second line: a date, a SKU, whose customer it is. */
  meta?: ReactNode;
  /** The right-hand figure — a sum, a count. Set in the mono face. */
  value?: ReactNode;
  /** A quieter figure under the value. */
  valueMeta?: ReactNode;
  badge?: { label: string; variant?: BadgeProps["variant"] };
  /** Makes the whole row the link. */
  href?: string;
}

function Leading({ row }: { row: PanelListRow }) {
  if (row.icon) {
    return (
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-surface-muted">
        <Icon icon={row.icon} size="sm" className="text-muted" />
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-accent-edge bg-accent-subtle font-mono text-xs font-semibold text-accent-strong"
    >
      {row.initials ?? "—"}
    </span>
  );
}

function Row({ row }: { row: PanelListRow }) {
  const body = (
    <>
      <Leading row={row} />

      <span className="min-w-0 flex-1">
        <span className="type-label block truncate text-foreground">{row.title}</span>
        {row.meta ? (
          <span className="type-caption block truncate text-muted">{row.meta}</span>
        ) : null}
      </span>

      {row.value !== undefined ? (
        <span className="shrink-0 text-right">
          <span className="block font-mono text-sm font-medium tabular-nums text-foreground">
            {row.value}
          </span>
          {row.valueMeta ? (
            <span className="type-caption block text-muted">{row.valueMeta}</span>
          ) : null}
        </span>
      ) : null}

      {row.badge ? (
        <Badge variant={row.badge.variant} className="shrink-0">
          {row.badge.label}
        </Badge>
      ) : null}
    </>
  );

  const shared = "row-hover -mx-3 flex items-center gap-3 rounded-md px-3 py-2";

  return (
    <li>
      {row.href ? (
        <Link href={row.href} className={cn(shared, "group")}>
          {body}
          <Icon
            icon={ChevronRight}
            size="xs"
            className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5"
          />
        </Link>
      ) : (
        <div className={shared}>{body}</div>
      )}
    </li>
  );
}

/**
 * A card's contents as rows rather than as a table.
 *
 * The dashboard's blocks were a mix of a `<table>`, an ordered list of bars and
 * a bare paragraph, so three answers to the same question — "what is in this
 * card" — looked like three different kinds of object. A table earns its
 * columns when a reader compares down them; the low-stock block has four
 * columns and nobody reads down "SKU". What they do is scan for a name and
 * check one number beside it, which is a row.
 *
 * Every row is the same four slots, in the same order: mark, name, figure,
 * verdict. A row with nothing in a slot leaves it empty rather than shifting
 * the others along, so the figures stay in a column even though this is not a
 * table.
 */
export function PanelList({ rows }: { rows: PanelListRow[] }) {
  return (
    <ul className="flex flex-col">
      {rows.map((row) => (
        <Row key={row.id} row={row} />
      ))}
    </ul>
  );
}
