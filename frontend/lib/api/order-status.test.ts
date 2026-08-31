import { describe, expect, it } from "vitest";
import { allowedTransitions, canTransition, isEditable, isTerminal } from "./order-status";

describe("allowedTransitions", () => {
  it("walks a draft forward one step at a time", () => {
    expect(allowedTransitions("DRAFT")).toEqual(["PENDING", "CANCELLED"]);
    expect(allowedTransitions("PENDING")).toEqual(["CONFIRMED", "CANCELLED"]);
    expect(allowedTransitions("CONFIRMED")).toEqual(["COMPLETED", "CANCELLED"]);
  });

  it("offers nothing from either end state", () => {
    expect(allowedTransitions("COMPLETED")).toEqual([]);
    expect(allowedTransitions("CANCELLED")).toEqual([]);
  });
});

describe("canTransition", () => {
  it("allows every legal move", () => {
    expect(canTransition("DRAFT", "PENDING")).toBe(true);
    expect(canTransition("PENDING", "CONFIRMED")).toBe(true);
    expect(canTransition("CONFIRMED", "COMPLETED")).toBe(true);
  });

  it("allows cancelling from anywhere the order is still open", () => {
    expect(canTransition("DRAFT", "CANCELLED")).toBe(true);
    expect(canTransition("PENDING", "CANCELLED")).toBe(true);
    expect(canTransition("CONFIRMED", "CANCELLED")).toBe(true);
  });

  it("refuses a skipped step", () => {
    expect(canTransition("DRAFT", "COMPLETED")).toBe(false);
    expect(canTransition("DRAFT", "CONFIRMED")).toBe(false);
  });

  it("refuses a move backwards", () => {
    expect(canTransition("CONFIRMED", "PENDING")).toBe(false);
    expect(canTransition("PENDING", "DRAFT")).toBe(false);
  });

  it("refuses to reopen a finished order", () => {
    expect(canTransition("COMPLETED", "CANCELLED")).toBe(false);
    expect(canTransition("CANCELLED", "DRAFT")).toBe(false);
  });

  it("refuses a move to the status the order is already in", () => {
    expect(canTransition("DRAFT", "DRAFT")).toBe(false);
  });
});

describe("isTerminal", () => {
  it("marks the two end states and nothing else", () => {
    expect(isTerminal("COMPLETED")).toBe(true);
    expect(isTerminal("CANCELLED")).toBe(true);
    expect(isTerminal("DRAFT")).toBe(false);
    expect(isTerminal("CONFIRMED")).toBe(false);
  });
});

describe("isEditable", () => {
  it("allows edits while the deal is still being agreed", () => {
    expect(isEditable("DRAFT")).toBe(true);
    expect(isEditable("PENDING")).toBe(true);
  });

  it("freezes the order from CONFIRMED on, when it becomes a record", () => {
    expect(isEditable("CONFIRMED")).toBe(false);
    expect(isEditable("COMPLETED")).toBe(false);
    expect(isEditable("CANCELLED")).toBe(false);
  });
});
