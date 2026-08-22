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
 * `center` is the form variant: a card in the middle of the viewport, which
 * becomes a full screen below `sm` because a 90%-width card on a phone is a
 * worse form than a page and a worse page than a form.
 * `sheet` is the same panel hinged to the bottom edge, which is what a phone
 * gets when the thing being shown is navigation rather than a form.
 */
export type FormModalVariant = "center" | "sheet";

/**
 * How wide the card is allowed to get, chosen by how much form is in it.
 *
 * `md` is the historical width and stays the default, so every dialog that
 * predates this prop is untouched. The rule for new ones: one column of fields
 * is `md`, two columns are `lg`, and `xl` is for a two-column form long enough
 * that the reader needs the extra gutter to keep the pairs apart. `sm` is the
 * confirmation width — a sentence and two buttons, which looks evasive in a
 * wide card, as though something were being hidden in the whitespace.
 */
export type FormModalSize = "sm" | "md" | "lg" | "xl";

const SIZE_CLASS: Record<FormModalSize, string> = {
  sm: "sm:max-w-md",
  md: "sm:max-w-lg",
  lg: "sm:max-w-2xl",
  xl: "sm:max-w-4xl",
};

/*
 * Centring is done with the CSS `translate` property rather than a `transform`
 * utility, and that is load-bearing twice over.
 *
 * Motion owns `transform` on this element, so a Tailwind `-translate-x-1/2`
 * would be overwritten the moment the animation ran and the panel would fall
 * out of the middle. The old fix was to hand motion `x: "-50%", y: "-50%"` in
 * every keyframe. That worked, and it cost the panel its mobile layout: those
 * are inline styles, so no media query could unset them, and a full-screen
 * phone dialog was not expressible.
 *
 * `translate` is an independent property applied before `transform`, so the
 * two compose instead of colliding: CSS holds the position, motion holds the
 * scale, and `sm:` can scope the position to viewports that want a card.
 */
const PANEL_CLASS: Record<FormModalVariant, string> = {
  center: cn(
    "fixed z-100 flex flex-col overflow-hidden bg-surface-elevated",
    // Phone: a full screen, edge to edge, no corners and no border to trim it.
    "inset-0 max-h-dvh w-full",
    // From `sm` up: a card, centred, never taller than most of the viewport.
    "sm:inset-auto sm:top-1/2 sm:left-1/2 sm:[translate:-50%_-50%]",
    "sm:max-h-[85dvh] sm:w-[calc(100vw-2rem)] sm:rounded-lg sm:border sm:border-border sm:shadow-2xl",
  ),
  sheet:
    "fixed inset-x-0 bottom-0 z-100 flex max-h-[85dvh] flex-col overflow-hidden rounded-t-lg border-t border-border bg-surface-elevated shadow-2xl",
};

/*
 * Keyframes on `opacity` and `scale` only — never on `x`/`y` — so the CSS
 * above keeps ownership of where the panel sits. The sheet is the exception
 * and may animate `y`, because its position is not translate-based.
 *
 * The whole app is wrapped in `MotionConfig reducedMotion="user"`, so both of
 * these degrade to a plain cut for a reader who asked for less motion. No
 * guard is needed at this call site.
 */
const PANEL_MOTION: Record<FormModalVariant, React.ComponentProps<typeof motion.div>> = {
  center: {
    initial: { opacity: 0, scale: 0.96 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.96 },
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
  size?: FormModalSize;
  /**
   * Inks the header's rail red. For a dialog that destroys something — the one
   * case where the panel's "orange is never a status" rule would otherwise put
   * the accent on a dialog whose whole point is that it is not routine.
   */
  tone?: "default" | "danger";
  /** Pinned below the scrolling body — the place for Save and Cancel. */
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
  size = "md",
  tone = "default",
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
              <motion.div
                {...PANEL_MOTION[variant]}
                className={cn(
                  PANEL_CLASS[variant],
                  variant === "center" && SIZE_CLASS[size],
                  className,
                )}
              >
                <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-6 py-4">
                  {/*
                    * The same 2px rail a field wears, on the dialog's title. It
                    * is the panel's one structural mark, and it earns its place
                    * here by saying which kind of dialog this is before the
                    * title has been read: accent for a form you are filling in,
                    * red for one that destroys a record.
                    */}
                  <div
                    className={cn(
                      "min-w-0 border-l-2 pl-3",
                      tone === "danger" ? "border-danger" : "border-accent",
                    )}
                  >
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
                  /*
                   * On a phone the footer is the bottom of the screen, so it
                   * takes the safe-area inset — otherwise the save button sits
                   * under the home indicator on every recent iPhone. The
                   * buttons also go full width and stack, and `flex-col-reverse`
                   * is what lets the markup keep its reading order (Cancel,
                   * then Save) while showing Save on top, where the thumb is.
                   */
                  <div className="flex shrink-0 flex-col-reverse gap-3 border-t border-border px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] *:w-full sm:flex-row sm:items-center sm:justify-end sm:pb-4 sm:*:w-auto">
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
