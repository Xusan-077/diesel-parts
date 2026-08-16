import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * The one horizontal rhythm for the site.
 *
 * Every page used to hard-code `mx-auto max-w-* px-6`, which meant the gutter
 * was a flat 24px from a 390px phone all the way up to a 1440px desktop — too
 * wide on mobile, too narrow beside a 1280px grid. The padding scale here is
 * the only place that ratio is decided.
 *
 * The widths are the ones the pages already used, kept as named intents so a
 * new page picks a reason rather than a number.
 */
const containerVariants = cva("mx-auto w-full px-4 sm:px-6 lg:px-8", {
  variants: {
    size: {
      /** Long-form reading measure: article bodies, single-column forms. */
      prose: "max-w-3xl",
      /** Short static pages — about, contact, blog index. */
      narrow: "max-w-4xl",
      /** Centred headers and mid-width lists. */
      content: "max-w-5xl",
      /** Two-column app screens such as the cart. */
      wide: "max-w-6xl",
      /** Catalog grids and every full-bleed marketing section. */
      default: "max-w-7xl",
    },
  },
  defaultVariants: {
    size: "default",
  },
});

export interface ContainerProps
  extends React.ComponentProps<"div">,
    VariantProps<typeof containerVariants> {
  /** Render as a different element, e.g. `main` or `section`. */
  as?: "div" | "main" | "section" | "header" | "footer" | "nav";
}

export function Container({ className, size, as: Tag = "div", ...props }: ContainerProps) {
  return <Tag className={cn(containerVariants({ size }), className)} {...props} />;
}

export { containerVariants };
