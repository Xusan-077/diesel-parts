// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { CategoryMarquee } from "./category-marquee";
import { stubObservers } from "@/lib/test/stub-observers";
import { categories } from "@/lib/data/mock-catalog/categories";

/*
 * jsdom lays nothing out and observes nothing, so the belt never measures a lap
 * and never runs here. That suits these tests: what is worth pinning in a DOM
 * is the row's *structure* — that the duplicate copy the loop needs is
 * invisible to everything but the eye, and that every department is still
 * reachable. How far the belt has travelled is arithmetic, and it is tested as
 * arithmetic in lib/marquee.test.ts.
 */
beforeAll(stubObservers);
afterEach(cleanup);

function renderMarquee() {
  return render(<CategoryMarquee categories={categories} lang="uz" />);
}

describe("the category belt", () => {
  it("links every department", () => {
    renderMarquee();

    for (const category of categories) {
      const links = screen.getAllByRole("link", { name: category.name.uz });
      expect(links.length).toBeGreaterThan(0);
      expect(links[0]?.getAttribute("href")).toBe(`/categories/${category.slug}`);
    }
  });

  /*
   * The duplicate copy is what makes the loop seamless, and it is also the one
   * thing here that must not exist twice for anybody reading rather than
   * looking: a screen reader announcing every department twice, or a tab stop
   * landing on a card that is only there to fill the seam, is worse than no
   * loop at all. `CategoryCard` drops the link on the copy, which takes the tab
   * stop with it.
   */
  it("keeps its duplicate copy out of the accessibility tree", () => {
    const { container } = renderMarquee();

    for (const copy of container.querySelectorAll("li[aria-hidden='true']")) {
      expect(copy.querySelector("a")).toBeNull();
    }
  });

  /*
   * The resting state is the scroll rail, not the belt. A clipped window only
   * reveals what is past its edge because a frame loop is moving it, so a
   * first paint — or a visitor with no JavaScript at all — must be able to
   * reach the departments by hand. jsdom measures nothing, which is exactly
   * that case.
   */
  it("falls back to a scroll rail when the loop cannot run", () => {
    const { container } = renderMarquee();

    const viewport = container.querySelector(".overflow-x-auto");
    expect(viewport).not.toBeNull();
    expect(viewport?.querySelectorAll("a")).toHaveLength(categories.length);
  });
});
