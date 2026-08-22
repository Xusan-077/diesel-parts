// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { WorkshopBackdrop } from "./workshop-backdrop";

/** jsdom has no media engine, so the machine preference is stubbed per test. */
function stubReducedMotion(reduce: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: reduce,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

/** The scene root, which is the one element the pointer ever writes to. */
function scene(container: HTMLElement): HTMLElement {
  return container.firstElementChild as HTMLElement;
}

function movePointer(x: number, y: number) {
  act(() => {
    const event = new Event("pointermove") as PointerEvent & { clientX: number; clientY: number };
    Object.assign(event, { clientX: x, clientY: y });
    window.dispatchEvent(event);
  });
}

/**
 * jsdom's `requestAnimationFrame` runs on a timer, so the frame the listener
 * schedules is drained by hand rather than waited for.
 */
async function nextFrame() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("WorkshopBackdrop", () => {
  it("draws two gears and the sweep, and hides all of it from the reader", () => {
    stubReducedMotion(false);
    const { container } = render(<WorkshopBackdrop />);

    expect(scene(container).getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelectorAll(".nf-gear").length).toBe(2);
    expect(container.querySelectorAll(".nf-sweep").length).toBe(1);
  });

  /*
   * The whole point of the parallax implementation: the pointer writes two
   * custom properties on one element and nothing else moves in JS. If this
   * ever becomes a state update, every pointer move re-renders the scene.
   */
  it("writes the pointer offset as custom properties on the scene", async () => {
    stubReducedMotion(false);
    const { container } = render(<WorkshopBackdrop />);
    const root = scene(container);

    expect(root.style.getPropertyValue("--nf-x")).toBe("");

    movePointer(window.innerWidth, window.innerHeight / 2);
    await nextFrame();

    expect(root.style.getPropertyValue("--nf-x")).toBe("13.0px");
    expect(root.style.getPropertyValue("--nf-y")).toBe("0.0px");
  });

  it("leaves the scene alone when the visitor asked for less motion", async () => {
    stubReducedMotion(true);
    const { container } = render(<WorkshopBackdrop />);
    const root = scene(container);

    movePointer(window.innerWidth, window.innerHeight);
    await nextFrame();

    expect(root.style.getPropertyValue("--nf-x")).toBe("");
  });
});
