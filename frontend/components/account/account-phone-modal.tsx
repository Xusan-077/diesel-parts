"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CodeForm } from "./code-form";
import { PhoneForm } from "./phone-form";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { FormModalShell } from "@/components/ui/form-modal-shell";

type Step = "phone" | "code";

/**
 * Changing the number is re-authenticating with it.
 *
 * `/api/auth/request-code` writes the pending number to an httpOnly cookie and
 * `/api/auth/verify-code` mints the session from that same cookie — so running
 * the existing two-step form against the new number *is* the change, with no
 * endpoint of its own and no way for a caller to claim a number they cannot
 * receive an SMS on.
 */
export function AccountPhoneModal({
  dict,
  open,
  onOpenChange,
}: {
  dict: Dictionary["account"];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const panel = dict.profilePanel;
  const router = useRouter();
  const [step, setStep] = useState<Step>("phone");
  const [maskedPhone, setMaskedPhone] = useState("");

  function handleOpenChange(nextOpen: boolean) {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setStep("phone");
    }
  }

  return (
    <FormModalShell
      open={open}
      onOpenChange={handleOpenChange}
      title={step === "phone" ? panel.phoneModalTitle : dict.verifyTitle}
      description={
        step === "phone"
          ? panel.phoneModalSubtitle
          : dict.verifySubtitle.replace("{phone}", maskedPhone)
      }
      closeLabel={panel.close}
    >
      {step === "phone" ? (
        <PhoneForm
          dict={dict}
          variant="dialog"
          submitLabel={dict.continue}
          onSuccess={(masked) => {
            setMaskedPhone(masked);
            setStep("code");
          }}
        />
      ) : (
        <CodeForm
          dict={dict}
          onSuccess={() => {
            handleOpenChange(false);
            // The page reads the number off the session cookie on the server.
            router.refresh();
          }}
          onChangePhone={() => setStep("phone")}
        />
      )}
    </FormModalShell>
  );
}
