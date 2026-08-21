import { MAX_RATING, MIN_RATING } from "@/lib/product-stats";

/**
 * A published review, exactly as the browser is allowed to see it.
 *
 * `authorPhone` is absent by construction, not by omission: the type the
 * client speaks has no field for it, so a repository that widened its `select`
 * would fail to compile rather than quietly leaking a customer's number under
 * their opinion.
 */
export interface PublicReview {
  id: string;
  rating: number;
  body: string;
  authorName: string;
  /** ISO 8601. Formatted for display by `formatReviewDate`. */
  createdAt: string;
  /**
   * This review was written from the current session.
   *
   * Drives "your review" in the list and turns the form into an edit of an
   * existing entry rather than a second one that the unique index would refuse.
   */
  isMine?: boolean;
}

export const REVIEW_BODY_MIN = 10;
export const REVIEW_BODY_MAX = 1000;
export const REVIEW_AUTHOR_MAX = 60;

/** Reviews per request. A log is read a screen at a time, not all at once. */
export const REVIEWS_PAGE_SIZE = 5;

export type ReviewProblem = "rating" | "body_short" | "body_long" | "name";

/**
 * Checks a draft the way the API will, so the form can refuse before a round
 * trip and both sides can never disagree about what is acceptable.
 *
 * Returns every problem rather than the first, because a form shows all of its
 * complaints at once — telling someone their rating is missing, and only after
 * they fix it that their text is too short, is two trips for one mistake.
 */
export function validateReviewDraft(draft: {
  rating: number;
  body: string;
  authorName: string;
}): ReviewProblem[] {
  const problems: ReviewProblem[] = [];
  const body = draft.body.trim();

  if (
    !Number.isInteger(draft.rating) ||
    draft.rating < MIN_RATING ||
    draft.rating > MAX_RATING
  ) {
    problems.push("rating");
  }
  if (body.length < REVIEW_BODY_MIN) {
    problems.push("body_short");
  }
  if (body.length > REVIEW_BODY_MAX) {
    problems.push("body_long");
  }
  if (draft.authorName.trim().length === 0) {
    problems.push("name");
  }

  return problems;
}

/**
 * `12.03.2026`.
 *
 * Dots and a fixed order in every locale, rather than `toLocaleDateString`.
 * A review list is scanned down its date column, and a column where some rows
 * read `12.03.2026` and others `March 12, 2026` cannot be scanned at all —
 * the same reason the panel's figures are all tabular.
 */
export function formatReviewDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
}

/**
 * Folds a just-written review into a list already on screen.
 *
 * A submission is either a new entry or a rewrite of this person's existing
 * one — the unique index guarantees there is never more than one — so this
 * replaces in place when it finds a match and otherwise puts it at the top,
 * which is where the newest-first order the server uses would have placed it.
 *
 * Doing it here rather than refetching is what makes the review appear the
 * instant it is written; the refetch still follows, and because the server
 * applies the same rule the two can only ever agree.
 */
export function mergeOwnReview(
  reviews: readonly PublicReview[],
  own: PublicReview
): PublicReview[] {
  const index = reviews.findIndex((review) => review.id === own.id);
  if (index === -1) {
    return [own, ...reviews];
  }

  const next = [...reviews];
  next[index] = own;
  return next;
}
