"use client";

import { usePathname } from "next/navigation";
import { motion } from "motion/react";

/**
 * A short fade-and-rise as one finance tab replaces another. Keyed on the
 * pathname so each navigation remounts and plays the entrance once. Same as
 * `WarehousePageTransition` — kept module-local rather than shared, matching
 * how the warehouse module carries its own.
 */
export function FinancePageTransition({ children }: { children: React.ReactNode }) {
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
