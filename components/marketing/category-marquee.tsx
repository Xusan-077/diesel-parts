"use client";

import { motion } from "motion/react";
import { useInfiniteMarquee } from "@/hooks/use-infinite-marquee";
import { cn } from "@/lib/utils";
import type { Locale } from "@/lib/i18n/locales";
import type { Category } from "@/lib/types";
import { CategoryCard } from "./category-card";

/**
 * The catalog's departments, as one travelling row at every width.
 *
 * It was a five-column grid: three rows on a laptop and eight on a phone, most
 * of a screen spent on signposts before the visitor has seen a single part.
 * The belt says the same thing in one row and gives the rest of the page back.
 *
 * A row is also the more honest shape. A grid implies a set worth reading
 * through; this is a list of doors, and the belt carries them past until one
 * of them is the one you wanted — which is why it is a belt rather than a
 * carousel with arrows. There is nothing here to page through in order.
 *
 * See `useInfiniteMarquee` for the loop, and for the three cases where it
 * steps aside: reduced motion, a row too short to cover the window, and the
 * first paint before anything has been measured. All three leave an ordinary
 * horizontal scroll rail, which is what a visitor with no JavaScript gets too.
 */
export function CategoryMarquee({
  categories,
  lang,
}: {
  categories: readonly Category[];
  lang: Locale;
}) {
  const { viewportRef, trackRef, copyRef, looping, hold, release } = useInfiniteMarquee();

  function cards(decorative: boolean) {
    return categories.map((category) => (
      /*
        The trailing space is the card's own padding rather than a flex `gap`,
        and it has to be: one copy's width is one lap, and with a gap the seam
        between the two copies would be one space narrower than every other
        join — so the belt would hitch, once a lap, forever.
      */
      <li
        key={category.id}
        className="w-40 shrink-0 pr-4 sm:w-44"
        aria-hidden={decorative || undefined}
      >
        <CategoryCard category={category} lang={lang} interactive={!decorative} />
      </li>
    ));
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      <div
        ref={viewportRef}
        /*
          A finger down stops the belt, and so does a pointer resting on it or
          a keyboard tab landing inside. All three are somebody trying to read
          one card, and a card that walks away mid-read is the entire reason
          auto-scrolling rows have the reputation they have.
        */
        onPointerEnter={hold}
        onPointerLeave={release}
        onPointerDown={hold}
        onPointerUp={release}
        onPointerCancel={release}
        onFocusCapture={hold}
        onBlurCapture={release}
        className={cn(
          "relative",
          // Before the loop starts — and whenever it cannot — this is an
          // ordinary scroll rail, which is exactly what reduced motion should
          // get: the same row, moved by hand.
          looping ? "overflow-hidden" : "overflow-x-auto",
          // The cards dissolve at both edges rather than being cut off, so the
          // belt reads as passing through the column, not ending at it.
          "[mask-image:linear-gradient(to_right,transparent,#000_24px,#000_calc(100%-24px),transparent)]"
        )}
      >
        <div ref={trackRef} className="flex w-max">
          <ul ref={copyRef} className="flex w-max">
            {cards(false)}
          </ul>
          {looping ? <ul className="flex w-max">{cards(true)}</ul> : null}
        </div>
      </div>
    </motion.div>
  );
}
