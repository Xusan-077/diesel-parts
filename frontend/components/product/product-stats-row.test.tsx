// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ProductStatsRow } from "./product-stats-row";
import { EMPTY_STATS, type ProductStats } from "@/lib/product-stats";
import dictionary from "@/dictionaries/uz.json";

const dict = dictionary.product;

function renderRow(stats: Partial<ProductStats>) {
  return render(
    <ProductStatsRow stats={{ ...EMPTY_STATS, ...stats }} lang="uz" dict={dict} />
  );
}

afterEach(cleanup);

describe("ProductStatsRow", () => {
  it("renders nothing for a part with no reviews and no sales", () => {
    const { container } = renderRow({});
    expect(container.firstChild).toBeNull();
  });

  /*
   * The rule the whole component turns on: an unreviewed part is not a part
   * scored zero. Drawing five empty stars would put a verdict on the card that
   * nobody gave.
   */
  it("draws no stars when nothing has been reviewed", () => {
    renderRow({ soldCount: 12 });

    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText(dict.orderedCount.replace("{count}", "12"))).toBeDefined();
  });

  it("shows the rating, the review count and the sold count together", () => {
    renderRow({ rating: 4.5, reviewCount: 24, soldCount: 156 });

    expect(screen.getByRole("img").getAttribute("aria-label")).toBe(
      dict.ratingLabel.replace("{rating}", "4.5")
    );
    expect(screen.getByText("4.5")).toBeDefined();
    expect(screen.getByText(dict.reviewCount.replace("{count}", "24"))).toBeDefined();
    expect(screen.getByText(dict.orderedCount.replace("{count}", "156"))).toBeDefined();
  });

  it("prints a whole rating to one decimal, so cards align", () => {
    renderRow({ rating: 5, reviewCount: 3 });
    expect(screen.getByText("5.0")).toBeDefined();
  });

  it("omits the sold count for a part that has been reviewed but never sold", () => {
    renderRow({ rating: 4, reviewCount: 2 });
    expect(screen.queryByText(/buyurtma qilingan/)).toBeNull();
  });

  it("groups a four-figure sold count", () => {
    renderRow({ soldCount: 1240 });

    /*
     * Intl separates thousands with a non-breaking space in this locale, which
     * is the point: a sold count must not wrap in the middle of the number.
     * Testing Library's default normaliser collapses it to a plain space, so
     * the assertion is written against the normalised text and the raw
     * separator is checked directly below.
     */
    const line = screen.getByText(dict.orderedCount.replace("{count}", "1 240"));
    expect(line.textContent).toContain("1 240");
  });

  it("ignores a rating that arrived with no reviews behind it", () => {
    // A count of zero and a non-null average cannot both be true; the count
    // wins, because it is what the aggregate actually measured.
    renderRow({ rating: 4.5, reviewCount: 0, soldCount: 3 });
    expect(screen.queryByRole("img")).toBeNull();
  });
});
