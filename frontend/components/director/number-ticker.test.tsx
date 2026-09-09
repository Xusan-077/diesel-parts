// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { NumberTicker } from "./number-ticker";

/** jsdom has no media engine; every test here asks for the settled figure. */
function stubReducedMotion() {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("NumberTicker", () => {
  it("formats by name, not by a passed-in function", () => {
    // The prop is a serializable key because every caller is a Server
    // Component and a function prop cannot cross the RSC boundary.
    stubReducedMotion();

    const { container: integer } = render(<NumberTicker value={12345} format="integer" />);
    expect(integer.querySelector(".sr-only")?.textContent).toBe("12 345");

    const { container: sum } = render(<NumberTicker value={9000} format="sum" />);
    expect(sum.querySelector(".sr-only")?.textContent).toBe("9 000 so'm");
  });

  it("rounds the raw number when no format is named", () => {
    stubReducedMotion();
    const { container } = render(<NumberTicker value={41.7} />);
    expect(container.querySelector(".sr-only")?.textContent).toBe("42");
  });
});
