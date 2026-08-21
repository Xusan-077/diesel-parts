/**
 * The three social-proof figures a catalog card carries: what buyers thought,
 * how many said so, and how many parts have actually left the shelf.
 *
 * Pure, and deliberately separate from the repository: the rounding and the
 * "no data yet" rules are the parts worth testing, and neither needs a
 * database to exercise.
 */

export interface ProductStats {
  /** Mean of approved ratings, to one decimal — or `null` when there are none. */
  rating: number | null;
  /** Approved reviews only. Zero is a real answer and is rendered as such. */
  reviewCount: number;
  /** Units sold across completed orders. */
  soldCount: number;
}

export const EMPTY_STATS: ProductStats = {
  rating: null,
  reviewCount: 0,
  soldCount: 0,
};

export const MIN_RATING = 1;
export const MAX_RATING = 5;

/**
 * Averages whole-star ratings to one decimal.
 *
 * `null` rather than `0` for an unrated product: zero stars is a verdict, and
 * a part nobody has reviewed has not received one. The card renders the two
 * cases differently for exactly that reason.
 */
export function averageRating(ratings: readonly number[]): number | null {
  const valid = ratings.filter(
    (value) => Number.isFinite(value) && value >= MIN_RATING && value <= MAX_RATING
  );
  if (valid.length === 0) {
    return null;
  }
  const mean = valid.reduce((sum, value) => sum + value, 0) / valid.length;
  return Math.round(mean * 10) / 10;
}

/**
 * How a rating fills five stars: how many are whole, whether one is half, and
 * how many stay empty. Rounding to the nearest half is what keeps 4.3 and 4.7
 * from drawing the same row.
 */
export interface StarFill {
  full: number;
  half: boolean;
  empty: number;
}

export function starFill(rating: number | null): StarFill {
  if (rating === null || !Number.isFinite(rating)) {
    return { full: 0, half: false, empty: MAX_RATING };
  }

  const clamped = Math.min(MAX_RATING, Math.max(0, rating));
  const halves = Math.round(clamped * 2);
  const full = Math.floor(halves / 2);
  const half = halves % 2 === 1;

  return { full, half, empty: MAX_RATING - full - (half ? 1 : 0) };
}

/**
 * Formats a count with a thousands separator, so "1 240 marta sotilgan" does
 * not read as a part number. Uses the same locale tags as `formatPrice`.
 */
export function formatCount(count: number, locale: string): string {
  return new Intl.NumberFormat(locale === "en" ? "en-US" : `${locale}-UZ`).format(
    Math.max(0, Math.trunc(count))
  );
}
