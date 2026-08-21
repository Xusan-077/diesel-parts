import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A titled block of a panel page, drawn as one card.
 *
 * Two things it exists to guarantee, both of which the hand-rolled sections
 * failed at:
 *
 * 1. **Equal height.** `h-full` means that in a grid — the dashboard's seller
 *    ranking beside its low-stock table — the two cards end on the same line
 *    whichever one has more rows, instead of one border stopping halfway up
 *    the other.
 * 2. **One padding.** Every section is `panel`'s 24px. The old sections mixed
 *    an unpadded block, a 20px box and a 24px box on the same screen.
 *
 * The heading is `type-title`, not the `text-sm font-semibold` the pages
 * carried, which was literally the same size as the body text beneath it.
 */
export function PanelSection({
  title,
  description,
  meta,
  action,
  className,
  bodyClassName,
  children,
}: {
  title: ReactNode;
  /** Standing guidance about the whole block. */
  description?: ReactNode;
  /** A figure that belongs to the title — a count, a total. Right-aligned. */
  meta?: ReactNode;
  /** A control for the block, sitting under the title on a narrow screen. */
  action?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("panel flex h-full min-w-0 flex-col", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="type-title text-foreground">{title}</h2>
        {meta ? <p className="type-caption font-mono text-muted">{meta}</p> : null}
        {action ? <div className="flex items-center gap-3">{action}</div> : null}
      </div>

      {description ? <p className="type-caption mt-1 text-muted">{description}</p> : null}

      {/* flex-1 so a short block still fills the card it shares a row with,
          and the card's own bottom padding stays where the grid put it. */}
      <div className={cn("mt-6 min-w-0 flex-1", bodyClassName)}>{children}</div>
    </section>
  );
}
