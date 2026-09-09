import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

/**
 * One shape for "nothing here" everywhere a table or list can come back empty.
 * Matches the director panel's EmptyState — disc icon, `type-title` headline,
 * `type-body` message — so the two panels handle emptiness the same way.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-surface-muted text-muted">
        <Icon aria-hidden="true" className="size-5" />
      </span>
      <div className="space-y-1">
        <p className="type-title text-foreground">{title}</p>
        {description ? <p className="type-body text-muted">{description}</p> : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
