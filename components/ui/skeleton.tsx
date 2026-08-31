import * as React from "react";
import { cn } from "@/lib/utils";

/** A pulsing placeholder block. Height, width and border are the caller's —
 *  this only owns the fill and the animation. */
export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      aria-hidden
      className={cn("animate-pulse rounded-md bg-surface-muted", className)}
      {...props}
    />
  );
}
