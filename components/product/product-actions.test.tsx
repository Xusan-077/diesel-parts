// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProductActions } from "./product-actions";
import { useCartStore, useSnapshotStore } from "@/lib/store/stores";
import type { Product } from "@/lib/types";
import dictionary from "@/dictionaries/uz.json";

const dict = dictionary.productActions;

/** A catalog row is now the unit `ProductActions` works on, not a bare id. */
function fixture(id: string): Product {
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
    imageLabels: ["Front"],
  };
}


beforeEach(() => {
  localStorage.clear();
  useCartStore.setState({ items: [] });
  useSnapshotStore.setState({ byId: {} });
  localStorage.clear();
});

function renderActions(id = "p-1") {
  return render(
    <ProductActions
      product={fixture(id)}
      brandName="CAT"
      categoryName="Forsunka"
      lang="uz"
      dict={dict}
    />
  );
}

afterEach(cleanup);

describe("ProductActions cart button", () => {
  it("adds the product on the first click", async () => {
    renderActions();

    await userEvent.click(screen.getByRole("button", { name: dict.addToCart }));

    expect(useCartStore.getState().items).toEqual([{ productId: "p-1", quantity: 1 }]);
  });

  it("tops the same line up on every further click", async () => {
    renderActions();

    await userEvent.click(screen.getByRole("button", { name: dict.addToCart }));
    await userEvent.click(screen.getByRole("button", { name: `${dict.inCart} (1)` }));
    await userEvent.click(screen.getByRole("button", { name: `${dict.inCart} (2)` }));

    expect(useCartStore.getState().items).toEqual([{ productId: "p-1", quantity: 3 }]);
  });

  it("shows the running quantity once there is more than one", async () => {
    renderActions();

    await userEvent.click(screen.getByRole("button", { name: dict.addToCart }));
    expect(screen.queryByText("1")).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: `${dict.inCart} (1)` }));
    expect(screen.getByText("2")).toBeDefined();
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
        />
        <ProductActions
          product={fixture("p-2")}
          brandName="Komatsu"
          categoryName="Turbo"
          lang="uz"
          dict={dict}
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
});
