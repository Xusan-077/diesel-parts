import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The heading that opens a block of a panel page.
 *
 * `level` is the block's rank in the page's hierarchy, and it is the whole of
 * what the prop changes:
 *
 *   1  a primary block — `type-section` (the <h2> step), foreground ink. The
 *      thing on the page a director is meant to read first after the hero.
 *   2  a secondary block — `type-title`, secondary ink. Pair it with the
 *      page's recessed ground (`bg-background-subtle`) so the block reads as
 *      supporting material rather than another headline.
 *
 * Server-safe: no state, no `"use client"`.
 */
export function SectionHeading({
  title,
  description,
  level = 1,
  actions,
  className,
}: {
  title: ReactNode;
  /** One line under the title. Standing guidance about the whole block. */
  description?: ReactNode;
  level?: 1 | 2;
  /** A control for the block, wrapping under the title on a narrow screen. */
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-end justify-between gap-x-6 gap-y-1",
        className,
      )}
    >
      <div className="min-w-0">
        <h2
          className={
            level === 1
              ? "type-section text-foreground"
              : "type-title text-secondary"
          }
        >
          {title}
        </h2>
        {description ? (
          <p className="type-caption mt-1 max-w-prose text-muted">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
