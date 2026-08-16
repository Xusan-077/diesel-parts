import * as React from "react";
import { cn } from "@/lib/utils";

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        // See input.tsx — the orange 1px ring it replaced failed the 3:1 floor
        // for focus indicators.
        "min-h-24 w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent-strong aria-invalid:border-danger",
        className
      )}
      {...props}
    />
  );
}
