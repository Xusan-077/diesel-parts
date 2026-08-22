import Image from "next/image";
import Link from "next/link";
import type { Dictionary } from "@/lib/i18n/dictionaries";

/**
 * The page's closing call, set on the parts flat-lay.
 *
 * The artwork (public/Ehtiyot_qism_kerakmi.png, 2097×750) is a photograph of
 * parts arranged around a deliberately empty middle — it was shot to have type
 * set in it, which is exactly the shape this banner already had: a centred
 * heading, a line of copy and one button. `object-center` is what keeps that
 * middle: on a phone the banner is narrower than the picture's 2.8:1, so
 * `object-cover` crops the sides and it is the empty centre that has to
 * survive the crop.
 *
 * The scrim is `--chrome`, the same near-black the header and the footer are
 * made of, and the copy takes `--chrome-foreground` / `--chrome-secondary` —
 * the small palette that exists to be read on that material. That is what
 * makes the banner theme-proof: the photograph is a light one and does not
 * re-step for dark mode, so page foregrounds would put near-black type on a
 * near-white picture in one of the two themes. At 80% the wash measures 9.0:1
 * for the heading and 4.9:1 for the paragraph against the brightest pixel in
 * the image, and the parts around the edges still read as parts. Same rule as
 * the hero: a scrim darkens, it does not bleach.
 *
 * The button keeps the accent fill it always had. `--accent-foreground` is
 * measured against that fill rather than against the page, so it carries onto
 * the photograph unchanged.
 */
export function CtaBanner({ home }: { home: Dictionary["home"] }) {
  return (
    <section className="relative isolate overflow-hidden rounded-lg border border-chrome-border px-6 py-16 text-center">
      <Image
        src="/Ehtiyot_qism_kerakmi.png"
        /* Decorative: the heading in front of it already says what it says. */
        alt=""
        fill
        sizes="(min-width: 1280px) 1280px, 100vw"
        className="-z-10 object-cover object-center"
      />
      <div aria-hidden className="absolute inset-0 -z-10 bg-chrome/80" />

      <h2 className="text-2xl font-semibold text-chrome-foreground sm:text-3xl">
        {home.ctaBannerTitle}
      </h2>
      <p className="mx-auto mt-3 max-w-xl text-sm text-chrome-secondary">{home.ctaBannerText}</p>
      <Link
        href="/contact"
        className="mt-8 inline-block rounded-md bg-accent px-6 py-3 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover active:bg-accent-active"
      >
        {home.ctaBannerButton}
      </Link>
    </section>
  );
}
