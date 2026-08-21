// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProductCard } from "./product-card";
import { useCartStore, useSnapshotStore, useWishlistStore } from "@/lib/store/stores";
import { products } from "@/prisma/seed-data/products";
import dictionary from "@/dictionaries/uz.json";

/*
 * The card's title link is stretched over the whole card with
 * `after:absolute after:inset-0`, which is exactly the arrangement that
 * swallows a button placed inside it. These pin down that adding to the cart
 * happens where the visitor is standing: the store changes, and nothing
 * navigates away from the grid.
 */

const product = products.find((entry) => entry.price !== null)!;
const { productActions, common, product: productDict } = dictionary;

const cleanups: (() => void)[] = [];

/**
 * Anything that would leave the page shows up as a click on an anchor.
 *
 * jsdom does no hit testing, so this proves the buttons are not *nested* in
 * the stretched link — a real regression, and the one this arrangement invites.
 * That they also win the pointer against the `after:inset-0` overlay is a
 * paint-order question only a browser can answer.
 */
function trackNavigation(): () => number {
  let followed = 0;
  const onClick = (event: MouseEvent) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest("a") !== null && !event.defaultPrevented) {
      followed += 1;
    }
  };
  document.addEventListener("click", onClick);
  cleanups.push(() => document.removeEventListener("click", onClick));
  return () => followed;
}

beforeEach(() => {
  localStorage.clear();
  useCartStore.setState({ items: [] });
  useWishlistStore.setState({ ids: [] });
  useSnapshotStore.setState({ byId: {} });
  localStorage.clear();
});

afterEach(() => {
  for (const undo of cleanups.splice(0)) {
    undo();
  }
  cleanup();
});

function renderCard() {
  return render(
    <ProductCard
      product={product}
      lang="uz"
      categoryName="Forsunka"
      brandName="CAT"
      stock={common.stock}
      requestPriceLabel={common.requestPrice}
      actions={productActions}
      productDict={productDict}
    />
  );
}

describe("ProductCard actions", () => {
  it("adds to the cart without following the card's stretched link", async () => {
    renderCard();
    const followed = trackNavigation();

    await userEvent.click(screen.getByRole("button", { name: productActions.addToCart }));

    expect(useCartStore.getState().items).toEqual([
      { productId: product.id, quantity: 1 },
    ]);
    expect(followed()).toBe(0);
  });

  it("adds the quantity the stepper is showing, in one go", async () => {
    renderCard();
    const followed = trackNavigation();

    // Buying a filter is rarely buying one filter, and this used to be five
    // clicks and five toasts.
    await userEvent.click(screen.getByRole("button", { name: productActions.increase }));
    await userEvent.click(screen.getByRole("button", { name: productActions.increase }));
    await userEvent.click(screen.getByRole("button", { name: productActions.addToCart }));

    expect(useCartStore.getState().items).toEqual([
      { productId: product.id, quantity: 3 },
    ]);
    expect(followed()).toBe(0);
  });

  it("leaves the cart alone until the button is pressed", async () => {
    renderCard();

    await userEvent.click(screen.getByRole("button", { name: productActions.increase }));

    // A stray tap on a card in a grid must not silently change an order —
    // there is no undo on a catalog page.
    expect(useCartStore.getState().items).toEqual([]);
  });

  it("edits the cart directly once the part is in it", async () => {
    renderCard();
    const followed = trackNavigation();

    await userEvent.click(screen.getByRole("button", { name: productActions.addToCart }));
    await userEvent.click(screen.getByRole("button", { name: productActions.increase }));

    expect(useCartStore.getState().items).toEqual([
      { productId: product.id, quantity: 2 },
    ]);
    expect(followed()).toBe(0);
  });

  it("will not step below one", async () => {
    renderCard();

    const decrease = screen.getByRole("button", { name: productActions.decrease });
    expect(decrease).toHaveProperty("disabled", true);
  });

  it("toggles the wishlist in place too", async () => {
    renderCard();
    const followed = trackNavigation();

    await userEvent.click(
      screen.getByRole("button", { name: productActions.addToWishlist })
    );

    expect(useWishlistStore.getState().ids).toEqual([product.id]);
    expect(followed()).toBe(0);
  });

  it("snapshots the row so the cart page never has to ask for it", async () => {
    renderCard();

    await userEvent.click(screen.getByRole("button", { name: productActions.addToCart }));

    expect(useSnapshotStore.getState().byId[product.id]).toMatchObject({
      lang: "uz",
      entry: { brandName: "CAT", categoryName: "Forsunka" },
    });
  });
});

/*
 * What the card promises a *grid* of cards, rather than what one card does.
 * Each of these is a rule that only shows up when twenty of them sit side by
 * side: the same rows in the same places, whatever the data behind them.
 */
describe("ProductCard as a grid cell", () => {
  function renderWith(overrides: Partial<Parameters<typeof ProductCard>[0]> = {}) {
    return render(
      <ProductCard
        product={product}
        lang="uz"
        categoryName="Forsunka"
        brandName="CAT"
        stock={common.stock}
        requestPriceLabel={common.requestPrice}
        actions={productActions}
        productDict={productDict}
        {...overrides}
      />
    );
  }

  it("fills the height its cell was given", () => {
    const { container } = renderWith();
    // Without this the card is as tall as its own content and a row of them
    // ends ragged, whatever the grid does.
    expect(container.querySelector("article")?.className).toContain("h-full");
  });

  it("scores an unreviewed part 0.0 rather than dropping the line", () => {
    renderWith();

    expect(screen.getByText("0.0")).toBeDefined();
    expect(
      screen.getByText(productDict.reviewCount.replace("{count}", "0"))
    ).toBeDefined();
  });

  it("reports what a reviewed part actually scored", () => {
    renderWith({ stats: { rating: 4.5, reviewCount: 24, soldCount: 6 } });

    expect(screen.getByText("4.5")).toBeDefined();
    expect(
      screen.getByText(productDict.reviewCount.replace("{count}", "24"))
    ).toBeDefined();
    expect(
      screen.getByText(productDict.orderedCount.replace("{count}", "6"))
    ).toBeDefined();
  });

  it("offers a dot per photograph when there is more than one", () => {
    renderWith();

    // The seed rows carry two or three captions each.
    expect(product.imageLabels.length).toBeGreaterThan(1);
    const dots = screen.getAllByRole("button", {
      name: new RegExp(productDict.imageDot.replace("{n}", "[0-9]")),
    });
    expect(dots).toHaveLength(product.imageLabels.length);
  });

  it("draws no dots and no arrows for a part with one photograph", () => {
    renderWith({ product: { ...product, imageLabels: ["Front"] } });

    // A control that cannot move is worse than no control.
    expect(screen.queryByRole("button", { name: productDict.imageNext })).toBeNull();
    expect(
      screen.queryByRole("button", {
        name: new RegExp(productDict.imageDot.replace("{n}", "[0-9]")),
      })
    ).toBeNull();
  });

  it("moves through the photographs in place", async () => {
    renderWith();
    const followed = trackNavigation();

    const [first, second] = product.imageLabels;
    expect(screen.getByRole("img", { name: `${product.name.uz} — ${first}` })).toBeDefined();

    await userEvent.click(screen.getByRole("button", { name: productDict.imageNext }));

    expect(screen.getByRole("img", { name: `${product.name.uz} — ${second}` })).toBeDefined();
    expect(followed()).toBe(0);
  });

  it("wraps back to the first photograph rather than hitting a wall", async () => {
    renderWith();

    const next = screen.getByRole("button", { name: productDict.imageNext });
    for (const _ of product.imageLabels) {
      await userEvent.click(next);
    }

    expect(
      screen.getByRole("img", { name: `${product.name.uz} — ${product.imageLabels[0]}` })
    ).toBeDefined();
  });

  it("asks for contact instead of a quantity when there is no price", () => {
    const unpriced = products.find((entry) => entry.price === null)!;
    renderWith({ product: unpriced });

    expect(screen.queryByRole("button", { name: productActions.addToCart })).toBeNull();
    expect(screen.getByRole("link", { name: common.requestPrice })).toBeDefined();
  });
});
