// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { CheckoutStatusClient, resolvePhase } from "./checkout-status-client";
import dictionary from "@/dictionaries/uz.json";

const get = vi.fn();
vi.mock("axios", () => ({
  default: { get: (...args: unknown[]) => get(...args) },
}));

afterEach(cleanup);

const dict = dictionary.checkout;

describe("resolvePhase", () => {
  it("reports success once the order is fully PAID", () => {
    expect(
      resolvePhase({ orderNumber: "DP-1", paymentStatus: "PAID", latestPaymentStatus: null }),
    ).toBe("success");
  });

  it("reports success as soon as the latest payment COMPLETED, even before the aggregate catches up", () => {
    expect(
      resolvePhase({ orderNumber: "DP-1", paymentStatus: "UNPAID", latestPaymentStatus: "COMPLETED" }),
    ).toBe("success");
  });

  it("reports failed when the latest payment FAILED", () => {
    expect(
      resolvePhase({ orderNumber: "DP-1", paymentStatus: "UNPAID", latestPaymentStatus: "FAILED" }),
    ).toBe("failed");
  });

  it("reports failed when the latest payment was REFUNDED", () => {
    expect(
      resolvePhase({ orderNumber: "DP-1", paymentStatus: "UNPAID", latestPaymentStatus: "REFUNDED" }),
    ).toBe("failed");
  });

  it("reports processing while the latest payment is still PENDING or absent", () => {
    expect(
      resolvePhase({ orderNumber: "DP-1", paymentStatus: "UNPAID", latestPaymentStatus: "PENDING" }),
    ).toBe("processing");
    expect(
      resolvePhase({ orderNumber: "DP-1", paymentStatus: "UNPAID", latestPaymentStatus: null }),
    ).toBe("processing");
  });
});

describe("CheckoutStatusClient", () => {
  it("shows the success screen once the poll reports a completed payment", async () => {
    get.mockResolvedValue({
      data: { success: true, orderNumber: "DP-1001", paymentStatus: "PAID", latestPaymentStatus: "COMPLETED" },
    });

    render(<CheckoutStatusClient orderId="ord-1" dict={dict} />);

    expect(await screen.findByText(dict.statusSuccessTitle)).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith("/api/v1/checkout/orders/ord-1");
  });

  it("shows the failed screen when the request errors", async () => {
    get.mockRejectedValue(new Error("network"));

    render(<CheckoutStatusClient orderId="ord-1" dict={dict} />);

    expect(await screen.findByText(dict.statusFailedTitle)).toBeInTheDocument();
  });
});
