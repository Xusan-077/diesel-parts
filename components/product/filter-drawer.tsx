"use client";

import { useState, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "motion/react";
import { SlidersHorizontal, X } from "lucide-react";
import { MOTION } from "@/components/providers/motion-provider";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

/**
 * The filter panel as a drawer, for screens with no room for a sidebar.
 *
 * Same Radix dialog and same slide-in as the header's menu, so the site has
 * one drawer rather than two that behave slightly differently. The trigger
 * carries the count of filters already narrowing the grid: on a phone the
 * sidebar is out of sight, and without that number a visitor cannot tell a
 * short result list from a filtered one.
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
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={MOTION.drawer}
                className="fixed inset-y-0 left-0 z-100 flex w-full max-w-sm flex-col bg-background text-foreground"
              >
                <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
                  <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
                  <Dialog.Close
                    aria-label={closeLabel}
                    className="flex h-10 w-10 items-center justify-center rounded-md transition-colors hover:bg-surface-hover"
                  >
                    <Icon icon={X} size="lg" />
                  </Dialog.Close>
                </div>

                {/* The results update live behind the drawer, so this scrolls
                    and the footer button only dismisses. */}
                <div className="flex-1 overflow-y-auto p-4">{children}</div>

                <div className="shrink-0 border-t border-border p-4">
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
