"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { MOTION } from "@/components/providers/motion-provider";
import { Icon } from "@/components/ui/icon";

/**
 * A photograph, full screen. The one place on the site a product's picture is
 * shown at whatever size it actually is rather than cropped into a 4:3 tile —
 * the product card and the gallery both open the same photo in here.
 */
export function ImageLightbox({
  open,
  onOpenChange,
  src,
  alt,
  closeLabel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  src: string;
  alt: string;
  closeLabel: string;
}) {
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
                className="fixed inset-0 z-100 bg-black/85"
              />
            </Dialog.Overlay>
          ) : null}
        </AnimatePresence>

        <AnimatePresence>
          {open ? (
            <Dialog.Content asChild forceMount key="content" aria-describedby={undefined}>
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={MOTION.pop}
                className="fixed inset-0 z-100 flex items-center justify-center p-4 sm:p-10"
                // A click on the padding around the photo closes it, the same
                // as a click on the overlay would — the photo itself, and the
                // close button, are the only things inside this box that stop
                // the click from reaching here.
                onClick={(event) => {
                  if (event.target === event.currentTarget) {
                    onOpenChange(false);
                  }
                }}
              >
                <Dialog.Title className="sr-only">{alt}</Dialog.Title>
                <Dialog.Close
                  aria-label={closeLabel}
                  className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white transition-colors hover:bg-black/60"
                >
                  <Icon icon={X} size="md" />
                </Dialog.Close>
                {/* eslint-disable-next-line @next/next/no-img-element -- full-resolution photo, not a next/image candidate (see product-image.tsx). */}
                <img
                  src={src}
                  alt={alt}
                  className="max-h-full max-w-full cursor-default rounded-lg object-contain"
                />
              </motion.div>
            </Dialog.Content>
          ) : null}
        </AnimatePresence>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
