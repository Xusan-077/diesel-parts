import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Exported so a link can wear a button's clothes. The panel has anchors that
 * are actions — `tel:`, `mailto:`, a WhatsApp hand-off — and they have to stay
 * anchors: a button with an onClick loses the long-press menu and the middle
 * click that make those links useful on a phone.
 */
export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        /*
         * The brand orange is 2.56:1 against white — under the 3:1 WCAG 1.4.11
         * asks of a control's boundary. The 1px accent-edge (3.53:1) makes the
         * button's shape perceivable without altering the brand colour itself.
         * Outline carries border-strong for the same reason: on that variant
         * the border is the only thing that says "control". Ghost takes a
         * transparent border so all three keep identical metrics.
         */
        default:
          "border border-accent-edge bg-accent text-accent-foreground hover:bg-accent/90",
        outline:
          "border border-border-strong text-foreground hover:bg-surface-hover",
        ghost: "border border-transparent text-foreground hover:bg-surface-hover",
      },
      size: {
        default: "h-10 px-4",
        sm: "h-8 px-3 text-xs",
        lg: "h-12 px-6 text-base",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ComponentProps<"button">,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <button className={cn(buttonVariants({ variant, size }), className)} {...props} />
  );
}
