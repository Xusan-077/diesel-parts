import { describe, expect, it } from "vitest";
import type { ResolvedProduct } from "@/lib/product-lookup";
import type { Product } from "@/lib/types";
import {
  forgetSnapshot,
  parseSnapshots,
  readSnapshots,
  recordSnapshots,
  type SnapshotMap,
} from "./snapshot";

function product(id: string): Product {
  return {
    id,
    slug: id,
    name: { uz: id, ru: id, en: id },
    sku: id,
    oemNumbers: [],
    price: 100,
    categoryId: "injector",
    brandId: "cat",
    description: { uz: "", ru: "", en: "" },
    compatibleModels: [],
    stockStatus: "available",
    specs: [],
    imageUrl: null,
  };
}

function entry(id: string): ResolvedProduct {
  return { product: product(id), brandName: "CAT", categoryName: "Forsunka" };
}

describe("recordSnapshots", () => {
  it("returns the map untouched for an empty write", () => {
    const current: SnapshotMap = {};
    expect(recordSnapshots(current, [], "uz")).toBe(current);
  });

  it("stores each row under its product id with the capture locale", () => {
    const map = recordSnapshots({}, [entry("a"), entry("b")], "ru");

    expect(Object.keys(map).sort()).toEqual(["a", "b"]);
    expect(map.a.lang).toBe("ru");
    expect(map.a.entry.product.id).toBe("a");
  });

  it("overwrites an earlier snapshot of the same product", () => {
    const first = recordSnapshots({}, [entry("a")], "uz");
    const second = recordSnapshots(first, [{ ...entry("a"), brandName: "Bosch" }], "uz");

    expect(second.a.entry.brandName).toBe("Bosch");
    expect(second.a.seq).toBeGreaterThan(first.a.seq);
  });

  it("evicts the least recently written entries past the limit", () => {
    let map = recordSnapshots({}, [entry("a"), entry("b")], "uz", 3);
    map = recordSnapshots(map, [entry("c")], "uz", 3);
    map = recordSnapshots(map, [entry("d")], "uz", 3);

    expect(Object.keys(map).sort()).toEqual(["b", "c", "d"]);
  });

  it("keeps a re-recorded entry alive against eviction", () => {
    let map = recordSnapshots({}, [entry("a"), entry("b")], "uz", 2);
    map = recordSnapshots(map, [entry("a")], "uz", 2);
    map = recordSnapshots(map, [entry("c")], "uz", 2);

    expect(Object.keys(map).sort()).toEqual(["a", "c"]);
  });
});

describe("readSnapshots", () => {
  const map = recordSnapshots({}, [entry("a"), entry("b")], "uz");

  it("returns the rows in the order asked for", () => {
    expect(readSnapshots(map, ["b", "a"], "uz")?.map((e) => e.product.id)).toEqual([
      "b",
      "a",
    ]);
  });

  it("returns an empty list for no ids, not null", () => {
    expect(readSnapshots(map, [], "uz")).toEqual([]);
  });

  it("returns null when one id is missing", () => {
    expect(readSnapshots(map, ["a", "z"], "uz")).toBeNull();
  });

  it("returns null when the captions were captured in another language", () => {
    expect(readSnapshots(map, ["a"], "ru")).toBeNull();
  });
});

describe("forgetSnapshot", () => {
  it("drops the entry", () => {
    const map = recordSnapshots({}, [entry("a"), entry("b")], "uz");
    expect(Object.keys(forgetSnapshot(map, "a"))).toEqual(["b"]);
  });

  it("returns the same map when there is nothing to drop", () => {
    const map = recordSnapshots({}, [entry("a")], "uz");
    expect(forgetSnapshot(map, "z")).toBe(map);
  });
});

describe("parseSnapshots", () => {
  it("round-trips what recordSnapshots wrote", () => {
    const map = recordSnapshots({}, [entry("a")], "uz");
    expect(parseSnapshots(JSON.parse(JSON.stringify(map)))).toEqual(map);
  });

  it("rejects anything that is not a plain object", () => {
    expect(parseSnapshots(null)).toEqual({});
    expect(parseSnapshots([1, 2])).toEqual({});
    expect(parseSnapshots("{}")).toEqual({});
  });

  it("drops entries whose key and product id disagree", () => {
    const map = recordSnapshots({}, [entry("a")], "uz");
    expect(parseSnapshots({ b: map.a })).toEqual({});
  });

  it("drops entries missing the locale or the sequence", () => {
    const map = recordSnapshots({}, [entry("a")], "uz");
    expect(parseSnapshots({ a: { ...map.a, lang: undefined } })).toEqual({});
    expect(parseSnapshots({ a: { ...map.a, seq: "1" } })).toEqual({});
  });
});
