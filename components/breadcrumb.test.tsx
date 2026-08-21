// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Breadcrumb, BreadcrumbJsonLd } from "./breadcrumb";
import type { BreadcrumbItem } from "@/lib/breadcrumb";

const trail: BreadcrumbItem[] = [
  { label: "Bosh sahifa", href: "/" },
  { label: "Barcha mahsulotlar", href: "/products" },
  { label: "CAT 3126 forsunka" },
];

afterEach(cleanup);

describe("Breadcrumb", () => {
  it("renders nothing for an empty trail", () => {
    const { container } = render(<Breadcrumb items={[]} label="Sahifa yo'li" />);
    expect(container.firstChild).toBeNull();
  });

  it("names the landmark so it can be skipped to", () => {
    render(<Breadcrumb items={trail} label="Sahifa yo'li" />);
    expect(screen.getByRole("navigation", { name: "Sahifa yo'li" })).toBeDefined();
  });

  it("is an ordered list, because the order is the meaning", () => {
    const { container } = render(<Breadcrumb items={trail} label="Sahifa yo'li" />);
    expect(container.querySelector("ol")).not.toBeNull();
    expect(container.querySelectorAll("li")).toHaveLength(3);
  });

  it("links every crumb but the one you are standing on", () => {
    render(<Breadcrumb items={trail} label="Sahifa yo'li" />);

    expect(screen.getByRole("link", { name: "Bosh sahifa" }).getAttribute("href")).toBe("/");
    expect(screen.getByRole("link", { name: "Barcha mahsulotlar" }).getAttribute("href")).toBe(
      "/products"
    );
    expect(screen.queryByRole("link", { name: "CAT 3126 forsunka" })).toBeNull();
  });

  it("marks the last crumb as the current page", () => {
    render(<Breadcrumb items={trail} label="Sahifa yo'li" />);
    expect(screen.getByText("CAT 3126 forsunka").getAttribute("aria-current")).toBe("page");
  });

  /*
   * The separator is drawn by CSS rather than inserted as a text node, so a
   * screen reader announces three place names instead of "Bosh sahifa slash
   * Barcha mahsulotlar slash".
   */
  it("keeps the separators out of the accessible text", () => {
    const { container } = render(<Breadcrumb items={trail} label="Sahifa yo'li" />);
    expect(container.textContent).not.toContain("/");
  });
});

describe("BreadcrumbJsonLd", () => {
  function payload(items: BreadcrumbItem[]): Record<string, unknown> {
    const { container } = render(<BreadcrumbJsonLd items={items} />);
    const script = container.querySelector('script[type="application/ld+json"]');
    return JSON.parse(script?.innerHTML ?? "{}");
  }

  it("emits nothing for an empty trail", () => {
    const { container } = render(<BreadcrumbJsonLd items={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("numbers the list from one, in order", () => {
    const data = payload(trail) as { itemListElement: { position: number; name: string }[] };

    expect(data.itemListElement.map((entry) => entry.position)).toEqual([1, 2, 3]);
    expect(data.itemListElement.map((entry) => entry.name)).toEqual([
      "Bosh sahifa",
      "Barcha mahsulotlar",
      "CAT 3126 forsunka",
    ]);
  });

  it("omits the url on the crumb that has none", () => {
    const data = payload(trail) as { itemListElement: { item?: string }[] };
    expect(data.itemListElement.at(-1)?.item).toBeUndefined();
  });

  it("escapes a name that would otherwise close the script tag", () => {
    const { container } = render(
      <BreadcrumbJsonLd items={[{ label: "</script><img>" }]} />
    );
    const html = container.querySelector("script")?.innerHTML ?? "";

    expect(html).not.toContain("</script>");
    expect(html).toContain("\\u003c");
  });
});
