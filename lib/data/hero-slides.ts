import type { LocalizedText } from "@/lib/types";

/**
 * The home page hero, as a list of slides.
 *
 * Images live in `public/hero/` and are named here. Adding a photograph is
 * dropping the file in that folder and adding an entry below — no upload
 * endpoint, no blob store, no admin screen, and the file is served straight
 * off the CDN with the rest of the static assets.
 *
 * An empty list is the supported starting state, and is what ships today: the
 * hero then renders exactly as it did before, copy over the inspection grid.
 * One entry renders a single still hero with that photograph behind it; two or
 * more turn it into a carousel. Nothing else has to change.
 *
 * Per-slide copy is optional. Leave `title` off and the slide uses the
 * dictionary's own hero copy, which is what a purely photographic slide wants;
 * set it and the slide runs its own campaign line.
 */
export interface HeroSlide {
  /**
   * File name inside `public/hero/`, e.g. `"workshop.jpg"`.
   *
   * Landscape, at least 1600px wide. The copy sits on top of it, so pictures
   * with a busy centre read badly however the scrim is tuned.
   */
  image: string;
  /** What the photograph shows. Required — this is content, not decoration. */
  alt: LocalizedText;
  eyebrow?: LocalizedText;
  title?: LocalizedText;
  subtitle?: LocalizedText;
  /** Replaces the default "browse the catalogue" button for this slide. */
  cta?: {
    label: LocalizedText;
    href: string;
  };
}

export const heroSlides: HeroSlide[] = [];

/** Milliseconds a hero slide holds before the next one. */
export const HERO_AUTOPLAY_DELAY = 5000;
