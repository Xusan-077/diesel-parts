// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { CountUp } from "./count-up";
import { COUNT_UP_MS } from "@/lib/count-up";

/*
 * The contract worth pinning here is not the easing — that is tested in
 * lib/count-up.test.ts — but what the figure says when the animation does not
 * or cannot run. A counter that leaves a visitor looking at "0+ mahsulot"
 * because a script did not start has broken the copy it was decorating.
 */

/** jsdom has neither; the hook needs one and the run needs the other. */
function stubObservers({ intersects }: { intersects: boolean }) {
  const targets: Element[] = [];
  let notify: (() => void) | null = null;

  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: IntersectionObserverCallback) {
        notify = () => {
          callback(
            targets.map(
              (target) =>
                ({
                  isIntersecting: intersects,
                  boundingClientRect: { top: intersects ? 10 : 500 },
                  target,
                }) as unknown as IntersectionObserverEntry
            ),
            this as unknown as IntersectionObserver
          );
        };
      }
      observe(target: Element) {
        targets.push(target);
      }
      disconnect() {
        targets.length = 0;
      }
    }
  );

  const frames: FrameRequestCallback[] = [];
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    frames.push(cb);
    return frames.length;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {});

  return {
    /** Delivers the observer callback React is waiting on. */
    reveal: () => act(() => notify?.()),
    /** Runs the pending frame at a point in the animation. */
    frame: (elapsedMs: number) =>
      act(() => {
        const next = frames.splice(0);
        for (const cb of next) {
          cb(elapsedMs);
        }
      }),
  };
}

function stubReducedMotion(reduce: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: reduce,
      addEventListener: () => {},
      removeEventListener: () => {},
    }))
  );
}

beforeEach(() => stubReducedMotion(false));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("CountUp", () => {
  it("renders the finished figure before anything has run", () => {
    stubObservers({ intersects: false });
    render(<CountUp label="10,000+ mahsulot" />);

    // This is the server HTML, and what a visitor with no JavaScript reads.
    expect(screen.getByLabelText("10,000+ mahsulot").textContent).toBe(
      "10,000+ mahsulot"
    );
  });

  it("leaves a line with no figure in it entirely alone", () => {
    stubObservers({ intersects: true });
    render(<CountUp label="OEM sifat" />);

    expect(screen.getByText("OEM sifat")).toBeDefined();
    // Nothing to count means no label, no timer, no observer.
    expect(screen.queryByLabelText("OEM sifat")).toBeNull();
  });

  it("counts up once the figure is scrolled to", () => {
    const { reveal, frame } = stubObservers({ intersects: true });
    render(<CountUp label="10,000+ mahsulot" />);

    reveal();
    frame(0);
    frame(COUNT_UP_MS * 0.4);

    const shown = screen.getByLabelText("10,000+ mahsulot").textContent ?? "";
    expect(shown).not.toBe("10,000+ mahsulot");
    expect(shown).toMatch(/\+ mahsulot$/);
  });

  it("keeps the grouping the copy was written with, mid-count", () => {
    const { reveal, frame } = stubObservers({ intersects: true });
    render(<CountUp label="10,000+ mahsulot" />);

    reveal();
    frame(0);
    frame(COUNT_UP_MS * 0.9);

    // A count that passes through "9000" where the copy says "10,000" has
    // quietly rewritten the copy.
    expect(screen.getByLabelText("10,000+ mahsulot").textContent).toMatch(/^\d,\d{3}\+/);
  });

  it("lands exactly on the written figure", () => {
    const { reveal, frame } = stubObservers({ intersects: true });
    render(<CountUp label="10,000+ mahsulot" />);

    reveal();
    frame(0);
    frame(COUNT_UP_MS);

    expect(screen.getByLabelText("10,000+ mahsulot").textContent).toBe(
      "10,000+ mahsulot"
    );
  });

  it("gives a reduced-motion visitor the figure, not an animation", () => {
    stubReducedMotion(true);
    const { reveal, frame } = stubObservers({ intersects: true });
    render(<CountUp label="10,000+ mahsulot" />);

    reveal();
    frame(0);

    expect(screen.getByLabelText("10,000+ mahsulot").textContent).toBe(
      "10,000+ mahsulot"
    );
  });

  it("announces the whole line once, not the digits as they change", () => {
    const { reveal, frame } = stubObservers({ intersects: true });
    render(<CountUp label="10,000+ mahsulot" />);

    reveal();
    frame(0);
    frame(COUNT_UP_MS * 0.5);

    const figure = screen.getByLabelText("10,000+ mahsulot");
    // The moving digits are hidden; the label carries the finished sentence.
    for (const child of figure.children) {
      expect(child.getAttribute("aria-hidden")).toBe("true");
    }
  });
});
