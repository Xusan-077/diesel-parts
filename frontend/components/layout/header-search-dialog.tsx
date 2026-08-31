"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "motion/react";
import { Search, X } from "lucide-react";
import { MOTION } from "@/components/providers/motion-provider";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import { HeaderSearch, type HotOfferLabels } from "./header-search";

/**
 * Search on a phone: an icon in the header, and a search bar that takes the
 * header row's own place once tapped.
 *
 * The field used to sit in a row of its own under the logo, which cost the
 * header a third of its height on every page whether anyone was searching or
 * not — and that row could not be collapsed away without resizing the sticky
 * header, which is the bug header-shell.tsx exists to prevent.
 *
 * This used to cover the whole screen in the chrome's near-black — a full
 * backdrop behind a single field and a six-row dropdown, with a wall of empty
 * chrome under it on any query short enough not to fill the panel. The bar
 * itself still only takes the header's own height for that reason. But the
 * dropdown now sits over live product cards rather than empty page, so it
 * gets a backdrop of its own back — rendered by `HeaderSearch` itself (the
 * `overlay` prop below), tied to the dropdown's own open state rather than
 * the dialog's, so it appears and disappears with the rows it is dimming
 * for rather than a beat early or late. Radix still traps focus and blocks
 * scroll on the page behind while the dialog is open — dismissing on
 * Escape, on the close button, or on a tap anywhere outside the bar.
 */
export function HeaderSearchDialog({
  lang,
  header,
  requestPriceLabel,
  hotOfferLabels,
  closeLabel,
  className,
}: {
  lang: Locale;
  header: Dictionary["header"];
  requestPriceLabel: string;
  hotOfferLabels: HotOfferLabels;
  closeLabel: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        aria-label={header.searchLabel}
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-chrome-secondary transition-colors hover:bg-chrome-hover hover:text-chrome-accent",
          className
        )}
      >
        <Icon icon={Search} size="md" />
      </Dialog.Trigger>

      <Dialog.Portal forceMount>
        <AnimatePresence>
          {open ? (
            <Dialog.Content
              asChild
              forceMount
              key="search"
              aria-describedby={undefined}
              // The field carries `autoFocus`; without this Radix would focus
              // the close button first and the visitor would have to tap twice.
              onOpenAutoFocus={(event) => event.preventDefault()}
            >
              <motion.div
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={MOTION.pop}
                className="fixed inset-x-0 top-0 z-100 border-b border-chrome-border bg-chrome"
              >
                <Dialog.Title className="sr-only">{header.searchLabel}</Dialog.Title>

                <div className="flex items-start gap-2 p-3">
                  <HeaderSearch
                    lang={lang}
                    header={header}
                    requestPriceLabel={requestPriceLabel}
                    hotOfferLabels={hotOfferLabels}
                    autoFocus
                    onNavigate={() => setOpen(false)}
                    overlay
                    className="min-w-0 flex-1"
                  />
                  <Dialog.Close
                    aria-label={closeLabel}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-chrome-secondary transition-colors hover:bg-chrome-hover hover:text-chrome-foreground"
                  >
                    <Icon icon={X} size="lg" />
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
