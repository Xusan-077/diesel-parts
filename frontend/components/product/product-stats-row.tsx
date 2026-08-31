import { ShoppingCart } from "lucide-react";
import { StarRating } from "./star-rating";
import { Icon } from "@/components/ui/icon";
import { formatCount, type ProductStats } from "@/lib/product-stats";
import { cn } from "@/lib/utils";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";

/**
 * The card's social-proof line: what buyers scored the part, how many said so,
 * and how many have actually been ordered.
 *
 * Reads as one spec line rather than three badges — a parts catalog is a table
 * of numbers, so the figures are set in tabular figures and line up card to
 * card down the grid.
 *
 * `placeholder` decides what an unreviewed part says, and the two callers want
 * opposite things. A catalog card takes the placeholder: every card in a grid
 * carries the same line in the same place, and a row that vanishes on the
 * unreviewed parts leaves the grid looking ragged and the reader unsure whether
 * the score is missing or bad. The product page does not: there, the reviews
 * are the section below and "0.0" above them would be a verdict nobody gave.
 */
export function ProductStatsRow({
  stats,
  lang,
  dict,
  placeholder = false,
  className,
}: {
  stats: ProductStats;
  lang: Locale;
  dict: Dictionary["product"];
  /** Say "0.0 · no reviews" rather than rendering nothing. */
  placeholder?: boolean;
  className?: string;
}) {
  const { rating, reviewCount, soldCount } = stats;
  const rated = rating !== null && reviewCount > 0;

  if (!rated && soldCount === 0 && !placeholder) {
    return null;
  }

  const showRating = rated || placeholder;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted",
        className
      )}
    >
      {showRating ? (
        <>
          <StarRating
            rating={rating ?? 0}
            label={dict.ratingLabel.replace("{rating}", (rating ?? 0).toFixed(1))}
          />
          <span className="font-medium tabular-nums text-foreground">
            {(rating ?? 0).toFixed(1)}
          </span>
          <span className="tabular-nums">
            {dict.reviewCount.replace("{count}", formatCount(reviewCount, lang))}
          </span>
        </>
      ) : null}

      {/*
        No separator between the two. On a narrow card the block wraps and a
        middle dot ends up dangling at the end of a line with nothing after it;
        the cart glyph below already marks where the score stops and the order
        count starts, which is what a separator was for.
      */}
      {soldCount > 0 ? (
        <span className="inline-flex items-center gap-1 tabular-nums">
          {/* The glyph is what makes this figure an *order* count at a glance,
              rather than another number in a line of numbers. */}
          <Icon icon={ShoppingCart} size="xs" aria-hidden />
          {dict.orderedCount.replace("{count}", formatCount(soldCount, lang))}
        </span>
      ) : null}
    </div>
  );
}
