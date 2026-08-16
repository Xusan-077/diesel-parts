import { describe, expect, it } from "vitest";
import {
  MAX_QUANTITY,
  addToCart,
  cartLineCount,
  cartUnitCount,
  findCartItem,
  parseCart,
  removeFromCart,
  setCartQuantity,
} from "./cart";

describe("addToCart", () => {
  it("adds a new line with quantity one by default", () => {
    expect(addToCart([], "p1")).toEqual([{ productId: "p1", quantity: 1 }]);
  });

  it("tops up an existing line instead of duplicating it", () => {
    const cart = addToCart(addToCart([], "p1"), "p1", 2);
    expect(cart).toEqual([{ productId: "p1", quantity: 3 }]);
  });

  it("caps the quantity at the maximum", () => {
    expect(addToCart([], "p1", 500)).toEqual([{ productId: "p1", quantity: MAX_QUANTITY }]);
  });

  it("never mutates the input", () => {
    const input = [{ productId: "p1", quantity: 1 }];
    addToCart(input, "p1", 5);
    expect(input).toEqual([{ productId: "p1", quantity: 1 }]);
  });
});

describe("setCartQuantity", () => {
  it("sets an absolute quantity", () => {
    const cart = setCartQuantity([{ productId: "p1", quantity: 1 }], "p1", 7);
    expect(findCartItem(cart, "p1")?.quantity).toBe(7);
  });

  it("removes the line when the quantity drops below one", () => {
    expect(setCartQuantity([{ productId: "p1", quantity: 1 }], "p1", 0)).toEqual([]);
    expect(setCartQuantity([{ productId: "p1", quantity: 3 }], "p1", -2)).toEqual([]);
  });

  it("caps at the maximum", () => {
    const cart = setCartQuantity([{ productId: "p1", quantity: 1 }], "p1", 1000);
    expect(findCartItem(cart, "p1")?.quantity).toBe(MAX_QUANTITY);
  });

  it("leaves other lines alone", () => {
    const cart = setCartQuantity(
      [
        { productId: "p1", quantity: 1 },
        { productId: "p2", quantity: 4 },
      ],
      "p1",
      9
    );
    expect(findCartItem(cart, "p2")?.quantity).toBe(4);
  });
});

describe("removeFromCart", () => {
  it("drops the matching line only", () => {
    const cart = removeFromCart(
      [
        { productId: "p1", quantity: 1 },
        { productId: "p2", quantity: 2 },
      ],
      "p1"
    );
    expect(cart).toEqual([{ productId: "p2", quantity: 2 }]);
  });
});

describe("counts", () => {
  const cart = [
    { productId: "p1", quantity: 2 },
    { productId: "p2", quantity: 3 },
  ];

  it("counts total units", () => {
    expect(cartUnitCount(cart)).toBe(5);
  });

  it("counts distinct lines", () => {
    expect(cartLineCount(cart)).toBe(2);
  });

  it("returns zero for an empty cart", () => {
    expect(cartUnitCount([])).toBe(0);
    expect(cartLineCount([])).toBe(0);
  });
});

describe("parseCart", () => {
  it("keeps well-formed entries", () => {
    expect(parseCart([{ productId: "p1", quantity: 2 }])).toEqual([
      { productId: "p1", quantity: 2 },
    ]);
  });

  it("drops malformed entries", () => {
    expect(
      parseCart([
        { productId: "p1", quantity: 2 },
        { productId: "", quantity: 1 },
        { productId: "p2" },
        { quantity: 3 },
        "p3",
        null,
      ])
    ).toEqual([{ productId: "p1", quantity: 2 }]);
  });

  it("clamps out-of-range quantities rather than dropping the line", () => {
    expect(parseCart([{ productId: "p1", quantity: -5 }])).toEqual([
      { productId: "p1", quantity: 1 },
    ]);
    expect(parseCart([{ productId: "p1", quantity: 9999 }])).toEqual([
      { productId: "p1", quantity: MAX_QUANTITY },
    ]);
  });

  it("collapses duplicate product ids", () => {
    expect(
      parseCart([
        { productId: "p1", quantity: 1 },
        { productId: "p1", quantity: 4 },
      ])
    ).toEqual([{ productId: "p1", quantity: 4 }]);
  });

  it("returns an empty cart for anything that is not an array", () => {
    expect(parseCart(null)).toEqual([]);
    expect(parseCart("[]")).toEqual([]);
  });
});
