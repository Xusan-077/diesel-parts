// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { AccountOrders, AccountOrdersError } from "./account-orders";
import { orderItemName, orderUnitCount, type AccountOrder } from "@/lib/account/orders";
import dictionary from "@/dictionaries/uz.json";

const dict = dictionary.account.orderHistory;

function makeOrder(overrides: Partial<AccountOrder> = {}): AccountOrder {
  return {
    id: "ord-1",
    orderNumber: "DP-2026-0042",
    status: "DRAFT",
    paymentStatus: "UNPAID",
    deliveryMethod: "DELIVERY",
    currency: "UZS",
    totalAmount: 350000,
    // 21:30 UTC is already the next day in Tashkent.
    createdAt: "2026-09-20T21:30:00.000Z",
    items: [
      {
        productId: "p1",
        productSku: "SKU-1",
        productName: "Fuel filter",
        qty: 2,
        unitPrice: 125000,
        product: {
          slug: "fuel-filter",
          nameUz: "Yoqilg'i filtri",
          nameRu: "Топливный фильтр",
          nameEn: "Fuel filter",
          imageUrl: null,
        },
      },
      {
        productId: "p2",
        productSku: "SKU-2",
        productName: "Gasket",
        qty: 1,
        unitPrice: 100000,
        product: null,
      },
    ],
    ...overrides,
  };
}

afterEach(cleanup);

describe("AccountOrders", () => {
  it("renders the order's number, Tashkent date, delivery method, unit count, badges and total", () => {
    render(<AccountOrders title="Buyurtmalarim" orders={[makeOrder()]} dict={dict} locale="uz" />);

    expect(screen.getByText("Buyurtma DP-2026-0042")).toBeTruthy();
    expect(screen.getByText(/Sana: 21\.09\.2026 · Yetkazib berish · 3 ta mahsulot/)).toBeTruthy();
    // A checkout order is created as DRAFT; the shopper reads it as received.
    expect(screen.getByText("Qabul qilindi")).toBeTruthy();
    expect(screen.getByText("To'lanmagan")).toBeTruthy();
    expect(screen.getByText("350 000 so'm")).toBeTruthy();
  });

  it("links a line to its product page in the reader's language, and falls back to the snapshot when the product is gone", () => {
    render(<AccountOrders title="Buyurtmalarim" orders={[makeOrder()]} dict={dict} locale="ru" />);

    const link = screen.getByRole("link", { name: "Топливный фильтр" });
    expect(link.getAttribute("href")).toBe("/products/fuel-filter");
    expect(screen.getByText("Gasket")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Gasket" })).toBeNull();
    // Line totals are qty × unit price.
    expect(screen.getByText("250 000 сум")).toBeTruthy();
  });

  it("lists every order it is given, in the order given", () => {
    render(
      <AccountOrders
        title="Buyurtmalarim"
        orders={[
          makeOrder({ id: "a", orderNumber: "DP-2", status: "COMPLETED", paymentStatus: "PAID" }),
          makeOrder({ id: "b", orderNumber: "DP-1", status: "CANCELLED" }),
        ]}
        dict={dict}
        locale="uz"
      />,
    );

    const rows = screen.getAllByText(/^Buyurtma DP-/).map((node) => node.textContent);
    expect(rows).toEqual(["Buyurtma DP-2", "Buyurtma DP-1"]);
    const first = screen.getByText("Buyurtma DP-2").closest("li")!;
    expect(within(first).getByText("Yakunlandi")).toBeTruthy();
    expect(within(first).getByText("To'langan")).toBeTruthy();
  });
});

describe("AccountOrdersError", () => {
  it("announces the failure", () => {
    render(<AccountOrdersError title="Buyurtmalarim" message={dict.loadError} />);
    expect(screen.getByRole("alert").textContent).toBe(dict.loadError);
  });
});

describe("order helpers", () => {
  it("orderItemName prefers the localized product name and falls back to the snapshot", () => {
    const [withProduct, withoutProduct] = makeOrder().items;
    expect(orderItemName(withProduct, "uz")).toBe("Yoqilg'i filtri");
    expect(orderItemName(withProduct, "en")).toBe("Fuel filter");
    expect(orderItemName(withoutProduct, "ru")).toBe("Gasket");
  });

  it("orderUnitCount sums quantities across lines", () => {
    expect(orderUnitCount(makeOrder())).toBe(3);
  });
});
