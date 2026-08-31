// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { HeaderShell } from "./header-shell";
import { DEFAULT_SCROLL_THRESHOLDS } from "@/lib/scroll-direction";

/*
 * The bug these guard against is a feedback loop, not a wrong branch.
 *
 * The header is the first thing in the document, so its height is an offset on
 * everything below it. When it condensed by shrinking, the page got shorter,
 * the browser's scroll anchoring moved `scrollY` to compensate, and
 * `useScrollDirection` read that as the visitor scrolling the other way — which
 * reversed the header, which resized the page again. Measured in Chrome, one
 * wheel gesture left it reversing 22 times a second, stopped part-collapsed,
 * for as long as the page stayed open.
 *
 * jsdom has no layout, so it cannot observe the loop itself. What it can hold
 * is the property that makes the loop impossible: condensing moves the header
 * and never resizes it. Every assertion below is a restatement of that.
 */

const { offset, threshold } = DEFAULT_SCROLL_THRESHOLDS;

/** jsdom ships no ResizeObserver, and the shell measures the top bar with one. */
function stubResizeObserver(height: number) {
  const instances: { callback: ResizeObserverCallback; target: Element | null }[] = [];

  vi.stubGlobal(
    "ResizeObserver",
    class {
      private readonly entry: { callback: ResizeObserverCallback; target: Element | null };

      constructor(callback: ResizeObserverCallback) {
        this.entry = { callback, target: null };
        instances.push(this.entry);
      }

      observe(target: Element) {
        this.entry.target = target;
      }

      disconnect() {
        this.entry.target = null;
      }
    }
  );

  /** Delivers the measurement the browser would have delivered on mount. */
  return function measure() {
    act(() => {
      for (const { callback, target } of instances) {
        if (target !== null) {
          callback(
            [{ contentRect: { height } } as unknown as ResizeObserverEntry],
            {} as ResizeObserver
          );
        }
      }
    });
  };
}

/** Puts the window at `y` and lets the hook's rAF-coalesced listener catch up. */
function scrollTo(y: number) {
  act(() => {
    window.scrollY = y;
    window.dispatchEvent(new Event("scroll"));
    vi.advanceTimersToNextFrame();
  });
}

function renderShell() {
  render(
    <HeaderShell topbar={<div data-testid="topbar">Top bar</div>}>
      <div data-testid="rows">Logo and navigation</div>
    </HeaderShell>
  );

  return {
    header: screen.getByRole("banner"),
    topbar: screen.getByTestId("topbar"),
  };
}

const TOPBAR_HEIGHT = 37;

beforeEach(() => {
  vi.useFakeTimers();
  window.scrollY = 0;
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("HeaderShell", () => {
  it("rests uncondensed and untransformed at the top of the page", () => {
    stubResizeObserver(TOPBAR_HEIGHT)();
    const { header } = renderShell();

    expect(header.hasAttribute("data-condensed")).toBe(false);
    expect(header.style.transform).toBe("");
  });

  it("slides up by the top bar's measured height when the visitor reads down", () => {
    const measure = stubResizeObserver(TOPBAR_HEIGHT);
    const { header } = renderShell();
    measure();

    scrollTo(offset + 400);

    expect(header.hasAttribute("data-condensed")).toBe(true);
    expect(header.style.transform).toBe(`translateY(-${TOPBAR_HEIGHT}px)`);
  });

  it("uses the height it was told, not a constant", () => {
    const measure = stubResizeObserver(64);
    const { header } = renderShell();
    measure();

    scrollTo(offset + 400);

    // A top bar that wrapped to two lines has to clear the viewport too.
    expect(header.style.transform).toBe("translateY(-64px)");
  });

  it("keeps the top bar rendered while condensed, so nothing has to reflow", () => {
    const measure = stubResizeObserver(TOPBAR_HEIGHT);
    const { header, topbar } = renderShell();
    measure();

    scrollTo(offset + 400);

    expect(document.body.contains(topbar)).toBe(true);
    // The old collapse animated the wrapper's `grid-template-rows` to `0fr`.
    // Anything that reduces the header's own box reopens the loop.
    expect(header.className).not.toMatch(/grid-rows|h-0|max-h/);
    expect(topbar.parentElement?.className ?? "").not.toMatch(/grid-rows|h-0|max-h/);
  });

  it("brings the top bar back on the way up", () => {
    const measure = stubResizeObserver(TOPBAR_HEIGHT);
    const { header } = renderShell();
    measure();

    scrollTo(offset + 400);
    scrollTo(offset + 200);

    expect(header.hasAttribute("data-condensed")).toBe(false);
    expect(header.style.transform).toBe("");
  });

  it("settles either open or closed however hard the visitor thrashes", () => {
    const measure = stubResizeObserver(TOPBAR_HEIGHT);
    const { header } = renderShell();
    measure();

    // Alternating flings, each well past the threshold that filters noise.
    let y = offset + 1000;
    for (const delta of [400, -300, 500, -450, 250, -200, 600, -550]) {
      y += delta;
      scrollTo(y);
    }

    // The state is one of exactly two, and the transform agrees with it —
    // never a third, part-collapsed reading of its own animation.
    const condensed = header.hasAttribute("data-condensed");
    expect(header.style.transform).toBe(
      condensed ? `translateY(-${TOPBAR_HEIGHT}px)` : ""
    );
  });

  it("ignores movement too small to be a decision", () => {
    const measure = stubResizeObserver(TOPBAR_HEIGHT);
    const { header } = renderShell();
    measure();

    scrollTo(offset + 400);
    scrollTo(offset + 400 - (threshold - 1));

    expect(header.hasAttribute("data-condensed")).toBe(true);
  });
});
