import { describe, expect, it } from "vitest";
import { products } from "@/lib/data/mock-catalog/products";
import { cartUnitCount } from "./store/cart";
import { formatCartForQuote, toQuoteCartItems, type CartLine } from "./cart-summary";

const priced = products.find((product) => product.price !== null)!;
const unpriced = products.find((product) => product.price === null)!;

const labels = { onRequest: "So'rov bo'yicha", total: "Jami" };

describe("formatCartForQuote", () => {
  it("returns an empty string for an empty cart", () => {
    expect(formatCartForQuote([], "uz", labels)).toBe("");
  });

  it("writes one line per product with name, SKU, quantity and unit price", () => {
    const lines: CartLine[] = [{ product: priced, quantity: 2 }];
    const text = formatCartForQuote(lines, "uz", labels);

    expect(text).toContain(priced.name.uz);
    expect(text).toContain(priced.sku);
    expect(text).toContain("2 ×");
  });

  it("uses the on-request label for an unpriced product", () => {
    const text = formatCartForQuote([{ product: unpriced, quantity: 1 }], "uz", labels);
    expect(text).toContain(labels.onRequest);
  });

  it("appends a total when at least one line is priced", () => {
    const text = formatCartForQuote([{ product: priced, quantity: 2 }], "uz", labels);
    expect(text).toContain(`${labels.total}:`);
  });

  it("omits the total when nothing is priced", () => {
    const text = formatCartForQuote([{ product: unpriced, quantity: 3 }], "uz", labels);
    expect(text).not.toContain(`${labels.total}:`);
  });

  it("emits one row per line plus the total row", () => {
    const text = formatCartForQuote(
      [
        { product: priced, quantity: 1 },
        { product: unpriced, quantity: 1 },
      ],
      "uz",
      labels
    );
    expect(text.split("\n")).toHaveLength(3);
  });

  it("localises the product name", () => {
    const uz = formatCartForQuote([{ product: priced, quantity: 1 }], "uz", labels);
    const en = formatCartForQuote([{ product: priced, quantity: 1 }], "en", labels);
    expect(uz).toContain(priced.name.uz);
    expect(en).toContain(priced.name.en);
  });
});

describe("toQuoteCartItems", () => {
  it("carries the fields a manager needs to place the order", () => {
    const items = toQuoteCartItems([{ product: priced, quantity: 4 }], "uz");
    expect(items).toEqual([
      {
        productId: priced.id,
        sku: priced.sku,
        name: priced.name.uz,
        quantity: 4,
        price: priced.price,
      },
    ]);
  });

  it("keeps a null price rather than coercing it to zero", () => {
    expect(toQuoteCartItems([{ product: unpriced, quantity: 1 }], "uz")[0].price).toBeNull();
  });

  it("returns an empty array for an empty cart", () => {
    expect(toQuoteCartItems([], "uz")).toEqual([]);
  });
});

/*
 * Counting units is `cartUnitCount` in lib/store/cart.ts and is tested there.
 * These check only that a quote line is a shape it accepts — the seam that
 * would break if either side drifted.
 */
describe("cart lines as the unit counter sees them", () => {
  it("counts a quote's lines the same way the header badge does", () => {
    const lines: CartLine[] = [
      { product: priced, quantity: 2 },
      { product: unpriced, quantity: 3 },
    ];

    expect(cartUnitCount(lines)).toBe(5);
  });
});
