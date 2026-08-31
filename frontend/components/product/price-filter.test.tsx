// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PriceFilter } from "./price-filter";
import dictionary from "@/dictionaries/uz.json";

const dict = dictionary.catalog;
const BOUNDS = { min: 100_000, max: 5_000_000 };

/** The filter as the sidebar wires it: it owns no state, the catalog does. */
function Harness({
  onChange,
  initial = [null, null] as [number | null, number | null],
}: {
  onChange?: (min: number | null, max: number | null) => void;
  initial?: [number | null, number | null];
}) {
  const [range, setRange] = useState(initial);

  return (
    <>
      <PriceFilter
        bounds={BOUNDS}
        min={range[0]}
        max={range[1]}
        onChange={(min, max) => {
          setRange([min, max]);
          onChange?.(min, max);
        }}
        lang="uz"
        dict={dict}
      />
      <button type="button" onClick={() => setRange([null, null])}>
        tashqaridan tozalash
      </button>
    </>
  );
}

const from = () => screen.getByLabelText(dict.priceFromLabel) as HTMLInputElement;
const to = () => screen.getByLabelText(dict.priceToLabel) as HTMLInputElement;
const lowThumb = () => screen.getByLabelText(dict.priceSliderFrom) as HTMLInputElement;

afterEach(cleanup);

describe("PriceFilter", () => {
  it("starts empty, because no bound is not the same as the cheapest part", () => {
    render(<Harness />);
    expect(from().value).toBe("");
    expect(to().value).toBe("");
  });

  it("reports what was typed, digit by digit, with no apply step", async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await userEvent.type(from(), "500000");
    expect(onChange).toHaveBeenLastCalledWith(500_000, null);
  });

  it("does not group or clamp while the reader is still typing", async () => {
    // "50" clamped to the catalog minimum before "500 000" was finished would
    // fight the typing.
    render(<Harness />);
    await userEvent.type(from(), "50");
    expect(from().value).toBe("50");
  });

  it("groups and clamps the entry once the box is left", async () => {
    render(<Harness />);
    await userEvent.type(from(), "50");
    await userEvent.tab();

    expect(from().value).toBe("100 000");
  });

  it("swaps ends the reader typed the wrong way round", async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await userEvent.type(from(), "2000000");
    await userEvent.type(to(), "500000");
    await userEvent.tab();

    expect(onChange).toHaveBeenLastCalledWith(500_000, 2_000_000);
    expect(from().value).toBe("500 000");
    expect(to().value).toBe("2 000 000");
  });

  it("ignores everything that is not a digit", async () => {
    render(<Harness />);
    await userEvent.type(to(), "2 000 000 so'm");
    expect(to().value).toBe("2000000");
  });

  it("moves the boxes when a thumb moves", () => {
    render(<Harness />);
    fireEvent.change(lowThumb(), { target: { value: "2000000" } });
    expect(from().value).toBe("2 000 000");
  });

  it("clears an end when its thumb is parked back on the track's own end", () => {
    // The two are the same result set today, but the catalog's bounds move as
    // stock changes, and a frozen ceiling would start hiding new parts.
    const onChange = vi.fn();
    render(<Harness onChange={onChange} initial={[2_000_000, null]} />);

    fireEvent.change(lowThumb(), { target: { value: String(BOUNDS.min) } });
    expect(onChange).toHaveBeenLastCalledWith(null, null);
    expect(from().value).toBe("");
  });

  it("sizes the step to the catalog, not to a fixed figure", () => {
    // 10 000 across a 31-million catalog is three thousand arrow presses from
    // one end of the track to the other.
    render(<Harness />);
    expect(lowThumb().getAttribute("step")).toBe("10000");
  });

  it("rewrites the boxes when the range is cleared from somewhere else", async () => {
    render(<Harness initial={[500_000, 2_000_000]} />);
    expect(from().value).toBe("500 000");

    await userEvent.click(screen.getByRole("button", { name: "tashqaridan tozalash" }));
    expect(from().value).toBe("");
    expect(to().value).toBe("");
  });
});
