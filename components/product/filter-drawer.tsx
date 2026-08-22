"use client";

import { useState, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "motion/react";
import { SlidersHorizontal, X } from "lucide-react";
import { MOTION } from "@/components/providers/motion-provider";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

/**
 * The filter panel as a bottom sheet, for screens with no room for a sidebar.
 *
 * It rises from the bottom rather than sliding in from the side, which is the
 * side of a phone a thumb can actually reach: the header's navigation drawer
 * is opened once and read top-down, while this one is opened, adjusted,
 * adjusted again and dismissed. Same Radix dialog and the same easing, so the
 * two still feel like one site.
 *
 * Capped at 85vh with the results left visible above it, because the grid
 * behind updates as each filter lands — a sheet that covered the page would
 * turn a live panel back into a form. The trigger carries the count of filters
 * already narrowing the grid: on a phone the sidebar is out of sight, and
 * without that number a visitor cannot tell a short result list from a
 * filtered one.
 */
export function FilterDrawer({
  triggerLabel,
  title,
  closeLabel,
  applyLabel,
  activeCount,
  children,
  className,
}: {
  triggerLabel: string;
  title: string;
  closeLabel: string;
  /** Dismisses the drawer. The filters have already applied behind it. */
  applyLabel: string;
  activeCount: number;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        className={cn(
          "inline-flex h-10 items-center gap-2 rounded-md border border-border-strong px-3 text-sm font-medium text-foreground transition-colors hover:bg-surface-hover",
          className
        )}
      >
        <Icon icon={SlidersHorizontal} />
        {triggerLabel}
        {activeCount > 0 ? (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-xs font-semibold tabular-nums text-accent-foreground">
            {activeCount}
          </span>
        ) : null}
      </Dialog.Trigger>

      <Dialog.Portal forceMount>
        <AnimatePresence>
          {open ? (
            <Dialog.Overlay asChild forceMount key="overlay">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={MOTION.fade}
                className="fixed inset-0 z-100 bg-black/60"
              />
            </Dialog.Overlay>
          ) : null}
        </AnimatePresence>

        <AnimatePresence>
          {open ? (
            <Dialog.Content asChild forceMount key="drawer" aria-describedby={undefined}>
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={MOTION.drawer}
                className="fixed inset-x-0 bottom-0 z-100 flex max-h-[85dvh] flex-col rounded-t-lg border-t border-border bg-background text-foreground shadow-xl"
              >
                {/* The grab handle is the only thing that says "this came from
                    the bottom edge and goes back there". */}
                <div className="flex shrink-0 justify-center pt-2" aria-hidden>
                  <span className="h-1 w-9 rounded-full bg-border-strong" />
                </div>

                <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
                  <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
                  <Dialog.Close
                    aria-label={closeLabel}
                    className="flex h-10 w-10 items-center justify-center rounded-md transition-colors hover:bg-surface-hover"
                  >
                    <Icon icon={X} size="lg" />
                  </Dialog.Close>
                </div>

                {/* The results update live behind the sheet, so this scrolls
                    and the footer button only dismisses. */}
                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">{children}</div>

                {/* Padded for the home indicator: on iOS the bottom 34px of the
                    viewport is the system gesture area, and a button under it
                    swipes the app away instead of closing the sheet. */}
                <div className="shrink-0 border-t border-border p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                  <Dialog.Close className="flex h-11 w-full items-center justify-center rounded-md bg-accent text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/90">
                    {applyLabel}
                  </Dialog.Close>
                </div>
              </motion.div>
            </Dialog.Content>
          ) : null}
        </AnimatePresence>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
