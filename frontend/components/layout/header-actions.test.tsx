// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HeaderActions } from "./header-actions";
import { ProductActions } from "@/components/product/product-actions";
import { useCartStore, useSnapshotStore, useWishlistStore } from "@/lib/store/stores";
import type { Product } from "@/lib/types";
import { AUTH_HINT_COOKIE } from "@/lib/auth/cookie-names";
import { formatPhone } from "@/lib/auth/phone";
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
    imageUrl: null,
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
        requestPriceLabel={common.requestPrice}
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

  /*
   * The badge counts parts, not units — the same thing the two badges beside
   * it count. Compare and favourites are both "how many have you collected",
   * and a cart that answered "seven" to one screwdriver ordered seven times
   * made the row of three numbers mean two different things.
   *
   * The units figure is not lost: the cart page prints both, each against its
   * own label, which is the one place the distinction is worth the words.
   */
  it("counts parts, not units, as the card button is clicked", async () => {
    renderBoth();

    await userEvent.click(screen.getByRole("button", { name: productActions.addToCart }));
    expect(cartBadge()).toBe("1");

    // Topping the same part up from the stepper is still one part in the cart.
    await userEvent.click(screen.getByRole("button", { name: productActions.increase }));
    expect(cartBadge()).toBe("1");

    act(() => useCartStore.getState().add("p-2"));
    expect(cartBadge()).toBe("2");
  });

  it("does not move when a quantity is set from elsewhere, e.g. the cart page", async () => {
    renderBoth();
    await userEvent.click(screen.getByRole("button", { name: productActions.addToCart }));

    act(() => useCartStore.getState().setQuantity("p-1", 7));
    expect(cartBadge()).toBe("1");
  });

  it("caps the badge at 99+", () => {
    renderBoth();
    act(() => {
      for (let index = 0; index < 100; index += 1) {
        useCartStore.getState().add(`p-${index}`);
      }
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

/*
 * Signed in, the account entry stops being a fourth icon and becomes the
 * visitor's own number — but only where there is room for it. The number comes
 * from the server, because the session cookie is httpOnly and the browser
 * cannot read it.
 */
describe("header account entry", () => {
  const PHONE = "998901234567";
  const READABLE = formatPhone(PHONE);

  function renderActions(props: { phone?: string | null; compact?: boolean } = {}) {
    render(
      <HeaderActions
        header={header}
        account={account}
        closeLabel={common.close}
        {...props}
      />
    );
  }

  it("shows the number in place of the icon on a wide screen", () => {
    renderActions({ phone: PHONE });

    const link = screen.getByRole("link", {
      name: header.accountSignedIn.replace("{phone}", READABLE),
    });
    expect(link).toHaveProperty("href", expect.stringContaining("/account"));
    expect(link.textContent).toBe(READABLE);
  });

  it("keeps the icon on a phone, where the number would not fit", () => {
    renderActions({ phone: PHONE, compact: true });

    expect(screen.getByRole("link", { name: header.account })).toBeTruthy();
    expect(screen.queryByText(READABLE)).toBeNull();
  });

  it("falls back to the icon when only the hint cookie says there is a session", () => {
    // The cookie outlived the session the server would have honoured.
    renderActions({ phone: null });

    expect(screen.getByRole("link", { name: header.account })).toBeTruthy();
  });

  it("reads the number rather than spelling it out", () => {
    renderActions({ phone: PHONE });

    // Grouped for recognition, not stored formatting: the session holds digits.
    expect(screen.getByText(READABLE).textContent).toBe("+998 90 123-45-67");
  });
});
