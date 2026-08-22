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
import { HeaderSearch } from "./header-search";

/**
 * Search on a phone: an icon in the header, and the whole screen once tapped.
 *
 * The field used to sit in a row of its own under the logo, which cost the
 * header a third of its height on every page whether anyone was searching or
 * not — and that row could not be collapsed away without resizing the sticky
 * header, which is the bug header-shell.tsx exists to prevent.
 *
 * A full screen rather than a dropdown, because the panel *is* the answer here:
 * six rows and a "see all" fill a phone, and putting them over the page behind
 * a 40px-tall field would leave both half-legible.
 */
export function HeaderSearchDialog({
  lang,
  header,
  requestPriceLabel,
  closeLabel,
  className,
}: {
  lang: Locale;
  header: Dictionary["header"];
  requestPriceLabel: string;
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
                className="fixed inset-0 z-100 flex flex-col bg-chrome"
              >
                <Dialog.Title className="sr-only">{header.searchLabel}</Dialog.Title>

                <div className="flex items-start gap-2 border-b border-chrome-border p-3">
                  <HeaderSearch
                    lang={lang}
                    header={header}
                    requestPriceLabel={requestPriceLabel}
                    autoFocus
                    onNavigate={() => setOpen(false)}
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
