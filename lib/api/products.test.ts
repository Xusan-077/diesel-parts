import { describe, expect, it } from "vitest";
import { productsQueryKey, toSearchParams } from "./products";

function asString(params: Parameters<typeof toSearchParams>[0]): string {
  return toSearchParams(params).toString();
}

describe("toSearchParams", () => {
  it("omits empty and default values", () => {
    expect(asString({ q: "", brandId: "all", categoryId: "all", availability: "all" })).toBe("");
  });

  it("serialises the real filters", () => {
    const result = toSearchParams({
      q: "turbo",
      brandId: "cat",
      categoryId: "injector",
      availability: "limited",
      sort: "name-asc",
      page: 2,
      pageSize: 12,
      lang: "ru",
    });
    expect(result.get("q")).toBe("turbo");
    expect(result.get("brand")).toBe("cat");
    expect(result.get("category")).toBe("injector");
    expect(result.get("availability")).toBe("limited");
    expect(result.get("sort")).toBe("name-asc");
    expect(result.get("page")).toBe("2");
    expect(result.get("pageSize")).toBe("12");
    expect(result.get("lang")).toBe("ru");
  });

  it("repeats categoryIds for a multi-category scope", () => {
    expect(toSearchParams({ categoryIds: ["injector", "piston"] }).getAll("categoryIds")).toEqual([
      "injector",
      "piston",
    ]);
  });

  it("still sends an empty scope, which means 'no products yet'", () => {
    expect(toSearchParams({ categoryIds: [] }).getAll("categoryIds")).toEqual([""]);
  });

  it("sends nothing when there is no scope at all", () => {
    expect(toSearchParams({}).has("categoryIds")).toBe(false);
  });
});

describe("productsQueryKey", () => {
  it("is stable for equal params", () => {
    expect(productsQueryKey({ q: "a", page: 1 })).toEqual(productsQueryKey({ q: "a", page: 1 }));
  });

  it("differs when a param changes", () => {
    expect(productsQueryKey({ page: 1 })).not.toEqual(productsQueryKey({ page: 2 }));
  });
});
