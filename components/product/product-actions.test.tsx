// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProductActions } from "./product-actions";
import { useCartStore } from "@/lib/store/stores";
import dictionary from "@/dictionaries/uz.json";

const dict = dictionary.productActions;

beforeEach(() => {
  localStorage.clear();
  useCartStore.setState({ items: [] });
  localStorage.clear();
});

afterEach(cleanup);

describe("ProductActions cart button", () => {
  it("adds the product on the first click", async () => {
    render(<ProductActions productId="p-1" price={1000} dict={dict} />);

    await userEvent.click(screen.getByRole("button", { name: dict.addToCart }));

    expect(useCartStore.getState().items).toEqual([{ productId: "p-1", quantity: 1 }]);
  });

  it("tops the same line up on every further click", async () => {
    render(<ProductActions productId="p-1" price={1000} dict={dict} />);

    await userEvent.click(screen.getByRole("button", { name: dict.addToCart }));
    await userEvent.click(screen.getByRole("button", { name: `${dict.inCart} (1)` }));
    await userEvent.click(screen.getByRole("button", { name: `${dict.inCart} (2)` }));

    expect(useCartStore.getState().items).toEqual([{ productId: "p-1", quantity: 3 }]);
  });

  it("shows the running quantity once there is more than one", async () => {
    render(<ProductActions productId="p-1" price={1000} dict={dict} />);

    await userEvent.click(screen.getByRole("button", { name: dict.addToCart }));
    expect(screen.queryByText("1")).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: `${dict.inCart} (1)` }));
    expect(screen.getByText("2")).toBeDefined();
  });

  it("keeps two products on two lines", async () => {
    render(
      <>
        <ProductActions productId="p-1" price={1000} dict={dict} />
        <ProductActions productId="p-2" price={2000} dict={dict} />
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
});
