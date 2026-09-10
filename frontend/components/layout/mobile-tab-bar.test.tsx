// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MobileTabBar } from "./mobile-tab-bar";
import { useCartStore, useSearchHistoryStore } from "@/lib/store/stores";
import dictionary from "@/dictionaries/uz.json";

const { nav, header, mobileNav, common } = dictionary;

const push = vi.fn();
let pathname = "/";

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push }),
}));

function renderBar() {
  return render(
    <MobileTabBar
      nav={nav}
      header={header}
      mobileNav={mobileNav}
      closeLabel={common.close}
    />
  );
}

beforeEach(() => {
  pathname = "/";
  push.mockClear();
  localStorage.clear();
  useCartStore.setState({ items: [] });
  useSearchHistoryStore.setState({ terms: [] });
});

afterEach(cleanup);

describe("MobileTabBar", () => {
  it("renders the four destinations and the search action", () => {
    renderBar();

    expect(screen.getByRole("link", { name: nav.home })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: header.catalog })).toHaveAttribute("href", "/products");
    expect(screen.getByRole("link", { name: header.cart })).toHaveAttribute("href", "/cart");
    expect(screen.getByRole("link", { name: header.account })).toHaveAttribute("href", "/account");
    expect(screen.getByRole("button", { name: mobileNav.searchAction })).toBeTruthy();
  });

  it("marks the tab that matches the current route", () => {
    pathname = "/products/cat-3126-injector";
    renderBar();

    expect(screen.getByRole("link", { name: header.catalog }).getAttribute("aria-current")).toBe(
      "page"
    );
    expect(screen.getByRole("link", { name: nav.home })).not.toHaveAttribute("aria-current");
  });

  it("shows the cart count once, matching the header badge rule (parts, not units)", () => {
    renderBar();

    // Empty: no number in the cart link.
    expect(screen.getByRole("link", { name: header.cart }).textContent).toBe(header.cart);

    act(() => {
      useCartStore.getState().add("p-1", 4);
      useCartStore.getState().add("p-2", 1);
    });

    // Two parts in the cart, regardless of quantities.
    expect(screen.getByRole("link", { name: `${header.cart}, 2` })).toBeTruthy();
  });

  it("caps the cart count at 99+", () => {
    renderBar();
    act(() => {
      for (let index = 0; index < 100; index += 1) {
        useCartStore.getState().add(`p-${index}`);
      }
    });

    expect(screen.getByRole("link", { name: `${header.cart}, 99+` })).toBeTruthy();
  });

  it("stays out of the way on routes with their own bottom bar", () => {
    pathname = "/cart";
    const { container } = renderBar();
    expect(container).toBeEmptyDOMElement();

    cleanup();
    pathname = "/checkout";
    const second = renderBar();
    expect(second.container).toBeEmptyDOMElement();
  });

  it("runs a part-number search from the centre sheet", async () => {
    const user = userEvent.setup();
    renderBar();

    await user.click(screen.getByRole("button", { name: mobileNav.searchAction }));

    const field = await screen.findByRole("searchbox", { name: mobileNav.searchTitle });
    await user.type(field, "0445120231{Enter}");

    expect(push).toHaveBeenCalledWith("/products?q=0445120231");
    // The term is remembered for next time.
    expect(useSearchHistoryStore.getState().terms).toContain("0445120231");
  });

  it("re-runs a remembered search from a chip", async () => {
    useSearchHistoryStore.setState({ terms: ["F 00R J01 692"] });
    const user = userEvent.setup();
    renderBar();

    await user.click(screen.getByRole("button", { name: mobileNav.searchAction }));
    await user.click(await screen.findByRole("button", { name: "F 00R J01 692" }));

    expect(push).toHaveBeenCalledWith("/products?q=F%2000R%20J01%20692");
  });

  it("does not fire an empty search", async () => {
    const user = userEvent.setup();
    renderBar();

    await user.click(screen.getByRole("button", { name: mobileNav.searchAction }));
    await user.click(await screen.findByRole("button", { name: mobileNav.searchSubmit }));

    expect(push).not.toHaveBeenCalled();
  });
});
