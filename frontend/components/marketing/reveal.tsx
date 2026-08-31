import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A section that rises into place as it is scrolled to.
 *
 * A Server Component, and a single class. The whole effect lives in
 * `.reveal` in globals.css, driven by a CSS scroll timeline — see the comment
 * there for why it is not an `IntersectionObserver`, which is a correctness
 * argument rather than a performance one.
 *
 * Eight stacked sections read as one long static document without it; this is
 * what acknowledges the scroll, on the same curve as the hero's own entrance so
 * the page has one motion vocabulary rather than two.
 */
export function Reveal({
  children,
  /**
   * Runs the section on a slightly later range, for the second half of a
   * heading-and-grid pair so the two do not arrive as one block.
   */
  late = false,
  className,
}: {
  children: ReactNode;
  late?: boolean;
  className?: string;
}) {
  return <div className={cn(late ? "reveal-late" : "reveal", className)}>{children}</div>;
}
