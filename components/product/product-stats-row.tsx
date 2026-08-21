import { StarRating } from "./star-rating";
import { formatCount, type ProductStats } from "@/lib/product-stats";
import { cn } from "@/lib/utils";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";

/**
 * The card's social-proof line: what buyers scored the part, how many said so,
 * and how many have actually left the shelf.
 *
 * Reads as one spec line rather than three badges, matching the "brand ·
 * stock" line above it — a parts catalog is a table of numbers, so the figures
 * are set in tabular figures and line up card to card down the grid.
 *
 * An unreviewed part draws no stars. Five empty ones would read as a score of
 * zero, which is a verdict nobody gave; the row falls back to whatever it can
 * honestly say, and renders nothing at all when that is nothing.
 */
export function ProductStatsRow({
  stats,
  lang,
  dict,
  className,
}: {
  stats: ProductStats;
  lang: Locale;
  dict: Dictionary["product"];
  className?: string;
}) {
  const { rating, reviewCount, soldCount } = stats;
  const rated = rating !== null && reviewCount > 0;

  if (!rated && soldCount === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted",
        className
      )}
    >
      {rated ? (
        <>
          <StarRating
            rating={rating}
            label={dict.ratingLabel.replace("{rating}", rating.toFixed(1))}
          />
          <span className="font-medium tabular-nums text-foreground">
            {rating.toFixed(1)}
          </span>
          <span className="tabular-nums">
            {dict.reviewCount.replace("{count}", formatCount(reviewCount, lang))}
          </span>
        </>
      ) : null}

      {rated && soldCount > 0 ? (
        <span aria-hidden className="text-border-strong">
          ·
        </span>
      ) : null}

      {soldCount > 0 ? (
        <span className="tabular-nums">
          {dict.soldCount.replace("{count}", formatCount(soldCount, lang))}
        </span>
      ) : null}
    </div>
  );
}
