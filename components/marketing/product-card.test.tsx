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

  it("keeps the visitor on the grid across repeated adds", async () => {
    renderCard();
    const followed = trackNavigation();

    await userEvent.click(screen.getByRole("button", { name: productActions.addToCart }));
    await userEvent.click(
      screen.getByRole("button", { name: `${productActions.inCart} (1)` })
    );

    expect(useCartStore.getState().items).toEqual([
      { productId: product.id, quantity: 2 },
    ]);
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
