"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useScrollDirection } from "@/hooks/use-scroll-direction";
import { isHeaderCondensed } from "@/lib/scroll-direction";

/**
 * The sticky shell around the header rows.
 *
 * Three rows of chrome is a lot to keep on screen while someone reads a spec
 * table, so the top bar gets out of the way once the visitor is reading
 * downwards, and comes back the moment they scroll up or return to the top.
 *
 * It gets out of the way by *sliding*, not by shrinking, and that distinction
 * is the whole reason this component has a `ResizeObserver` in it.
 *
 * The row used to collapse by animating `grid-template-rows` from `1fr` to
 * `0fr`, which changed the header's height — and the header is the first thing
 * in the document, so its height is an offset on everything below it. Shrinking
 * it shortened the page, the browser's scroll anchoring moved `scrollY` to keep
 * the anchored content still, and this component read that self-inflicted
 * movement as the visitor scrolling *up*. So it expanded, which lengthened the
 * page, which moved `scrollY` the other way, which read as scrolling down. One
 * flick of a wheel left the header oscillating for as long as the page was
 * open, frozen part-collapsed: measured at 22 reversals per second with no
 * input at all after the first 22ms.
 *
 * Sliding cannot do that. The header keeps its full height in the document at
 * every moment; condensing only moves where that box paints, which the layout
 * never sees. Once the visitor is past the top the header floats over the
 * article anyway, so translating it up by exactly the top bar's height puts
 * that row above the viewport and reveals more of what they were reading —
 * `scrollY` and the page height both stay exactly where they were.
 *
 * `transform` is also the cheap half of this: the old collapse relaid out the
 * whole page on every frame of the transition, because `grid-template-rows` and
 * `padding` are layout properties. This one is composited.
 *
 * Only this component subscribes to scroll. Everything below it stays a server
 * component and reacts through the `data-condensed` attribute, which the rows
 * read with Tailwind's `group-data-[condensed]/header:` variant.
 *
 * `prefers-reduced-motion` already flattens every transition in globals.css, so
 * the header simply snaps for those visitors.
 */
export function HeaderShell({
  topbar,
  children,
}: {
  topbar: ReactNode;
  children: ReactNode;
}) {
  const condensed = isHeaderCondensed(useScrollDirection());

  /*
   * Measured rather than hardcoded, and re-measured rather than read once: the
   * top bar carries a phone number and a language switcher, so it is one
   * narrow viewport away from wrapping to two lines. A constant here would
   * leave part of the row on screen at exactly the widths where the header can
   * least afford it.
   */
  const topbarRef = useRef<HTMLDivElement>(null);
  const [topbarHeight, setTopbarHeight] = useState(0);

  useEffect(() => {
    const node = topbarRef.current;
    if (node === null) {
      return;
    }

    const observer = new ResizeObserver(([entry]) => {
      setTopbarHeight(entry.contentRect.height);
    });
    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  return (
    <header
      data-condensed={condensed ? "" : undefined}
      // Zero on the server and on the first client render, which is also when
      // `condensed` is false — so the header paints in its resting state and
      // the measurement lands before it can ever be asked to move.
      style={condensed ? { transform: `translateY(-${topbarHeight}px)` } : undefined}
      // `bg-chrome` is the dark material, and only the top bar shows it now:
      // the two rows below carry `header-plate`, which paints over it and
      // swaps the chrome palette for the page's own. The class stays on the
      // header itself because the base layer's focus-ring rule is keyed to it
      // — inside the plate `--chrome-foreground` is near-black, outside it is
      // near-white, and one selector covers both.
      //
      // No `border-b` here any more. The rows own their own bottom edges, and
      // against a white plate a second line under the first is visible rather
      // than merely redundant.
      className="group/header sticky top-0 z-50 bg-chrome transition-transform duration-300 ease-out"
    >
      <div ref={topbarRef}>{topbar}</div>
      {children}
    </header>
  );
}
