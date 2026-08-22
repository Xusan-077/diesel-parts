// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import uz from "@/dictionaries/uz.json";
import type { HeroSlide as Slide } from "@/lib/data/hero-slides";

/*
 * The hero is a manifest away from being three different components, and the
 * whole point of the design is that a client can move between those three by
 * editing a list. These pin that contract down: what ships today (no photos)
 * must keep working, and adding files must not need a code change.
 */

const slides: Slide[] = [];

vi.mock("@/lib/data/hero-slides", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/data/hero-slides")>();
  return { ...actual, get heroSlides() { return slides; } };
});

// next/image needs a loader and a layout to measure; a plain <img> is enough
// to assert that the right file and alt text reached it.
vi.mock("next/image", () => ({
  // This *is* the stub standing in for next/image, so the rule's own advice is
  // what is being mocked out.
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

const { Hero } = await import("./hero");

function slide(image: string, title?: string): Slide {
  return {
    image,
    alt: { uz: `${image} alt`, ru: "", en: "" },
    ...(title ? { title: { uz: title, ru: title, en: title } } : {}),
  };
}

function renderHero() {
  return render(<Hero home={uz.home} common={uz.common} lang="uz" />);
}

beforeEach(() => {
  slides.length = 0;

  // jsdom implements no media engine, and `HeroLamp` asks whether there is a
  // fine pointer before it starts tracking one. Answering "no" is the truthful
  // reply for a headless DOM and keeps the effect from running at all.
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: false,
      addEventListener: () => {},
      removeEventListener: () => {},
    })),
  );

  // Embla watches its slides to know which one is in view. jsdom ships no
  // observer, and one that never fires is correct here: nothing is ever
  // actually on screen, so these tests assert what was rendered rather than
  // which slide is selected.
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    },
  );

  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Hero with no photographs", () => {
  it("renders the dictionary copy over the grid", () => {
    renderHero();

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(uz.home.heroTitle);
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("ships no carousel", () => {
    renderHero();
    expect(screen.queryByRole("region", { name: uz.home.heroCarouselLabel })).toBeNull();
  });
});

describe("Hero with one photograph", () => {
  it("puts it behind the copy without becoming a carousel", () => {
    slides.push(slide("workshop.webp"));
    renderHero();

    const image = screen.getByRole("img");
    expect(image.getAttribute("src")).toBe("/hero/workshop.webp");
    expect(image.getAttribute("alt")).toBe("workshop.webp alt");
    expect(screen.queryByRole("region", { name: uz.home.heroCarouselLabel })).toBeNull();
  });

  it("still falls back to the dictionary copy when the slide sets none", () => {
    slides.push(slide("workshop.webp"));
    renderHero();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(uz.home.heroTitle);
  });
});

describe("Hero with several photographs", () => {
  beforeEach(() => {
    slides.push(slide("one.webp", "Birinchi"), slide("two.webp", "Ikkinchi"));
  });

  it("becomes a labelled carousel", () => {
    renderHero();
    expect(screen.getByRole("region", { name: uz.home.heroCarouselLabel })).toBeDefined();
  });

  it("renders every slide, each with its own copy", () => {
    renderHero();

    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings.map((heading) => heading.textContent)).toEqual(["Birinchi", "Ikkinchi"]);
  });

  it("offers the arrows, which are now the only way through it", () => {
    renderHero();

    expect(screen.getByRole("button", { name: uz.common.carouselPrev })).toBeDefined();
    expect(screen.getByRole("button", { name: uz.common.carouselNext })).toBeDefined();
  });

  // Nothing advances on its own any more, so there is no timer to stop and no
  // stop button to offer. This pins that down: a pause control reappearing
  // means autoplay came back with it.
  it("offers no play or pause control, because nothing moves on its own", () => {
    renderHero();

    const buttons = screen.getAllByRole("button").map((button) => button.getAttribute("aria-label"));
    expect(buttons).not.toContain("Avtomatik aylanishni to'xtatish");
    expect(buttons).not.toContain("Avtomatik aylanishni yoqish");
  });
});
