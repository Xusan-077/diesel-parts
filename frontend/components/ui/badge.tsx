import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
  {
    variants: {
      /*
       * These were emerald-400 / red-400 on a 15%-alpha tint — values picked
       * for a dark surface, which left them at ~1.9:1 in light mode. The
       * tokens below carry a separate light and dark cast so both themes
       * clear 4.5:1.
       */
      variant: {
        default: "bg-surface-hover text-foreground",
        success: "bg-success-surface text-success",
        warning: "bg-warning-surface text-warning",
        danger: "bg-danger-surface text-danger",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.ComponentProps<"span">,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
