// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { rehydrateStores, useCartStore, useWishlistStore } from "./stores";

const CART_KEY = "diesel-parts:cart";

beforeEach(() => {
  localStorage.clear();
  useCartStore.setState({ items: [] });
  useWishlistStore.setState({ ids: [] });
  localStorage.clear();
});

function stored(): unknown {
  return JSON.parse(localStorage.getItem(CART_KEY) ?? "null");
}

/** Puts a cart in storage the way a previous visit would have left it. */
function seed(items: unknown): void {
  localStorage.setItem(CART_KEY, JSON.stringify({ state: { items }, version: 0 }));
}

describe("cart store", () => {
  it("tops up the quantity instead of adding a second line", () => {
    useCartStore.getState().add("p-1");
    useCartStore.getState().add("p-1");
    useCartStore.getState().add("p-2");

    expect(useCartStore.getState().items).toEqual([
      { productId: "p-1", quantity: 2 },
      { productId: "p-2", quantity: 1 },
    ]);
  });

  it("writes every change through to localStorage", () => {
    useCartStore.getState().add("p-1");
    useCartStore.getState().add("p-1", 3);

    expect(stored()).toMatchObject({
      state: { items: [{ productId: "p-1", quantity: 4 }] },
    });
  });

  it("reads a persisted cart back with its quantities intact", () => {
    seed([{ productId: "p-1", quantity: 5 }]);
    rehydrateStores();

    expect(useCartStore.getState().items).toEqual([{ productId: "p-1", quantity: 5 }]);
  });

  it("keeps topping up the same line after a rehydrate", () => {
    seed([{ productId: "p-1", quantity: 2 }]);
    rehydrateStores();
    useCartStore.getState().add("p-1");

    expect(useCartStore.getState().items).toEqual([{ productId: "p-1", quantity: 3 }]);
  });

  it("still reads the bare-array format written before zustand", () => {
    localStorage.setItem(CART_KEY, JSON.stringify([{ productId: "p-1", quantity: 4 }]));
    rehydrateStores();

    expect(useCartStore.getState().items).toEqual([{ productId: "p-1", quantity: 4 }]);
  });
});
