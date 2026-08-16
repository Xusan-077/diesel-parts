import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        // The previous `focus:outline-none focus:ring-1 focus:ring-accent`
        // traded the UA outline for a 1px orange ring at 2.56:1 — below the
        // 3:1 floor for a focus indicator. The global :focus-visible ring in
        // globals.css covers this now; the border shift marks the field itself.
        "h-10 w-full rounded-md border border-border bg-transparent px-3 text-sm text-foreground placeholder:text-muted focus:border-accent-strong aria-invalid:border-danger",
        className
      )}
      {...props}
    />
  );
}
