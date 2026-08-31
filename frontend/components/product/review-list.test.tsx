// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ReviewList } from "./review-list";
import type { PublicReview } from "@/lib/reviews";
import dictionary from "@/dictionaries/uz.json";

const dict = dictionary.reviews;
const productDict = dictionary.product;

function review(patch: Partial<PublicReview> = {}): PublicReview {
  return {
    id: "r-1",
    rating: 5,
    body: "320D ga o'rnatdim, muammosiz.",
    authorName: "Anvar",
    createdAt: "2026-03-02T09:00:00.000Z",
    ...patch,
  };
}

function renderList(reviews: PublicReview[]) {
  return render(<ReviewList reviews={reviews} dict={dict} productDict={productDict} />);
}

afterEach(cleanup);

describe("ReviewList", () => {
  it("renders one entry per review", () => {
    renderList([review(), review({ id: "r-2", authorName: "Bekzod" })]);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("prints the name, the words and the score", () => {
    renderList([review({ rating: 4 })]);

    expect(screen.getByText("Anvar")).toBeDefined();
    expect(screen.getByText("320D ga o'rnatdim, muammosiz.")).toBeDefined();
    expect(screen.getByRole("img").getAttribute("aria-label")).toBe(
      productDict.ratingLabel.replace("{rating}", "4")
    );
  });

  /*
   * The date is the index a log is scanned down, so it is written the same way
   * in every locale and zero-padded to a fixed width. It appears twice in the
   * markup — once in the margin, once in the byline — and CSS shows whichever
   * the viewport has room for.
   */
  it("writes the date in a fixed, zero-padded form", () => {
    renderList([review({ createdAt: "2026-03-02T09:00:00.000Z" })]);
    const dates = screen.getAllByText(/^\d{2}\.\d{2}\.2026$/);

    expect(dates.length).toBeGreaterThan(0);
  });

  it("marks the reader's own entry and leaves the others unmarked", () => {
    renderList([review({ isMine: true }), review({ id: "r-2", authorName: "Bekzod" })]);

    expect(screen.getAllByText(dict.mine)).toHaveLength(1);
  });

  it("does not mark anything when none of them are the reader's", () => {
    renderList([review(), review({ id: "r-2" })]);
    expect(screen.queryByText(dict.mine)).toBeNull();
  });

  it("keeps the line breaks someone typed", () => {
    const { container } = renderList([review({ body: "Birinchi qator\nIkkinchi qator" })]);
    const body = container.querySelector(".whitespace-pre-line");

    expect(body?.textContent).toContain("Birinchi qator\nIkkinchi qator");
  });

  it("renders nothing but an empty list for no reviews", () => {
    renderList([]);
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });
});
