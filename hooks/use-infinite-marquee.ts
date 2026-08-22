"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { advanceOffset, canLoop } from "@/lib/marquee";
import { REDUCED_MOTION_QUERY, useMediaQuery } from "./use-media-query";

export interface InfiniteMarqueeOptions {
  /**
   * Belt speed in pixels per second. Slow by default — this is ambient motion
   * behind cards a visitor is meant to read, not a ticker.
   */
  speed?: number;
  /** Which way the cards travel. */
  direction?: "left" | "right";
  /** Switch the belt off entirely, e.g. above the breakpoint where a grid takes over. */
  enabled?: boolean;
}

export interface InfiniteMarquee {
  /** The clipping window. Also the width the belt is measured against. */
  viewportRef: React.RefObject<HTMLDivElement | null>;
  /** The element that is translated. Holds both copies. */
  trackRef: React.RefObject<HTMLDivElement | null>;
  /** The first copy of the cards. Its width is one full loop. */
  copyRef: React.RefObject<HTMLUListElement | null>;
  /**
   * Whether the belt is looping at all.
   *
   * `false` under reduced motion, above the breakpoint, or when the cards are
   * too few to fill the window. The caller renders one copy on a scroll rail
   * instead of two on a belt — a duplicate that never moves is a bug a visitor
   * can see.
   */
  looping: boolean;
  /** Stop the belt: a finger is down, a pointer is over it, or focus is inside. */
  hold: () => void;
  /** Let it go again. Balanced against `hold`, so overlapping holds nest. */
  release: () => void;
}

/**
 * A continuously travelling row of cards that never reaches an end.
 *
 * The belt is one element translated by a frame loop and nothing else. No
 * state changes per frame, no scroll position is written, no card is measured
 * while it moves: the loop reads a number, adds to it and writes one
 * `translate3d`, which the compositor takes without laying the page out again.
 *
 * It stops the moment it is not earning its keep — off screen, held under a
 * finger, or when the visitor has asked for reduced motion, where the belt is
 * replaced by an ordinary horizontal scroll rail rather than a slower belt.
 * A preference for less motion is not a preference for the same motion, gently.
 */
export function useInfiniteMarquee({
  speed = 26,
  direction = "left",
  enabled = true,
}: InfiniteMarqueeOptions = {}): InfiniteMarquee {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const copyRef = useRef<HTMLUListElement | null>(null);

  const reduced = useMediaQuery(REDUCED_MOTION_QUERY);

  /*
   * Starts false, and stays false until something has actually been measured.
   *
   * That order matters for the visitor with no JavaScript, not for the code:
   * a belt is a clipped window that only reveals its contents because a frame
   * loop is moving them, so a page that renders one and then never runs the
   * loop shows three cards and hides the rest with no way to reach them.
   * Resting state is therefore the scroll rail — reachable by hand, by
   * anybody — and the loop is what the measurement upgrades it to.
   */
  const [wideEnough, setWideEnough] = useState(false);
  const [onScreen, setOnScreen] = useState(true);
  const [holding, setHolding] = useState(false);

  const looping = enabled && !reduced && wideEnough;
  const running = looping && onScreen && !holding;

  const offset = useRef(0);
  const period = useRef(0);
  const holds = useRef(0);

  // --- Measure one loop --------------------------------------------------
  useEffect(() => {
    const viewport = viewportRef.current;
    const copy = copyRef.current;
    if (viewport === null || copy === null || !enabled) {
      return;
    }

    const measure = () => {
      /*
       * The cards carry their own trailing space as padding instead of a flex
       * `gap`, so one copy's width is exactly one loop — with a gap, the seam
       * between the two copies would be one space short and the belt would
       * hitch once per lap.
       */
      period.current = copy.offsetWidth;
      setWideEnough(canLoop(copy.offsetWidth, viewport.clientWidth));
    };

    measure();

    // Guarded rather than assumed: this hook is exercised in jsdom, which has
    // no ResizeObserver, and one measurement is enough there — nothing in a
    // test environment resizes.
    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(measure);
    observer.observe(copy);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [enabled]);

  // --- Don't animate what nobody is looking at ---------------------------
  useEffect(() => {
    const viewport = viewportRef.current;
    if (viewport === null || !looping || typeof IntersectionObserver === "undefined") {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => setOnScreen(entry?.isIntersecting ?? true),
      { threshold: 0 }
    );
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [looping]);

  // --- The loop ----------------------------------------------------------
  useEffect(() => {
    const track = trackRef.current;
    if (track === null || !running) {
      return;
    }

    track.style.willChange = "transform";
    const pxPerSecond = direction === "left" ? speed : -speed;

    /*
     * Local to this run of the effect, so a belt that has been held under a
     * finger for ten seconds does not jump ten seconds' worth of travel when
     * it is released: the first frame after a resume has no previous time and
     * only records one.
     */
    let previous = 0;
    let frame = 0;

    const step = (time: number) => {
      if (previous !== 0) {
        offset.current = advanceOffset(offset.current, time - previous, pxPerSecond, period.current);
        track.style.transform = `translate3d(${offset.current}px, 0, 0)`;
      }
      previous = time;
      frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frame);
      track.style.willChange = "";
    };
  }, [running, speed, direction]);

  // --- Put the track back when the belt is switched off -------------------
  useEffect(() => {
    if (looping) {
      return;
    }
    const track = trackRef.current;
    if (track !== null) {
      track.style.transform = "";
      offset.current = 0;
    }
  }, [looping]);

  /*
   * Counted rather than boolean: a finger down and focus inside are two
   * independent reasons to stop, and whichever ends first must not restart the
   * belt while the other still holds it.
   */
  const hold = useCallback(() => {
    holds.current += 1;
    setHolding(true);
  }, []);

  const release = useCallback(() => {
    holds.current = Math.max(0, holds.current - 1);
    if (holds.current === 0) {
      setHolding(false);
    }
  }, []);

  return { viewportRef, trackRef, copyRef, looping, hold, release };
}
