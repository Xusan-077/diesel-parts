import { describe, expect, it } from "vitest";
import { formatCartMessage } from "./inquiry-message";

describe("formatCartMessage", () => {
  it("returns the message unchanged when there is no cart", () => {
    expect(formatCartMessage("Need a quote", [])).toBe("Need a quote");
  });

  it("appends the cart as readable lines, since there is no OrderItem table yet", () => {
    const result = formatCartMessage("Need a quote", [
      { sku: "DP-INJ-3126", quantity: 2 },
      { sku: "DP-TRB-PC200", quantity: 1 },
    ]);

    expect(result).toBe("Need a quote\n\nCart:\n- DP-INJ-3126 × 2\n- DP-TRB-PC200 × 1");
  });

  it("keeps the cart when the customer left no message", () => {
    expect(formatCartMessage("", [{ sku: "A", quantity: 1 }])).toBe("Cart:\n- A × 1");
  });
});
