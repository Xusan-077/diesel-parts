"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { MOTION } from "@/components/providers/motion-provider";
import { CodeForm } from "./code-form";
import { PhoneForm } from "./phone-form";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import { Icon } from "@/components/ui/icon";

type Step = "phone" | "code";

interface AuthDialogProps {
  lang: Locale;
  dict: Dictionary["account"];
  closeLabel: string;
  children: ReactNode;
}

/**
 * Wraps the existing phone and code forms in a modal. Both steps live in the
 * same dialog, so the URL never changes; the forms keep their own request,
 * validation and error handling untouched.
 */
export function AuthDialog({ lang, dict, closeLabel, children }: AuthDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("phone");
  const [maskedPhone, setMaskedPhone] = useState("");

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      // Reset so a reopened dialog always starts at the phone step.
      setStep("phone");
    }
  }

  function handleVerified() {
    setOpen(false);
    setStep("phone");
    router.push(`/${lang}/account`);
    router.refresh();
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger asChild>{children}</Dialog.Trigger>

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
            <Dialog.Content asChild forceMount key="content">
              <motion.div
                // x/y live here rather than in Tailwind: motion writes its own
                // `transform`, which would otherwise drop the centering.
                initial={{ opacity: 0, scale: 0.96, x: "-50%", y: "-50%" }}
                animate={{ opacity: 1, scale: 1, x: "-50%", y: "-50%" }}
                exit={{ opacity: 0, scale: 0.96, x: "-50%", y: "-50%" }}
                transition={MOTION.pop}
                className="fixed left-1/2 top-1/2 z-100 w-[calc(100vw-2rem)] max-w-md rounded-xl border border-border bg-surface p-6 shadow-2xl sm:p-8"
              >
          <Dialog.Close
            aria-label={closeLabel}
            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
          >
            <Icon icon={X} size="md" />
          </Dialog.Close>

          <Dialog.Title className="pr-10 text-xl font-semibold text-foreground">
            {step === "phone" ? dict.dialogTitle : dict.verifyTitle}
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-sm leading-relaxed text-muted">
            {step === "phone"
              ? dict.dialogSubtitle
              : dict.verifySubtitle.replace("{phone}", maskedPhone)}
          </Dialog.Description>

          <div className="mt-6">
            {step === "phone" ? (
              <PhoneForm
                lang={lang}
                dict={dict}
                variant="dialog"
                submitLabel={dict.signIn}
                onSuccess={(masked) => {
                  setMaskedPhone(masked);
                  setStep("code");
                }}
              />
            ) : (
              <CodeForm
                lang={lang}
                dict={dict}
                onSuccess={handleVerified}
                onChangePhone={() => setStep("phone")}
              />
            )}
          </div>

          {step === "phone" ? (
            <p className="mt-6 text-center text-xs leading-relaxed text-muted">
              {dict.consentPrefix}{" "}
              <a href="#" className="text-accent-strong hover:underline">
                {dict.privacyPolicy}
              </a>
              {dict.consentSuffix}
            </p>
                ) : null}
              </motion.div>
            </Dialog.Content>
          ) : null}
        </AnimatePresence>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
