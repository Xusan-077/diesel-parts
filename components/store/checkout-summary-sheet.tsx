"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "motion/react";
import { ChevronUp, X } from "lucide-react";
import { MOTION } from "@/components/providers/motion-provider";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { CheckoutOrderSummary, type CheckoutOrderSummaryProps } from "@/components/store/checkout-order-summary";

export interface CheckoutSummarySheetProps extends CheckoutOrderSummaryProps {
  formId: string;
  submitting: boolean;
  submitLabel: string;
  submittingLabel: string;
}

/**
 * Mobile-only: a sticky bottom bar (total + Place Order, always reachable
 * without scrolling back up through the form) whose "view summary" row opens
 * the same line-count/total block the desktop aside shows, as a bottom
 * sheet. Hidden at `lg` and up, where the sticky aside card already does
 * this job — see CheckoutClient.
 *
 * Same Radix Dialog + motion pattern as components/product/filter-drawer.tsx,
 * kept as its own component rather than a shared extraction: FilterDrawer
 * has no test today, and this plan does not touch it.
 */
export function CheckoutSummarySheet({
  formId,
  submitting,
  submitLabel,
  submittingLabel,
  cartDict,
  checkoutDict,
  total,
  totalLabel,
  ...summaryProps
}: CheckoutSummarySheetProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="lg:hidden">
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface-elevated p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mb-3 flex w-full items-center justify-between text-sm text-foreground"
        >
          <span className="flex items-center gap-1 text-muted">
            <Icon icon={ChevronUp} size="sm" />
            {checkoutDict.mobileSummaryLabel}
          </span>
          <span className="font-medium tabular-nums">
            {total > 0 ? totalLabel : cartDict.priceOnRequest}
          </span>
        </button>
        <Button type="submit" form={formId} size="lg" className="w-full" disabled={submitting}>
          {submitting ? submittingLabel : submitLabel}
        </Button>
      </div>

      {/* Spacer so the fixed bar never covers the form's last field. */}
      <div aria-hidden className="h-32" />

      <Dialog.Root open={open} onOpenChange={setOpen}>
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
              <Dialog.Content asChild forceMount key="sheet" aria-describedby={undefined}>
                <motion.div
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  exit={{ y: "100%" }}
                  transition={MOTION.drawer}
                  className="fixed inset-x-0 bottom-0 z-100 flex max-h-[85dvh] flex-col rounded-t-lg border-t border-border bg-surface-elevated text-foreground shadow-xl"
                >
                  <div className="flex shrink-0 justify-center pt-2" aria-hidden>
                    <span className="h-1 w-9 rounded-full bg-border-strong" />
                  </div>
                  <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
                    <Dialog.Title className="text-lg font-semibold">
                      {checkoutDict.mobileSummaryLabel}
                    </Dialog.Title>
                    <Dialog.Close
                      aria-label={checkoutDict.mobileSummaryClose}
                      className="flex h-10 w-10 items-center justify-center rounded-md transition-colors hover:bg-surface-hover"
                    >
                      <Icon icon={X} size="lg" />
                    </Dialog.Close>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
                    <CheckoutOrderSummary
                      cartDict={cartDict}
                      checkoutDict={checkoutDict}
                      total={total}
                      totalLabel={totalLabel}
                      {...summaryProps}
                    />
                  </div>
                </motion.div>
              </Dialog.Content>
            ) : null}
          </AnimatePresence>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
