/**
 * The two observers jsdom does not implement.
 *
 * `IntersectionObserver` is what every entrance animation on the site waits
 * on, and `ResizeObserver` is what the marquee measures a lap with. Neither
 * has anything to report in a test environment — nothing scrolls and nothing
 * resizes — so a stub that observes and never fires is the honest stand-in.
 * The components under test then render their resting state, which is the
 * state assertions are about.
 *
 * Never assigned over an existing implementation, so a real one (a browser, a
 * future jsdom) always wins.
 */
export function stubObservers(): void {
  class Inert {
    readonly root = null;
    readonly rootMargin = "";
    readonly thresholds: readonly number[] = [];
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords(): [] {
      return [];
    }
  }

  const target = globalThis as {
    ResizeObserver?: typeof ResizeObserver;
    IntersectionObserver?: typeof IntersectionObserver;
  };

  target.ResizeObserver ??= Inert as unknown as typeof ResizeObserver;
  target.IntersectionObserver ??= Inert as unknown as typeof IntersectionObserver;
}
