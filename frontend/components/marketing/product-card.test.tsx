// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProductCard } from "./product-card";
import { useCartStore, useSnapshotStore, useWishlistStore } from "@/lib/store/stores";
import { products } from "@/lib/data/mock-catalog/products";
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

  it("shows no stepper until the part is actually in the cart", () => {
    renderCard();

    // One slot, one decision. A quantity control beside the button asked for
    // an amount of something nobody had yet agreed to buy.
    expect(screen.queryByRole("group", { name: productActions.quantity })).toBeNull();
    expect(screen.queryByRole("button", { name: productActions.increase })).toBeNull();
  });

  it("puts the stepper in the button's place once it is", async () => {
    renderCard();

    await userEvent.click(screen.getByRole("button", { name: productActions.addToCart }));

    expect(screen.getByRole("group", { name: productActions.quantity })).toBeDefined();
    expect(screen.queryByRole("button", { name: productActions.addToCart })).toBeNull();
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

  it("steps back down without leaving the cart while there is more than one", async () => {
    renderCard();

    await userEvent.click(screen.getByRole("button", { name: productActions.addToCart }));
    await userEvent.click(screen.getByRole("button", { name: productActions.increase }));
    await userEvent.click(screen.getByRole("button", { name: productActions.decrease }));

    expect(useCartStore.getState().items).toEqual([
      { productId: product.id, quantity: 1 },
    ]);
  });

  it("steps off the last one back to the add button", async () => {
    renderCard();
    const followed = trackNavigation();

    await userEvent.click(screen.getByRole("button", { name: productActions.addToCart }));
    // At one the minus is a bin, and says so — the control has to name what
    // the next press will actually do.
    await userEvent.click(screen.getByRole("button", { name: productActions.removeFromCart }));

    expect(useCartStore.getState().items).toEqual([]);
    expect(screen.getByRole("button", { name: productActions.addToCart })).toBeDefined();
    expect(followed()).toBe(0);
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

  it("shows the product's own photograph when it has one", () => {
    renderWith({ product: { ...product, imageUrl: "/uploads/products/a.jpg" } });

    const img = screen.getByRole("img", { name: product.name.uz }) as HTMLImageElement;
    expect(img.src).toContain("/uploads/products/a.jpg");
  });

  it("falls back to a placeholder mark for a part with no photograph yet", () => {
    renderWith({ product: { ...product, imageUrl: null } });

    expect(screen.queryByRole("img", { name: product.name.uz })).toBeNull();
  });

  it("asks for contact instead of a quantity when there is no price", () => {
    const unpriced = products.find((entry) => entry.price === null)!;
    renderWith({ product: unpriced });

    expect(screen.queryByRole("button", { name: productActions.addToCart })).toBeNull();
    expect(screen.getByRole("link", { name: common.requestPrice })).toBeDefined();
  });
});
