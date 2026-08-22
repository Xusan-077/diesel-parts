"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { MOTION } from "@/components/providers/motion-provider";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

/**
 * The one modal chrome: overlay, panel, title, dismiss, scrolling body and a
 * pinned footer. Three dialogs had already grown their own copy of the Radix
 * plumbing — the auth flow, the inquiry form, the filter drawer — and each had
 * drifted a little (different z-index, different overlay opacity, a close
 * button in three shapes). Everything new goes through here.
 *
 * `center` is the form variant: a card in the middle of the viewport.
 * `sheet` is the same panel hinged to the bottom edge, which is what a phone
 * gets when the thing being shown is navigation rather than a form.
 */
export type FormModalVariant = "center" | "sheet";

const PANEL_CLASS: Record<FormModalVariant, string> = {
  center:
    "fixed left-1/2 top-1/2 z-100 flex max-h-[85dvh] w-[calc(100vw-2rem)] max-w-lg flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-2xl",
  sheet:
    "fixed inset-x-0 bottom-0 z-100 flex max-h-[85dvh] flex-col overflow-hidden rounded-t-lg border-t border-border bg-surface shadow-2xl",
};

/*
 * `center` writes its own x/y because motion owns `transform` on the element —
 * a Tailwind `-translate-x-1/2` would be overwritten the moment the animation
 * runs and the panel would fall out of the middle.
 */
const PANEL_MOTION: Record<FormModalVariant, React.ComponentProps<typeof motion.div>> = {
  center: {
    initial: { opacity: 0, scale: 0.96, x: "-50%", y: "-50%" },
    animate: { opacity: 1, scale: 1, x: "-50%", y: "-50%" },
    exit: { opacity: 0, scale: 0.96, x: "-50%", y: "-50%" },
    transition: MOTION.pop,
  },
  sheet: {
    initial: { y: "100%" },
    animate: { y: 0 },
    exit: { y: "100%" },
    transition: MOTION.drawer,
  },
};

export interface FormModalShellProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  /** Rendered as the dialog's description; omit and the panel has none. */
  description?: React.ReactNode;
  /** Names the icon-only dismiss control, which carries no text. */
  closeLabel: string;
  variant?: FormModalVariant;
  /** Pinned below the scrolling body — the place for Save / Cancel. */
  footer?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

export function FormModalShell({
  open,
  onOpenChange,
  title,
  description,
  closeLabel,
  variant = "center",
  footer,
  className,
  children,
}: FormModalShellProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal forceMount>
        <AnimatePresence>
          {open ? (
            <Dialog.Overlay asChild forceMount key="overlay">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={MOTION.fade}
                className="fixed inset-0 z-100 bg-black/70"
              />
            </Dialog.Overlay>
          ) : null}
        </AnimatePresence>

        <AnimatePresence>
          {open ? (
            <Dialog.Content
              asChild
              forceMount
              key="panel"
              // Radix links the panel to its Description through context. When
              // there is none, the attribute has to be actively cleared or it
              // points at an id that never renders.
              {...(description === undefined ? { "aria-describedby": undefined } : {})}
            >
              <motion.div {...PANEL_MOTION[variant]} className={cn(PANEL_CLASS[variant], className)}>
                <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
                  <div className="min-w-0">
                    <Dialog.Title className="type-title text-foreground">{title}</Dialog.Title>
                    {description === undefined ? null : (
                      <Dialog.Description className="mt-1 type-caption text-muted">
                        {description}
                      </Dialog.Description>
                    )}
                  </div>
                  <Dialog.Close
                    aria-label={closeLabel}
                    className="-mr-2 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
                  >
                    <Icon icon={X} size="md" />
                  </Dialog.Close>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>

                {footer === undefined ? null : (
                  <div className="flex shrink-0 items-center justify-end gap-3 border-t border-border px-6 py-4">
                    {footer}
                  </div>
                )}
              </motion.div>
            </Dialog.Content>
          ) : null}
        </AnimatePresence>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
