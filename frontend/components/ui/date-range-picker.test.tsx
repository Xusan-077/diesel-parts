// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { stubObservers } from "@/lib/test/stub-observers";
import { DateRangePicker } from "./date-range-picker";

/*
 * Radix's popover reaches for a few browser APIs jsdom has no answer for. None
 * of them affect what these tests assert — they are about which days can be
 * picked and what comes back when they are — so they are stubbed rather than
 * worked around.
 */
beforeAll(() => {
  stubObservers();
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.setPointerCapture ??= () => {};
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
});

afterEach(cleanup);

/** A Saturday, mid-quarter, with plenty of month either side of it. */
const TODAY = "2026-08-22";

function setup(
  overrides: Partial<React.ComponentProps<typeof DateRangePicker>> = {},
) {
  const onApply = vi.fn();
  const onClear = vi.fn();

  render(
    <DateRangePicker
      start="2026-08-10"
      end="2026-08-20"
      max={TODAY}
      maxDays={366}
      onApply={onApply}
      onClear={onClear}
      {...overrides}
    >
      <button type="button">Boshqa oraliq</button>
    </DateRangePicker>,
  );

  return { onApply, onClear, user: userEvent.setup() };
}

/** A day cell, found the way a screen reader finds it. */
function day(label: string): HTMLButtonElement {
  return screen.getByRole("button", { name: label }) as HTMLButtonElement;
}

/** This suite carries no jest-dom, so the DOM is read directly. */
function focused(): Element | null {
  return document.activeElement;
}

async function open(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Boshqa oraliq" }));
  return screen.getByRole("dialog", { name: "Oraliqni tanlang" });
}

describe("DateRangePicker", () => {
  it("opens showing the window in force, and how long it is", async () => {
    const { user } = setup();
    const panel = await open(user);

    // Both months of the window are on screen, the later one on the right.
    expect(within(panel).getByText("Iyul 2026")).toBeDefined();
    expect(within(panel).getByText("Avgust 2026")).toBeDefined();

    expect(within(panel).getByText("2026-08-10 → 2026-08-20")).toBeDefined();
    expect(within(panel).getByText("11 kun")).toBeDefined();
  });

  it("takes two clicks to make a window, and holds Apply until the second", async () => {
    const { user, onApply } = setup();
    const panel = await open(user);
    const apply = within(panel).getByRole("button", { name: "Qo'llash" });

    await user.click(day("3 Avgust 2026"));

    // One end is not a window. The line under the calendar says what is
    // missing rather than reporting a mistake that has not happened yet.
    expect((apply as HTMLButtonElement).disabled).toBe(true);
    expect(within(panel).getByText("Oraliqning ikkinchi kunini tanlang.")).toBeDefined();

    await user.click(day("14 Avgust 2026"));

    expect((apply as HTMLButtonElement).disabled).toBe(false);
    expect(within(panel).getByText("12 kun")).toBeDefined();

    await user.click(apply);
    expect(onApply).toHaveBeenCalledWith({ start: "2026-08-03", end: "2026-08-14" });
  });

  it("orders the window whichever end was clicked first", async () => {
    const { user, onApply } = setup();
    const panel = await open(user);

    await user.click(day("14 Avgust 2026"));
    await user.click(day("3 Avgust 2026"));
    await user.click(within(panel).getByRole("button", { name: "Qo'llash" }));

    expect(onApply).toHaveBeenCalledWith({ start: "2026-08-03", end: "2026-08-14" });
  });

  it("cannot be pointed at a day the report has no data for", async () => {
    const { user } = setup();
    await open(user);

    expect(day("22 Avgust 2026").disabled).toBe(false);
    // Tomorrow. The window is measured against the server's clock, and there
    // is nothing on the other side of it yet.
    expect(day("23 Avgust 2026").disabled).toBe(true);
  });

  it("refuses a window wider than the report accepts, and says how wide", async () => {
    const { user } = setup({ maxDays: 10 });
    const panel = await open(user);

    await user.click(day("1 Avgust 2026"));
    // Out of the anchor's reach, so it cannot be clicked into a bad range.
    expect(day("20 Avgust 2026").disabled).toBe(true);

    expect(
      within(panel).getByText("Eng uzuni 10 kun. Boshlanish sanasini kechroq oling."),
    ).toBeDefined();
  });

  it("sets both ends at once from a named span", async () => {
    const { user, onApply } = setup();
    const panel = await open(user);

    await user.click(within(panel).getByRole("button", { name: "O'tgan oy" }));
    expect(within(panel).getByText("2026-07-01 → 2026-07-31")).toBeDefined();
    expect(within(panel).getByText("31 kun")).toBeDefined();

    await user.click(within(panel).getByRole("button", { name: "Qo'llash" }));
    expect(onApply).toHaveBeenCalledWith({ start: "2026-07-01", end: "2026-07-31" });
  });

  it("gives the grid one tab stop and moves it with the arrow keys", async () => {
    const { user } = setup();
    await open(user);

    // The cursor starts on the window's last day, which is where the popover
    // put focus — the arrow keys work on the first press, not the second.
    expect(focused()).toBe(day("20 Avgust 2026"));
    expect(day("20 Avgust 2026").tabIndex).toBe(0);
    expect(day("19 Avgust 2026").tabIndex).toBe(-1);

    await user.keyboard("{ArrowLeft}");
    expect(focused()).toBe(day("19 Avgust 2026"));

    await user.keyboard("{ArrowUp}");
    expect(focused()).toBe(day("12 Avgust 2026"));

    // A page steps a month, and lands on the same day number.
    await user.keyboard("{PageUp}");
    expect(focused()).toBe(day("12 Iyul 2026"));
  });

  it("drops a hand-picked window without having to pick another one", async () => {
    const { user, onClear } = setup();
    const panel = await open(user);

    await user.click(within(panel).getByRole("button", { name: "Tozalash" }));
    expect(onClear).toHaveBeenCalled();
  });
});
