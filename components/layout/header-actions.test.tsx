// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HeaderActions } from "./header-actions";
import { ProductActions } from "@/components/product/product-actions";
import { useCartStore, useSnapshotStore, useWishlistStore } from "@/lib/store/stores";
import type { Product } from "@/lib/types";
import { AUTH_HINT_COOKIE } from "@/lib/auth/cookie-names";
import dictionary from "@/dictionaries/uz.json";

const { header, account, common, productActions } = dictionary;

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


/**
 * The badge and the card button are separate subscribers to the same store,
 * which is exactly the seam a cart count goes wrong on: one of them can be
 * reading a stale snapshot while the other renders the new one.
 */
function renderBoth(productId = "p-1") {
  return render(
    <>
      <HeaderActions header={header} account={account} closeLabel={common.close} />
      <ProductActions
        product={fixture(productId)}
        brandName="CAT"
        categoryName="Forsunka"
        lang="uz"
        dict={productActions}
      />
    </>
  );
}

/** The badge is the only number inside the cart link. */
function cartBadge(): string {
  const link = screen.getByRole("link", { name: header.cart });
  return link.textContent?.replace(header.cart, "").trim() ?? "";
}

beforeEach(() => {
  // Signed out, the account entry renders the login dialog, which reaches for
  // the app router. The hint cookie swaps it for a plain link so the badges —
  // the actual subject here — can be rendered without a router.
  document.cookie = `${AUTH_HINT_COOKIE}=1`;
  localStorage.clear();
  useCartStore.setState({ items: [] });
  useWishlistStore.setState({ ids: [] });
  useSnapshotStore.setState({ byId: {} });
  localStorage.clear();
});

afterEach(cleanup);

describe("header cart badge", () => {
  it("shows nothing while the cart is empty", () => {
    renderBoth();
    expect(cartBadge()).toBe("");
  });

  it("counts units, not lines, as the card button is clicked", async () => {
    renderBoth();

    await userEvent.click(screen.getByRole("button", { name: productActions.addToCart }));
    expect(cartBadge()).toBe("1");

    await userEvent.click(
      screen.getByRole("button", { name: `${productActions.inCart} (1)` })
    );
    expect(cartBadge()).toBe("2");

    await userEvent.click(
      screen.getByRole("button", { name: `${productActions.inCart} (2)` })
    );
    expect(cartBadge()).toBe("3");
  });

  it("follows a quantity set from elsewhere, e.g. the cart page", async () => {
    renderBoth();
    await userEvent.click(screen.getByRole("button", { name: productActions.addToCart }));

    act(() => useCartStore.getState().setQuantity("p-1", 7));
    expect(cartBadge()).toBe("7");
  });

  it("caps the badge at 99+", () => {
    renderBoth();
    act(() => {
      useCartStore.getState().add("p-1", 99);
      useCartStore.getState().add("p-2", 5);
    });

    expect(cartBadge()).toBe("99+");
  });

  it("clears back to no badge when the cart is emptied", async () => {
    renderBoth();
    await userEvent.click(screen.getByRole("button", { name: productActions.addToCart }));

    act(() => useCartStore.getState().clear());
    expect(cartBadge()).toBe("");
  });
});
