"use client";

import { MotionConfig, type Transition } from "motion/react";

/**
 * Shared open/close timings. Declared as plain `Transition` objects — an
 * `as const` here would make `ease` a readonly tuple, which motion rejects.
 */
export const MOTION: Record<"fade" | "pop" | "drawer", Transition> = {
  fade: { duration: 0.15, ease: "easeOut" },
  pop: { duration: 0.18, ease: [0.16, 1, 0.3, 1] },
  drawer: { duration: 0.2, ease: [0.16, 1, 0.3, 1] },
};

export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
