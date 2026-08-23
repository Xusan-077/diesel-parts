import { describe, expect, it } from "vitest";
import { buildProductImageSvg } from "./product-image";

describe("buildProductImageSvg", () => {
  it("produces a valid SVG document", () => {
    const svg = buildProductImageSvg({
      name: "CAT 3126 Fuel Injector",
      sku: "DP-INJ-3126",
      brandName: "CAT",
      brandId: "cat",
    });
    expect(svg.trim().startsWith("<svg")).toBe(true);
    expect(svg.trim().endsWith("</svg>")).toBe(true);
  });

  it("escapes XML-significant characters in the name and SKU", () => {
    const svg = buildProductImageSvg({
      name: `Volvo <L60> "H&L" pump`,
      sku: "DP<>&\"",
      brandName: "Volvo",
      brandId: "volvo",
    });
    expect(svg).not.toContain("<L60>");
    expect(svg).toContain("&lt;L60&gt;");
    expect(svg).toContain("&amp;");
    expect(svg).toContain("&quot;");
  });

  it("falls back to a default color for an unknown brand", () => {
    const svg = buildProductImageSvg({
      name: "Generic Part",
      sku: "DP-GEN-1",
      brandName: "Generic",
      brandId: "unknown-brand",
    });
    expect(svg).toContain("#4b5563");
  });

  it("wraps a long name onto multiple lines instead of one overflowing line", () => {
    const svg = buildProductImageSvg({
      name: "Komatsu PC200-8 Excavator Main Hydraulic Pump Assembly",
      sku: "DP-HYP-PC200",
      brandName: "Komatsu",
      brandId: "komatsu",
    });
    const tspanCount = (svg.match(/<tspan/g) ?? []).length;
    expect(tspanCount).toBeGreaterThan(1);
    expect(tspanCount).toBeLessThanOrEqual(3);
  });
});
