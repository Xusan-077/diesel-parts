import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * The one shape a set of product cards takes on a page.
 *
 * Above `md` it is the grid it always was — the caller still names its own
 * columns, so the catalog's three-up and a related row's four-up stay exactly
 * as they were. Below `md` it stops being a grid at all and becomes a
 * horizontal track: two 170px cards side by side on a phone left no room for a
 * price, a name and a control, and the second column was where every card's
 * name wrapped. One card at two-thirds of the screen reads at full size, and
 * the third of the next one showing past the edge is what says the set
 * continues — the same affordance the home page rows already use.
 *
 * Deliberately *one* set of children rather than a `hidden md:grid` grid beside
 * a `md:hidden` row. Two copies would mount every card twice: twice the DOM on
 * a 24-card catalog page, and two live copies of each card's gallery state and
 * cart subscription, of which the reader only ever sees one. A container that
 * changes its own display costs nothing and cannot drift between the two.
 *
 * The negative margin cancels `Container`'s phone gutter so the track runs to
 * both edges of the screen, and the matching padding puts the first card back
 * on the same line as the heading above it. `scroll-px-4` keeps a snapped card
 * off the edge it snapped to.
 */
export function ProductGrid({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-4 px-4 pb-1",
        // The half-visible card is the affordance; a scrollbar under a row of
        // cards is just a second one, and on touch it is drawn as an overlay
        // anyway.
        "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        "[&>*]:w-2/3 [&>*]:max-w-68 [&>*]:shrink-0 [&>*]:snap-start",
        "md:mx-0 md:grid md:snap-none md:gap-6 md:overflow-visible md:px-0 md:pb-0",
        "md:[&>*]:w-auto md:[&>*]:max-w-none",
        className
      )}
      {...props}
    />
  );
}
