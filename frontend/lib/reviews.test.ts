import { describe, expect, it } from "vitest";
import {
  formatReviewDate,
  mergeOwnReview,
  REVIEW_BODY_MAX,
  REVIEW_BODY_MIN,
  validateReviewDraft,
  type PublicReview,
} from "./reviews";

function draft(patch: Partial<Parameters<typeof validateReviewDraft>[0]> = {}) {
  return {
    rating: 5,
    body: "Ishonchli detal, uch oydan beri muammosiz.",
    authorName: "Anvar",
    ...patch,
  };
}

describe("validateReviewDraft", () => {
  it("accepts a complete draft", () => {
    expect(validateReviewDraft(draft())).toEqual([]);
  });

  it("rejects a missing or out-of-range rating", () => {
    expect(validateReviewDraft(draft({ rating: 0 }))).toContain("rating");
    expect(validateReviewDraft(draft({ rating: 6 }))).toContain("rating");
    expect(validateReviewDraft(draft({ rating: Number.NaN }))).toContain("rating");
  });

  it("rejects half stars — the column stores whole ones", () => {
    expect(validateReviewDraft(draft({ rating: 4.5 }))).toContain("rating");
  });

  it("rejects a body under the floor", () => {
    expect(validateReviewDraft(draft({ body: "zo'r" }))).toContain("body_short");
  });

  it("counts the trimmed length, so whitespace cannot pad a body", () => {
    const padded = `${" ".repeat(40)}zo'r${" ".repeat(40)}`;
    expect(validateReviewDraft(draft({ body: padded }))).toContain("body_short");
  });

  it("accepts a body at exactly the floor", () => {
    expect(validateReviewDraft(draft({ body: "a".repeat(REVIEW_BODY_MIN) }))).toEqual([]);
  });

  it("accepts a body at exactly the ceiling and rejects one past it", () => {
    expect(validateReviewDraft(draft({ body: "a".repeat(REVIEW_BODY_MAX) }))).toEqual([]);
    expect(validateReviewDraft(draft({ body: "a".repeat(REVIEW_BODY_MAX + 1) }))).toContain(
      "body_long"
    );
  });

  it("rejects a name of nothing but spaces", () => {
    expect(validateReviewDraft(draft({ authorName: "   " }))).toContain("name");
  });

  /*
   * The form prints every complaint at once. Reporting only the first would
   * make one mistake cost two trips.
   */
  it("reports every problem, not the first", () => {
    expect(validateReviewDraft({ rating: 0, body: "", authorName: "" }).sort()).toEqual([
      "body_short",
      "name",
      "rating",
    ]);
  });
});

describe("formatReviewDate", () => {
  it("writes a zero-padded day and month so the column lines up", () => {
    expect(formatReviewDate("2026-03-02T10:00:00.000Z")).toMatch(/^\d{2}\.\d{2}\.2026$/);
  });

  it("keeps the same order for every locale", () => {
    expect(formatReviewDate("2026-12-25T00:00:00.000Z")).toContain("2026");
  });

  it("returns an empty string for a value that is not a date", () => {
    expect(formatReviewDate("not a date")).toBe("");
  });
});

describe("mergeOwnReview", () => {
  const existing: PublicReview[] = [
    { id: "a", rating: 5, body: "A", authorName: "A", createdAt: "2026-03-02T00:00:00.000Z" },
    { id: "b", rating: 4, body: "B", authorName: "B", createdAt: "2026-03-01T00:00:00.000Z" },
  ];

  it("puts a first review at the top, where newest-first would place it", () => {
    const own: PublicReview = {
      id: "c",
      rating: 3,
      body: "C",
      authorName: "C",
      createdAt: "2026-03-03T00:00:00.000Z",
      isMine: true,
    };

    expect(mergeOwnReview(existing, own).map((review) => review.id)).toEqual(["c", "a", "b"]);
  });

  /*
   * The unique index means a second submission is a rewrite. Appending it
   * would show one person twice until the refetch landed and then silently
   * drop a row, which reads as a glitch.
   */
  it("replaces a rewrite in place rather than adding a second entry", () => {
    const own: PublicReview = { ...existing[1], rating: 1, body: "Fikrim o'zgardi", isMine: true };
    const merged = mergeOwnReview(existing, own);

    expect(merged).toHaveLength(2);
    expect(merged.map((review) => review.id)).toEqual(["a", "b"]);
    expect(merged[1].body).toBe("Fikrim o'zgardi");
  });

  it("does not mutate the list it was given", () => {
    const own: PublicReview = { ...existing[0], body: "changed" };
    mergeOwnReview(existing, own);
    expect(existing[0].body).toBe("A");
  });
});
