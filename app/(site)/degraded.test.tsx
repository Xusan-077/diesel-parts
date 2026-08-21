// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SiteError from "./error";
import { ProductRow } from "@/components/marketing/product-row";
import { BrandGrid } from "@/components/marketing/brand-grid";
import { CategoryGrid } from "@/components/marketing/category-grid";
import uz from "@/dictionaries/uz.json";

/*
 * What the public site looks like when Postgres is unreachable.
 *
 * Before this, one rejected Prisma promise inside a server component took the
 * whole response with it: the home page answered 500, header and footer
 * included, though only three of its eleven sections need the database at all.
 * These pin the two halves of the replacement — sections that degrade to a
 * notice, and a route-level boundary for the pages that cannot.
 */

/** Every repository read rejects, the way an unreachable database behaves. */
vi.mock("@/lib/api/product-repository", () => {
  const unreachable = () => Promise.reject(new Error("Server has closed the connection"));
  return { listBrands: unreachable, listCategories: unreachable };
});

/*
 * Mocked for the same reason and one more: it is the only import in this tree
 * that reaches `lib/db`, which throws at module scope without a DATABASE_URL.
 * Leaving it real would fail the suite on a missing env var rather than on the
 * behaviour under test.
 */
vi.mock("@/lib/api/product-stats-repository", () => ({
  getProductStats: () => Promise.reject(new Error("Server has closed the connection")),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const carousel = {
  prev: uz.common.carouselPrev,
  next: uz.common.carouselNext,
  pause: uz.common.carouselPause,
  play: uz.common.carouselPlay,
};

function rowProps() {
  return {
    lang: "uz" as const,
    title: uz.home.popularTitle,
    viewAllHref: "/products",
    viewAllLabel: uz.common.viewAll,
    stock: uz.common.stock,
    requestPriceLabel: uz.common.requestPrice,
    actions: uz.productActions,
    productDict: uz.product,
    carousel,
  };
}

describe("a product row whose read failed", () => {
  it("keeps its heading and explains the gap", async () => {
    render(
      await ProductRow({
        ...rowProps(),
        products: [],
        unavailable: true,
        unavailableLabel: uz.common.productsUnavailable,
      }),
    );

    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe(uz.home.popularTitle);
    expect(screen.getByRole("status").textContent).toBe(uz.common.productsUnavailable);
  });

  /*
   * The distinction the whole design rests on: an empty collection and an
   * unreadable one look identical in the data and mean opposite things to a
   * visitor. A row with nothing in it stays hidden, exactly as it always did.
   */
  it("stays hidden when the read succeeded and the collection is simply empty", async () => {
    const { container } = render(
      await ProductRow({
        ...rowProps(),
        products: [],
        unavailableLabel: uz.common.productsUnavailable,
      }),
    );

    expect(container.innerHTML).toBe("");
  });
});

describe("the reference grids", () => {
  it("replace the brand logos with a notice", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(await BrandGrid({ unavailableLabel: uz.common.dataUnavailable }));

    expect(screen.getByRole("status").textContent).toBe(uz.common.dataUnavailable);
  });

  it("replace the category cards with a notice", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(await CategoryGrid({ lang: "uz", unavailableLabel: uz.common.dataUnavailable }));

    expect(screen.getByRole("status").textContent).toBe(uz.common.dataUnavailable);
  });
});

describe("the site's error boundary", () => {
  const error = Object.assign(new Error("Can't reach database server"), {
    digest: "2718281828",
  });

  it("retries in place rather than reloading the page", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const reset = vi.fn();
    render(<SiteError error={error} reset={reset} />);

    await userEvent.click(screen.getByRole("button", { name: "Qayta urinish" }));

    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("offers the way back to a page that needs no database", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(<SiteError error={error} reset={vi.fn()} />);

    expect(screen.getByRole("link", { name: "Bosh sahifaga" }).getAttribute("href")).toBe("/");
  });

  /*
   * A Prisma message names the host, the database and the schema. The panel
   * prints it in development because its readers are staff; this page is
   * public, so only the digest — which is meaningless without the server log —
   * ever reaches a visitor.
   */
  it("shows the digest but never the raw message", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { container } = render(<SiteError error={error} reset={vi.fn()} />);

    expect(container.textContent).toContain("2718281828");
    expect(container.textContent).not.toContain("Can't reach database server");
  });
});
