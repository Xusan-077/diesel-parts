import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

/**
 * One shape for "nothing here" everywhere a table or list can come back empty.
 *
 * `message` alone is the quiet default for a secondary block. A primary block —
 * one a director opened the page to read — passes `title` as well, and `action`
 * when there is a way out of the empty state worth offering.
 */
export function EmptyState({
  icon: IconCmp,
  message,
  title,
  action,
}: {
  icon: LucideIcon;
  message: string;
  /** A headline above the message, for a primary empty block. */
  title?: string;
  /** A control offering the way forward — a link to where the data is entered. */
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-surface-muted text-muted">
        <IconCmp aria-hidden="true" className="size-5" />
      </span>
      <div className="space-y-1">
        {title ? <p className="type-title text-foreground">{title}</p> : null}
        <p className="type-body text-muted">{message}</p>
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
