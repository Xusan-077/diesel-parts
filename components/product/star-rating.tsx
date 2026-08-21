import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { MAX_RATING, starFill } from "@/lib/product-stats";

/**
 * Five stars, filled to the nearest half.
 *
 * Deliberately *not* gold. This palette gives the brand orange exactly one
 * job — "you can act on this, or you are here" — and states that it is never a
 * status (see globals.css). A row of amber stars would put the accent colour
 * on a read-only verdict and land it next to the orange price and the orange
 * add-to-cart button, three different meanings in one card. Monochrome stars
 * read as data, which is what they are, and leave the accent to the control
 * the visitor is meant to press.
 *
 * The half star is one glyph clipped to its own width, so it stays a real star
 * outline at every size rather than a rectangle with a point on it.
 */
export function StarRating({
  rating,
  label,
  className,
}: {
  rating: number;
  /** Accessible sentence, e.g. "5 tadan 4.5". The stars themselves are decor. */
  label: string;
  className?: string;
}) {
  const { full, half } = starFill(rating);

  return (
    <span
      role="img"
      aria-label={label}
      className={cn("inline-flex items-center gap-0.5", className)}
    >
      {Array.from({ length: MAX_RATING }, (_, index) => {
        const isFull = index < full;
        const isHalf = !isFull && half && index === full;

        return (
          <span key={index} aria-hidden className="relative inline-flex">
            <Star className="h-3.5 w-3.5 shrink-0 stroke-[1.5] text-border-strong" />
            {isFull || isHalf ? (
              <span
                className="absolute inset-0 overflow-hidden"
                style={isHalf ? { width: "50%" } : undefined}
              >
                <Star className="h-3.5 w-3.5 shrink-0 fill-current stroke-[1.5] text-foreground" />
              </span>
            ) : null}
          </span>
        );
      })}
    </span>
  );
}
