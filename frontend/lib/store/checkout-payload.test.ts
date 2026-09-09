import { describe, expect, it } from "vitest";
import { toBackendCheckoutBody } from "./checkout-payload";
import type { CheckoutRequestInput } from "@/lib/schemas";

const base: CheckoutRequestInput = {
  firstName: "Aziz",
  lastName: "Karimov",
  phone: "90 123 45 67",
  deliveryMethod: "PICKUP",
  termsAccepted: true,
  paymentMethod: "ONLINE",
};

describe("toBackendCheckoutBody", () => {
  it("passes the contact phone and payment method straight through", () => {
    const body = toBackendCheckoutBody({ ...base, paymentMethod: "CASH" });

    expect(body.phone).toBe("90 123 45 67");
    expect(body.paymentMethod).toBe("CASH");
  });

  it("resolves the region slug to its label for a delivery order", () => {
    const body = toBackendCheckoutBody({
      ...base,
      deliveryMethod: "DELIVERY",
      region: "samarkand",
      district: "Urgut",
      street: "Amir Temur",
      house: "12",
    });

    expect(body.region).toBe("Samarqand viloyati");
    expect(body.district).toBe("Urgut");
    expect(body.house).toBe("12");
  });

  it("leaves region undefined when none was chosen", () => {
    expect(toBackendCheckoutBody(base).region).toBeUndefined();
  });
});
