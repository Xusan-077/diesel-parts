"use client";

import { usePathname } from "next/navigation";
import { motion } from "motion/react";

/**
 * A short fade-and-rise as one warehouse page replaces another.
 *
 * Keyed on the pathname, so each navigation remounts the subtree and plays the
 * entrance once. No exit animation on purpose — App Router swaps the server
 * tree synchronously, and holding the old page on screen to animate it out
 * fights the framework. `MotionConfig reducedMotion="user"` (motion-provider)
 * already flattens this to a cut for anyone who asked for less motion.
 */
export function WarehousePageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}
