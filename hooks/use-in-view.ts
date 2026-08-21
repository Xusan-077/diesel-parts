"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Fires once, the first time an element is scrolled into view.
 *
 * Once, because everything on this page that uses it is an entrance: a section
 * arriving, a figure counting up. Replaying those on the way back up turns a
 * page into an aquarium, and a visitor scrolling up is usually looking for
 * something they already read. The observer disconnects on that first hit, so a
 * long home page is not left holding a dozen live observers for effects that
 * have already finished.
 *
 * Where there is no `IntersectionObserver` — the server, and any environment
 * without one — the answer is `true`: "in view" is the permissive state, and a
 * caller that hides content until it hears otherwise must never be told "not
 * yet" by an environment that will never say anything else.
 */
export function useInView<T extends Element>(options?: {
  /** How much of the element has to be showing. */
  amount?: number;
  /** Start early, so a section is already arriving when it reaches the edge. */
  rootMargin?: string;
}): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);

  const amount = options?.amount ?? 0.15;
  const rootMargin = options?.rootMargin ?? "0px 0px -10% 0px";

  // Read during render rather than in the effect, so the "no observer" case is
  // a value this hook returns rather than a state it has to set.
  const supported = typeof IntersectionObserver !== "undefined";

  useEffect(() => {
    const node = ref.current;
    if (node === null || !supported) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        /*
         * Scrolled past counts as seen, and this is not a nicety.
         *
         * A jump — a restored scroll position, ctrl+End, a link to an anchor —
         * moves the viewport without any section between here and there ever
         * intersecting. On `isIntersecting` alone those sections would stay
         * hidden for the life of the page, so scrolling back up would reveal
         * blank space where the content is. Anything already above the
         * viewport has had its entrance, whether or not anyone watched it.
         */
        const arrived = entries.some(
          (entry) => entry.isIntersecting || entry.boundingClientRect.top < 0
        );

        if (arrived) {
          setSeen(true);
          observer.disconnect();
        }
      },
      { threshold: amount, rootMargin }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [amount, rootMargin, supported]);

  return [ref, seen || !supported];
}
