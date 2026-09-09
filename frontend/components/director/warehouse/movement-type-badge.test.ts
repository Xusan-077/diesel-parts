import { describe, expect, it } from "vitest";
import { signedQuantity } from "./movement-type-badge";

describe("signedQuantity", () => {
  it("reads stock leaving as a negative", () => {
    expect(signedQuantity("OUT", 3)).toEqual({ text: "−3", tone: "out" });
    expect(signedQuantity("WRITE_OFF", 5)).toEqual({ text: "−5", tone: "out" });
    expect(signedQuantity("RESERVE", 2)).toEqual({ text: "−2", tone: "out" });
  });

  it("reads stock arriving as a positive", () => {
    expect(signedQuantity("PURCHASE", 10)).toEqual({ text: "+10", tone: "in" });
    expect(signedQuantity("TRANSFER_IN", 4)).toEqual({ text: "+4", tone: "in" });
    expect(signedQuantity("RELEASE", 1)).toEqual({ text: "+1", tone: "in" });
  });

  it("normalises a already-signed magnitude", () => {
    expect(signedQuantity("OUT", -3)).toEqual({ text: "−3", tone: "out" });
  });
});
