// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProductActions } from "./product-actions";
import { useCartStore, useSnapshotStore } from "@/lib/store/stores";
import type { Product } from "@/lib/types";
import dictionary from "@/dictionaries/uz.json";

const dict = dictionary.productActions;
const requestPriceLabel = dictionary.common.requestPrice;

/** A catalog row is now the unit `ProductActions` works on, not a bare id. */
function fixture(id: string, overrides: Partial<Product> = {}): Product {
  return {
    id,
    slug: id,
    name: { uz: id, ru: id, en: id },
    sku: id.toUpperCase(),
    oemNumbers: [],
    price: 1000,
    categoryId: "injector",
    brandId: "cat",
    description: { uz: "", ru: "", en: "" },
    compatibleModels: [],
    stockStatus: "available",
    specs: [],
    imageUrl: null,
    ...overrides,
  };
}


beforeEach(() => {
  localStorage.clear();
  useCartStore.setState({ items: [] });
  useSnapshotStore.setState({ byId: {} });
  localStorage.clear();
});

function renderActions(id = "p-1", overrides: Partial<Product> = {}) {
  return render(
    <ProductActions
      product={fixture(id, overrides)}
      brandName="CAT"
      categoryName="Forsunka"
      lang="uz"
      dict={dict}
      requestPriceLabel={requestPriceLabel}
    />
  );
}

afterEach(cleanup);

describe("ProductActions cart control", () => {
  it("adds the product on the first click", async () => {
    renderActions();

    await userEvent.click(screen.getByRole("button", { name: dict.addToCart }));

    expect(useCartStore.getState().items).toEqual([{ productId: "p-1", quantity: 1 }]);
  });

  it("puts the stepper in the button's place once it is in the cart", async () => {
    renderActions();

    await userEvent.click(screen.getByRole("button", { name: dict.addToCart }));

    expect(screen.getByRole("group", { name: dict.quantity })).toBeDefined();
    expect(screen.queryByRole("button", { name: dict.addToCart })).toBeNull();
  });

  it("edits the cart quantity directly from the stepper", async () => {
    renderActions();

    await userEvent.click(screen.getByRole("button", { name: dict.addToCart }));
    await userEvent.click(screen.getByRole("button", { name: dict.increase }));

    expect(useCartStore.getState().items).toEqual([{ productId: "p-1", quantity: 2 }]);
  });

  it("steps off the last one back to the add button", async () => {
    renderActions();

    await userEvent.click(screen.getByRole("button", { name: dict.addToCart }));
    await userEvent.click(screen.getByRole("button", { name: dict.removeFromCart }));

    expect(useCartStore.getState().items).toEqual([]);
    expect(screen.getByRole("button", { name: dict.addToCart })).toBeDefined();
  });

  it("keeps two products on two lines", async () => {
    render(
      <>
        <ProductActions
          product={fixture("p-1")}
          brandName="CAT"
          categoryName="Forsunka"
          lang="uz"
          dict={dict}
          requestPriceLabel={requestPriceLabel}
        />
        <ProductActions
          product={fixture("p-2")}
          brandName="Komatsu"
          categoryName="Turbo"
          lang="uz"
          dict={dict}
          requestPriceLabel={requestPriceLabel}
        />
      </>
    );

    const buttons = screen.getAllByRole("button", { name: dict.addToCart });
    await userEvent.click(buttons[0]);
    await userEvent.click(buttons[1]);

    expect(useCartStore.getState().items).toEqual([
      { productId: "p-1", quantity: 1 },
      { productId: "p-2", quantity: 1 },
    ]);
  });

  it("snapshots the row so the cart page can draw it without the catalog", async () => {
    renderActions();

    await userEvent.click(screen.getByRole("button", { name: dict.addToCart }));

    expect(useSnapshotStore.getState().byId["p-1"]).toMatchObject({
      lang: "uz",
      entry: { brandName: "CAT", categoryName: "Forsunka" },
    });
  });

  it("asks for contact instead of a quantity when there is no price", () => {
    renderActions("p-1", { price: null });

    expect(screen.queryByRole("button", { name: dict.addToCart })).toBeNull();
    expect(screen.getByRole("link", { name: requestPriceLabel })).toBeDefined();
  });
});
