import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A titled section on the `panel` recipe — the seller panel's counterpart to
 * the director's PanelCard. Same title / description / action / children
 * contract so a screen reads the same in both panels; built on the shared
 * `panel` utility rather than shadcn's Card, which the seller panel does not
 * ship.
 */
export function SectionCard({
  title,
  description,
  meta,
  action,
  className,
  bodyClassName,
  children,
}: {
  title?: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  action?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  const hasHeader = title || description || meta || action;

  return (
    <section className={cn("panel flex min-w-0 flex-col", className)}>
      {hasHeader ? (
        <div className="mb-6 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <div className="min-w-0 space-y-1">
            {title ? <h2 className="type-title text-foreground">{title}</h2> : null}
            {description ? <p className="type-caption text-muted">{description}</p> : null}
          </div>
          {meta || action ? (
            <div className="flex shrink-0 items-center gap-3">
              {meta ? (
                <span className="type-eyebrow inline-flex h-5 items-center rounded-full bg-surface-muted px-2 text-muted">
                  {meta}
                </span>
              ) : null}
              {action}
            </div>
          ) : null}
        </div>
      ) : null}
      <div className={cn("min-w-0 flex-1", bodyClassName)}>{children}</div>
    </section>
  );
}
