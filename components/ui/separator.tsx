import * as React from "react";
import { cn } from "@/lib/utils";

export interface SeparatorProps extends React.ComponentProps<"div"> {
  orientation?: "horizontal" | "vertical";
}

/** A static divider. No Radix primitive here — a line with no interaction
 *  and no state doesn't need one, just `role="separator"` for its meaning. */
export function Separator({ className, orientation = "horizontal", ...props }: SeparatorProps) {
  return (
    <div
      role="separator"
      aria-orientation={orientation}
      className={cn(
        orientation === "horizontal" ? "h-px w-full border-t border-border" : "h-full w-px border-l border-border",
        className,
      )}
      {...props}
    />
  );
}
