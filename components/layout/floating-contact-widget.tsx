"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Phone, X } from "lucide-react";
import { MOTION } from "@/components/providers/motion-provider";
import { Icon } from "@/components/ui/icon";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import { SUPPORT_CONTACT, telegramHref } from "@/lib/site-config";
import type { Dictionary } from "@/lib/i18n/dictionaries";

/*
 * The widget paints itself dark in both themes rather than reading the page
 * tokens most of it sits on — it is not page content, it floats over whatever
 * is underneath, the way a support chip does everywhere else on the web — but
 * it is the site's *own* dark material now: `bg-chrome`, `bg-chrome-surface`,
 * `text-chrome-foreground` and the rest, the same tokens the header and
 * footer paint with. This used to be a separate warm hex ramp chosen to read
 * as "not borrowed from another site" on its own terms; now that the site has
 * a dark material of its own — the chrome — matching it *is* what reads as
 * this site's, so the widget takes it directly. `--chrome` does not re-step
 * between light and dark theme (see the note on it in globals.css) and this
 * component is never nested inside `.header-plate`, so it keeps resolving to
 * the true dark frame regardless of the page's own theme, same as before.
 *
 * `--success` is the one token left out: it re-steps per theme (a light-mode
 * green would all but disappear on this permanently dark plate), and there is
 * no chrome-scoped equivalent to reach for instead. This is `--success`'s own
 * dark-theme value, held as a literal rather than a variable for that reason.
 */
const STATUS_ONLINE = "#7cd591";

/**
 * Telegram's own mark. Lucide ships a generic paper plane, which reads as
 * "send" rather than "Telegram" — and the brand is the point of that row.
 */
function TelegramGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M21.94 4.6 18.92 18.85c-.23 1.01-.83 1.26-1.68.78l-4.64-3.42-2.24 2.16c-.25.25-.46.46-.94.46l.33-4.73 8.6-7.77c.37-.33-.08-.52-.58-.19l-10.63 6.7-4.58-1.43c-1-.31-1.01-1 .21-1.48l17.9-6.9c.83-.3 1.56.2 1.27 1.57Z" />
    </svg>
  );
}

interface ChannelRowProps {
  href: string;
  external?: boolean;
  label: string;
  hint: string;
  children: React.ReactNode;
}

/*
 * A channel is a catalogue row, not a button: full-bleed, hairline-ruled, and
 * marked on its left edge when you point at it — the same gesture the parts
 * tables use to say "this is the line you are on".
 */
function ChannelRow({ href, external, label, hint, children }: ChannelRowProps) {
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
      className="group relative flex items-center gap-3 px-4 py-3.5 outline-none transition-colors hover:bg-chrome-surface focus-visible:bg-chrome-surface"
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-0.5 origin-top scale-y-0 bg-chrome-accent transition-transform duration-150 group-hover:scale-y-100 group-focus-visible:scale-y-100"
      />
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-chrome-hover text-chrome-accent">
        {children}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[0.8125rem] font-medium text-chrome-foreground">{label}</span>
        <span className="mt-0.5 block truncate text-xs text-chrome-secondary">{hint}</span>
      </span>
    </a>
  );
}

export interface FloatingContactWidgetProps {
  support: Dictionary["support"];
  closeLabel: string;
}

export function FloatingContactWidget({ support, closeLabel }: FloatingContactWidgetProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // Below this the panel is the bottom sheet described on its className, not
  // the corner card — see the scroll-lock effect below, the only behaviour
  // here with no CSS equivalent.
  const isMobileSheet = useMediaQuery("(max-width: 639px)");

  /*
   * Escape closes and returns focus to the button; a pointer landing anywhere
   * outside closes too. Above `sm` the panel stays dismissable furniture
   * rather than a modal — it never traps focus, and this is the only thing
   * that closes it on an outside click, since there is no backdrop there to
   * catch the pointer first. Below `sm` it is a bottom sheet with its own
   * backdrop and scroll lock (see the next effect and the panel's className),
   * closer to a modal, but this listener still catches Escape and a stray
   * pointer down on the sheet's own chrome the same way.
   */
  useEffect(() => {
    if (!open) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (!panelRef.current?.contains(target) && !triggerRef.current?.contains(target)) {
        setOpen(false);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  /*
   * Below `sm` the panel becomes a bottom sheet over live page content (see
   * the panel's className), so it locks the page behind it the way a sheet
   * does everywhere else on the site. Above `sm` it stays the small corner
   * card the doc comment describes — content is still visible around it, so
   * that breakpoint keeps scrolling live.
   */
  useEffect(() => {
    if (!open || !isMobileSheet) {
      return;
    }

    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open, isMobileSheet]);

  return (
    <>
      {/*
        Below `sm` the panel is a bottom sheet over a page still showing
        product cards behind it — see the panel's className — so it earns a
        backdrop the small corner card above `sm` never needed (that one still
        leaves the page around it visible and dismisses on an outside click
        instead, per the doc comment). Tied to `open` rather than rendered
        unconditionally, and a tap on it closes the same way the panel's own
        close button does.
      */}
      <AnimatePresence>
        {open ? (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={MOTION.fade}
            onClick={() => {
              setOpen(false);
              triggerRef.current?.focus();
            }}
            className="fixed inset-0 z-50 bg-black/60 sm:hidden"
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {open ? (
          <motion.div
            ref={panelRef}
            key="panel"
            id={panelId}
            role="dialog"
            aria-label={support.title}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={MOTION.pop}
            /*
             * Below `sm` this is a bottom sheet: flush to both edges and the
             * screen's own bottom, height-capped and scrollable rather than
             * floating above the trigger, so it takes only the lower part of
             * the screen instead of the corner card's old inset-x-4/bottom-22
             * placement riding high enough to cover most of the hero banner.
             * From `sm` up it is that corner card again — a small popover
             * with the page still visible and interactive around it.
             */
            className="fixed inset-x-0 bottom-0 z-60 max-h-[75vh] overflow-x-hidden overflow-y-auto rounded-t-lg bg-chrome text-left shadow-[0_24px_56px_-12px_rgb(0_0_0/0.7)] ring-1 ring-white/8 sm:inset-x-auto sm:left-auto sm:right-4 sm:bottom-22 sm:w-84 sm:max-h-none sm:overflow-hidden sm:rounded-lg"
          >
            {/* The plate's edge: the one wide stroke of orange in the widget. */}
            <div aria-hidden className="h-0.5 w-full bg-chrome-accent" />

            <div className="flex items-start justify-between gap-3 px-4 py-3.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-chrome-foreground">{support.title}</p>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-chrome-secondary">
                  <span className="relative flex h-1.5 w-1.5 shrink-0">
                    <span
                      className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 motion-reduce:hidden"
                      style={{ background: STATUS_ONLINE }}
                    />
                    <span
                      className="relative inline-flex h-1.5 w-1.5 rounded-full"
                      style={{ background: STATUS_ONLINE }}
                    />
                  </span>
                  {support.status}
                </p>
              </div>
              <button
                type="button"
                aria-label={closeLabel}
                onClick={() => {
                  setOpen(false);
                  triggerRef.current?.focus();
                }}
                // `h-10 w-10` matches the close/trigger buttons in the header
                // search dialog — a 44px touch target would need to either
                // overlap the title above it or push past the card's own
                // padding, and 40px is the size the rest of the site already
                // settled on for an icon-only dismiss control.
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-chrome-secondary outline-none transition-colors hover:bg-chrome-hover hover:text-chrome-foreground focus-visible:ring-2 focus-visible:ring-chrome-accent"
              >
                <Icon icon={X} />
              </button>
            </div>

            <p className="border-t border-chrome-border px-4 py-3.5 text-[0.8125rem] leading-relaxed text-chrome-secondary">
              {support.greeting}
            </p>

            <div className="border-t border-chrome-border">
              <ChannelRow
                href={telegramHref(SUPPORT_CONTACT.telegramUsername)}
                external
                label={support.telegram}
                hint={support.telegramHint}
              >
                <TelegramGlyph className="h-4.5 w-4.5" />
              </ChannelRow>
              <div aria-hidden className="mx-4 border-t border-chrome-border" />
              <ChannelRow
                href={`tel:${SUPPORT_CONTACT.phone.tel}`}
                label={support.call}
                hint={SUPPORT_CONTACT.phone.display}
              >
                <Icon icon={Phone} size="md" className="h-4.5 w-4.5" />
              </ChannelRow>
            </div>

            {/* The stamp on the plate: label left, value right, set the way
                every spec row in the catalogue reads. */}
            <div className="flex items-center justify-between gap-3 border-t border-chrome-border bg-chrome-surface px-4 py-2.5">
              <span className="text-[0.625rem] uppercase tracking-[0.14em] text-chrome-muted">
                {support.responseLabel}
              </span>
              <span className="text-[0.625rem] uppercase tracking-[0.14em] text-chrome-secondary">
                {support.responseValue}
              </span>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={support.open}
        // Hidden rather than left in place once the panel is open: it used
        // to morph into a second X sitting right below the panel's own close
        // button — two controls doing the same thing, close enough on a
        // phone that they read as one smudged shape rather than two. The
        // panel's X, the backdrop and Escape are the close paths now, so the
        // launcher only ever needs to mean "open" — and it steps out of the
        // tab order while it's invisible rather than leaving a focusable gap.
        aria-hidden={open || undefined}
        tabIndex={open ? -1 : undefined}
        className={cn(
          "fixed bottom-4 right-4 z-60 flex h-14 w-14 items-center justify-center rounded-full bg-chrome shadow-[0_8px_24px_-4px_rgb(0_0_0/0.5)] outline-none ring-1 ring-white/10 transition-[transform,opacity] hover:scale-105 focus-visible:ring-2 focus-visible:ring-chrome-accent motion-reduce:hover:scale-100",
          open && "pointer-events-none opacity-0"
        )}
      >
        <span className="flex text-chrome-accent">
          {/* Drawn rather than imported, so the tail sits on the lower left
              and the two speech lines read as a written question. */}
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
            className="h-6 w-6"
          >
            <path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H8.6L4.5 21.2V11.5a7.5 7.5 0 0 1 15 0Z" />
            <path d="M8.75 11.5h7" />
            <path d="M8.75 14.75h4.5" />
          </svg>
        </span>

        {/* The live marker rides the button, so the state is readable before
            anything has been opened. */}
        <span
          aria-hidden
          className="absolute right-0.5 top-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-chrome"
        >
          <span
            className="absolute inline-flex h-2 w-2 animate-ping rounded-full opacity-60 motion-reduce:hidden"
            style={{ background: STATUS_ONLINE }}
          />
          <span
            className="relative inline-flex h-2 w-2 rounded-full"
            style={{ background: STATUS_ONLINE }}
          />
        </span>
      </button>
    </>
  );
}
