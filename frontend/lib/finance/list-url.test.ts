import { describe, expect, it } from "vitest";
import { financeListUrl } from "./list-url";

describe("financeListUrl", () => {
  it("returns the bare base when every value is empty", () => {
    expect(financeListUrl("/director/finance", { q: "", method: undefined, page: 1 })).toBe(
      "/director/finance",
    );
  });

  it("drops the page=1 default but keeps page 2+", () => {
    expect(financeListUrl("/director/finance", { page: 1 })).toBe("/director/finance");
    expect(financeListUrl("/director/finance", { page: 3 })).toBe("/director/finance?page=3");
  });

  it("keeps the filters that are set", () => {
    expect(
      financeListUrl("/director/finance/expenses", {
        q: "ijara",
        category: "RENT",
        dateFrom: "2026-09-01",
        page: 2,
      }),
    ).toBe("/director/finance/expenses?q=ijara&category=RENT&dateFrom=2026-09-01&page=2");
  });

  it("treats null and empty string the same as undefined", () => {
    expect(
      financeListUrl("/x", { a: null as unknown as undefined, b: "", c: undefined }),
    ).toBe("/x");
  });
});
