import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The block every panel page opens with: which panel you are in, what this
 * screen is, and — when there is one — the screen's primary action.
 *
 * It was copied by hand onto seven pages, and had drifted: the eyebrow sat at
 * `mt-1` on four of them and `mt-2` on the rest, the description was `mt-1`
 * here and `mt-2` there, and the `<h1>` carried its type as three loose
 * utilities rather than the `type-page` step. One component, one rhythm.
 *
 * Server-safe on purpose — no state, no `"use client"` — so a Server Component
 * page keeps its whole tree on the server just to draw a heading.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow: string;
  title: ReactNode;
  /** One line under the title. Prose, or a count — not both. */
  description?: ReactNode;
  /** Right-aligned on a wide screen, wrapping under the title on a narrow one. */
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        <p className="type-eyebrow text-muted">{eyebrow}</p>
        {/* 4px under the eyebrow: the two lines are one unit, and anything
            larger reads as a heading with a stray caption above it. */}
        <h1 className="type-page mt-1 text-foreground">{title}</h1>
        {description ? (
          <p className="type-body mt-2 max-w-prose text-muted">{description}</p>
        ) : null}
      </div>

      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </header>
  );
}
