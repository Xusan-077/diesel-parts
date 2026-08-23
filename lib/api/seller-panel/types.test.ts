import { describe, expect, it } from "vitest";
import { canTransitionOrderStatus } from "./types";

describe("canTransitionOrderStatus", () => {
  it("allows the forward sequence NEW -> CONFIRMED -> PREPARING -> COMPLETED", () => {
    expect(canTransitionOrderStatus("NEW", "CONFIRMED")).toBe(true);
    expect(canTransitionOrderStatus("CONFIRMED", "PREPARING")).toBe(true);
    expect(canTransitionOrderStatus("PREPARING", "COMPLETED")).toBe(true);
  });

  it("allows cancelling from NEW, CONFIRMED or PREPARING", () => {
    expect(canTransitionOrderStatus("NEW", "CANCELLED")).toBe(true);
    expect(canTransitionOrderStatus("CONFIRMED", "CANCELLED")).toBe(true);
    expect(canTransitionOrderStatus("PREPARING", "CANCELLED")).toBe(true);
  });

  it("rejects skipping a step forward", () => {
    expect(canTransitionOrderStatus("NEW", "PREPARING")).toBe(false);
    expect(canTransitionOrderStatus("NEW", "COMPLETED")).toBe(false);
  });

  it("treats COMPLETED and CANCELLED as terminal", () => {
    expect(canTransitionOrderStatus("COMPLETED", "CANCELLED")).toBe(false);
    expect(canTransitionOrderStatus("CANCELLED", "NEW")).toBe(false);
  });
});
