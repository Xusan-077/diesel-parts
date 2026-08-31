// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrandFilter } from "./brand-filter";
import type { Brand } from "@/lib/types";
import dictionary from "@/dictionaries/uz.json";

const dict = dictionary.catalog;

const BRANDS: Brand[] = [
  { id: "cat", slug: "cat", name: "CAT" },
  { id: "komatsu", slug: "komatsu", name: "Komatsu" },
  { id: "volvo", slug: "volvo", name: "Volvo", logoUrl: "https://cdn.example/volvo.svg" },
  { id: "hitachi", slug: "hitachi", name: "Hitachi" },
  { id: "jcb", slug: "jcb", name: "JCB" },
  { id: "hyundai", slug: "hyundai", name: "Hyundai" },
  { id: "doosan", slug: "doosan", name: "Doosan" },
];

function renderBrands(value: string[] = []) {
  const onToggle = vi.fn();
  render(<BrandFilter brands={BRANDS} value={value} onToggle={onToggle} dict={dict} />);
  return { onToggle };
}

afterEach(cleanup);

describe("BrandFilter", () => {
  it("ticks a brand, and reports which one", async () => {
    const { onToggle } = renderBrands();
    await userEvent.click(screen.getByRole("checkbox", { name: "CAT" }));
    expect(onToggle).toHaveBeenCalledWith("cat");
  });

  it("lets several stand at once — the whole point of the checkbox set", () => {
    renderBrands(["cat", "komatsu"]);
    expect((screen.getByRole("checkbox", { name: "CAT" }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole("checkbox", { name: "Komatsu" }) as HTMLInputElement).checked).toBe(
      true
    );
    expect((screen.getByRole("checkbox", { name: "Volvo" }) as HTMLInputElement).checked).toBe(
      false
    );
  });

  it("unticks one that was already on", async () => {
    const { onToggle } = renderBrands(["cat"]);
    await userEvent.click(screen.getByRole("checkbox", { name: "CAT" }));
    expect(onToggle).toHaveBeenCalledWith("cat");
  });

  it("holds the tail of the list back behind one toggle", async () => {
    renderBrands();
    expect(screen.queryByRole("checkbox", { name: "Doosan" })).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: `${dict.showMore} (1)` }));
    expect(screen.getByRole("checkbox", { name: "Doosan" })).toBeTruthy();
  });

  it("names the checkbox after the brand, not after its mark", () => {
    // The label wraps the box, so a mark left readable would be announced as
    // part of what the reader is ticking: "Komatsu KOM".
    renderBrands();
    expect(screen.getByRole("checkbox", { name: "Komatsu" })).toBeTruthy();
  });

  it("draws the brand's mark when there is one, and initials when there is not", () => {
    renderBrands();

    const logo = document.querySelector("img");
    expect(logo?.getAttribute("src")).toBe("https://cdn.example/volvo.svg");
    // Decorative: the name is already the label, and alt text repeating it
    // would have a screen reader say every brand twice.
    expect(logo?.getAttribute("alt")).toBe("");

    expect(screen.getByText("KOM")).toBeTruthy();
  });
});
