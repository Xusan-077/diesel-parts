import { StarRating } from "./star-rating";
import { formatReviewDate, type PublicReview } from "@/lib/reviews";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/utils";

/**
 * The reviews, as a workshop log.
 *
 * A review of a fuel injector is not a testimonial — it is a service record,
 * written by someone who fitted the part to a machine and watched it work. So
 * the list is set as a logbook rather than as a stack of cards: the date sits
 * in a ruled margin in tabular figures, where it is the index you scan down,
 * and the entry hangs off it. No avatars, no cards, no badges — none of them
 * carry information a buyer wants, and the initial-in-a-circle that stands in
 * for a photograph nobody uploaded is pure decoration.
 *
 * Below `sm` the margin would leave the text no room, so the date drops into
 * the byline. The ledger rule stays at every width: it is what makes the
 * column read as a log rather than as paragraphs.
 */
export function ReviewList({
  reviews,
  dict,
  productDict,
}: {
  reviews: readonly PublicReview[];
  dict: Dictionary["reviews"];
  /** Supplies the star row's accessible sentence, shared with the card. */
  productDict: Dictionary["product"];
}) {
  return (
    <ul className="flex flex-col">
      {reviews.map((review) => (
        <li
          key={review.id}
          className="grid gap-x-6 gap-y-1 py-5 first:pt-0 sm:grid-cols-[6rem_1fr]"
        >
          <p className="hidden font-mono text-xs tabular-nums text-muted sm:block">
            {formatReviewDate(review.createdAt)}
          </p>

          <div
            className={cn(
              "min-w-0 border-l pl-5 sm:pl-6",
              // The reader's own entry is marked on the ledger rule itself,
              // the same way the panel marks the section you are in. It is the
              // one place a colour is spent in this list.
              review.isMine ? "border-accent-strong" : "border-border"
            )}
          >
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <StarRating
                rating={review.rating}
                label={productDict.ratingLabel.replace("{rating}", String(review.rating))}
              />
              <span className="text-sm font-medium text-foreground">{review.authorName}</span>
              {review.isMine ? (
                <span className="type-eyebrow text-accent-strong">{dict.mine}</span>
              ) : null}
              <span className="font-mono text-xs tabular-nums text-muted sm:hidden">
                {formatReviewDate(review.createdAt)}
              </span>
            </div>

            <p className="mt-2 whitespace-pre-line text-pretty text-sm text-muted">
              {review.body}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
