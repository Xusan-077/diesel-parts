"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { toast } from "sonner";
import { authErrorMessage, type AuthErrorPayload } from "@/lib/auth/error-message";
import { refusalPayload } from "@/lib/api/request-error";
import {
  formatNationalDigits,
  formatPhone,
  isValidPhone,
  maskPhone,
  toCanonicalPhone,
} from "@/lib/auth/phone";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FlagIcon } from "@/components/layout/flag-icon";

interface PhoneFormProps {
  dict: Dictionary["account"];
  variant?: "page" | "dialog";
  submitLabel?: string;
  onSuccess?: (maskedPhone: string) => void;
}

export function PhoneForm({
  dict,
  variant = "page",
  submitLabel,
  onSuccess,
}: PhoneFormProps) {
  const router = useRouter();
  const isDialog = variant === "dialog";
  const [phone, setPhone] = useState(isDialog ? "" : formatPhone(""));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const format = isDialog ? formatNationalDigits : formatPhone;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isValidPhone(phone)) {
      setError(dict.errorInvalidPhone);
      toast.error(dict.errorInvalidPhone);
      return;
    }

    setSubmitting(true);
    setError(null);

    const canonicalPhone = toCanonicalPhone(phone) ?? phone;

    try {
      await axios.post("/api/auth/request-code", { phone: canonicalPhone });

      if (onSuccess) {
        onSuccess(maskPhone(canonicalPhone));
        return;
      }
      router.push("/account/verify");
    } catch (error) {
      const payload = refusalPayload<AuthErrorPayload>(error);
      const message = payload ? authErrorMessage(dict, payload) : dict.errorGeneric;
      setError(message);
      toast.error(message);
      setSubmitting(false);
    }
  }

  const input = (
    <Input
      id="account-phone"
      type="tel"
      inputMode="tel"
      autoComplete="tel"
      autoFocus
      className={isDialog ? "rounded-l-none border-l-0 tracking-wide" : "mt-2 tracking-wide"}
      placeholder={isDialog ? dict.phonePlaceholder : undefined}
      value={phone}
      onChange={(event) => setPhone(format(event.target.value))}
      aria-invalid={error !== null}
    />
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <div>
        <Label htmlFor="account-phone">{dict.phoneLabel}</Label>
        {isDialog ? (
          <div className="mt-2 flex">
            <span className="flex h-10 shrink-0 items-center gap-2 rounded-l-md border border-border bg-surface-muted px-3 text-sm text-foreground">
              <FlagIcon locale="uz" className="h-3 w-4.5 rounded-xs" />
              +998
            </span>
            {input}
          </div>
        ) : (
          input
        )}
      </div>

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? dict.sending : (submitLabel ?? dict.continue)}
      </Button>
    </form>
  );
}