import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The block every seller page opens with: which panel you are in, what this
 * screen is, and — when there is one — the screen's primary action.
 *
 * A hand copy of the director panel's PageHeader (components/admin/page-header.tsx):
 * the two panels are one product, so the eyebrow tick, the `type-page` title
 * and the closing hairline are the same on both. The eyebrow reads
 * "Sotuvchi paneli" here rather than "Direktor paneli" — the location is the
 * one thing that differs.
 */
export function PageHeader({
  title,
  description,
  actions,
  eyebrow = "Sotuvchi paneli",
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: string;
  className?: string;
}) {
  return (
    <header className={cn("border-b border-border pb-6", className)}>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          <p className="type-eyebrow flex items-center gap-2 text-muted">
            <span aria-hidden="true" className="h-3 w-0.5 shrink-0 bg-accent-strong" />
            {eyebrow}
          </p>
          <h1 className="type-page mt-1 text-foreground">{title}</h1>
          {description ? (
            <p className="type-body mt-2 max-w-prose text-muted">{description}</p>
          ) : null}
        </div>

        {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
      </div>
    </header>
  );
}
