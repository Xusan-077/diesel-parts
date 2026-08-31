import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

/**
 * "Everything in this block, on its own page."
 *
 * A card on a dashboard shows the top few rows; the link is how a reader gets
 * the rest, and it belongs on the heading line because that is where they are
 * already looking when they decide the card is not enough. The arrow moves on
 * hover, which is the whole of the affordance — an underline here would put a
 * second rule beside the card's own.
 */
export function SeeAllLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="group type-label inline-flex items-center gap-1 text-accent-strong transition-colors hover:text-foreground"
    >
      {label}
      <Icon
        icon={ArrowRight}
        size="xs"
        className="transition-transform group-hover:translate-x-0.5"
      />
    </Link>
  );
}

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
        {/* A count that belongs to the heading, set as a chip on the recessed
            surface so it reads as an annotation on the title rather than as
            the first line of the block's content. */}
        {meta || action ? (
          /* One trailing slot, so a block that carries both a count and a
             "see all" does not have them arriving from opposite ends of the
             heading line. */
          <div className="flex items-center gap-3">
            {meta ? (
              <p className="type-eyebrow inline-flex h-5 items-center rounded-full bg-surface-muted px-2 text-muted">
                {meta}
              </p>
            ) : null}
            {action}
          </div>
        ) : null}
      </div>

      {description ? <p className="type-caption mt-1 text-muted">{description}</p> : null}

      {/* flex-1 so a short block still fills the card it shares a row with,
          and the card's own bottom padding stays where the grid put it. */}
      <div className={cn("mt-6 min-w-0 flex-1", bodyClassName)}>{children}</div>
    </section>
  );
}
