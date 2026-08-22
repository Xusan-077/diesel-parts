"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Phone, X } from "lucide-react";
import { MOTION } from "@/components/providers/motion-provider";
import { Icon } from "@/components/ui/icon";
import { SUPPORT_CONTACT, telegramHref } from "@/lib/site-config";
import type { Dictionary } from "@/lib/i18n/dictionaries";

/*
 * The widget paints itself dark in both themes rather than reading the page
 * tokens. It is not page content — it floats over whatever is underneath, the
 * way a support chip does everywhere else on the web — and holding it dark is
 * what keeps the brand orange at full strength on the light catalogue paper.
 *
 * The values are the dark ramp from globals.css dropped one step, so the plate
 * reads as sitting above a dark page rather than dissolving into it. They are
 * deliberately warm (the site's hue 57) and not the blue-black a floating card
 * usually defaults to: a cool near-black over this warm neutral ramp reads as a
 * component borrowed from another site.
 */
const PLATE = {
  base: "#0f0d0b",
  raised: "#17140f",
  online: "#7cd591",
} as const;

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
      className="group relative flex items-center gap-3 px-4 py-3.5 outline-none transition-colors hover:bg-[#17140f] focus-visible:bg-[#17140f]"
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-0.5 origin-top scale-y-0 bg-[#f5841f] transition-transform duration-150 group-hover:scale-y-100 group-focus-visible:scale-y-100"
      />
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#221c17] text-[#f5841f]">
        {children}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[0.8125rem] font-medium text-[#f2efed]">{label}</span>
        <span className="mt-0.5 block truncate text-xs text-[#aaa099]">{hint}</span>
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

  /*
   * Escape closes and returns focus to the button; a pointer landing anywhere
   * outside closes too. The panel is dismissable furniture rather than a modal,
   * so it never traps focus or locks the page behind it.
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

  return (
    <>
      <AnimatePresence>
        {open ? (
          <motion.div
            ref={panelRef}
            key="panel"
            id={panelId}
            role="dialog"
            aria-label={support.title}
            initial={{ opacity: 0, scale: 0.94, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 8 }}
            transition={MOTION.pop}
            style={{ transformOrigin: "bottom right", background: PLATE.base }}
            /*
             * Pinned to both gutters below `sm`, so a narrow phone gets a panel
             * the width of its screen minus 2rem and never one that runs off
             * the right edge; from `sm` up it settles to a fixed column.
             */
            className="fixed inset-x-4 bottom-22 z-60 overflow-hidden rounded-lg text-left shadow-[0_24px_56px_-12px_rgb(0_0_0/0.7)] ring-1 ring-white/8 sm:left-auto sm:w-84"
          >
            {/* The plate's edge: the one wide stroke of orange in the widget. */}
            <div aria-hidden className="h-0.5 w-full bg-[#f5841f]" />

            <div className="flex items-start justify-between gap-3 px-4 py-3.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[#f2efed]">{support.title}</p>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-[#aaa099]">
                  <span className="relative flex h-1.5 w-1.5 shrink-0">
                    <span
                      className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 motion-reduce:hidden"
                      style={{ background: PLATE.online }}
                    />
                    <span
                      className="relative inline-flex h-1.5 w-1.5 rounded-full"
                      style={{ background: PLATE.online }}
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
                className="-mr-1.5 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[#aaa099] outline-none transition-colors hover:bg-[#221c17] hover:text-[#f2efed] focus-visible:ring-2 focus-visible:ring-[#f5841f]"
              >
                <Icon icon={X} />
              </button>
            </div>

            <p className="border-t border-[#2b2521] px-4 py-3.5 text-[0.8125rem] leading-relaxed text-[#aaa099]">
              {support.greeting}
            </p>

            <div className="border-t border-[#2b2521]">
              <ChannelRow
                href={telegramHref(SUPPORT_CONTACT.telegramUsername)}
                external
                label={support.telegram}
                hint={support.telegramHint}
              >
                <TelegramGlyph className="h-4.5 w-4.5" />
              </ChannelRow>
              <div aria-hidden className="mx-4 border-t border-[#2b2521]" />
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
            <div
              style={{ background: PLATE.raised }}
              className="flex items-center justify-between gap-3 border-t border-[#2b2521] px-4 py-2.5"
            >
              <span className="text-[0.625rem] uppercase tracking-[0.14em] text-[#7b736d]">
                {support.responseLabel}
              </span>
              <span className="text-[0.625rem] uppercase tracking-[0.14em] text-[#aaa099]">
                {support.responseValue}
              </span>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        /*
         * The trigger is a disclosure, so once the panel is open its name is
         * the panel's — "DieselParts Support, expanded". Labelling it "close"
         * would give it the same accessible name as the panel's own X and
         * leave a screen-reader user with two identical buttons.
         */
        aria-label={open ? support.title : support.open}
        style={{ background: PLATE.base }}
        className="fixed bottom-4 right-4 z-60 flex h-14 w-14 items-center justify-center rounded-full shadow-[0_8px_24px_-4px_rgb(0_0_0/0.5)] outline-none ring-1 ring-white/10 transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-[#f5841f] motion-reduce:hover:scale-100"
      >
        <AnimatePresence mode="wait" initial={false}>
          {open ? (
            <motion.span
              key="close"
              initial={{ opacity: 0, rotate: -45 }}
              animate={{ opacity: 1, rotate: 0 }}
              exit={{ opacity: 0, rotate: 45 }}
              transition={MOTION.fade}
              className="flex text-[#f2efed]"
            >
              <Icon icon={X} size="lg" />
            </motion.span>
          ) : (
            <motion.span
              key="chat"
              initial={{ opacity: 0, rotate: 45 }}
              animate={{ opacity: 1, rotate: 0 }}
              exit={{ opacity: 0, rotate: -45 }}
              transition={MOTION.fade}
              className="flex text-[#f5841f]"
            >
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
            </motion.span>
          )}
        </AnimatePresence>

        {/* The live marker rides the button, so the state is readable before
            anything has been opened. */}
        <span
          aria-hidden
          className="absolute right-0.5 top-0.5 flex h-3 w-3 items-center justify-center rounded-full"
          style={{ background: PLATE.base }}
        >
          <span
            className="absolute inline-flex h-2 w-2 animate-ping rounded-full opacity-60 motion-reduce:hidden"
            style={{ background: PLATE.online }}
          />
          <span
            className="relative inline-flex h-2 w-2 rounded-full"
            style={{ background: PLATE.online }}
          />
        </span>
      </button>
    </>
  );
}
