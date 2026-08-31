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
         *
         * Hover and active are tokens, not `bg-accent/90`. An alpha fill
         * composites against the page, so it moved the button *towards* the
         * background — lighter in light mode, darker in dark, which is
         * backwards in one of the two. `--accent-hover` is defined as the
         * same mix in the panel (identical pixels there) and as a measured
         * hex on the marketing site, where it steps away from the page.
         */
        default:
          "border border-accent-edge bg-accent text-accent-foreground hover:bg-accent-hover active:bg-accent-active",
        outline:
          "border border-border-strong text-foreground hover:bg-surface-hover",
        ghost: "border border-transparent text-foreground hover:bg-surface-hover",
        /*
         * The only filled button that is not the brand orange. Destructive
         * actions are the one place the panel's "orange means you can act on
         * this" rule is not enough — every button on the screen means you can
         * act on it, and exactly one of them cannot be undone.
         *
         * `--danger` is deep enough (9.31:1 light, and the dark value is tuned
         * against its own surface) that the label is set in the surface colour
         * rather than the foreground, so the fill reads as a solid block
         * instead of dark-on-dark.
         */
        danger:
          "border border-danger bg-danger text-surface hover:bg-danger/90",
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
