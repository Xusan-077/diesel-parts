"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authErrorMessage } from "@/lib/auth/error-message";
import {
  formatNationalDigits,
  formatPhone,
  isValidPhone,
  maskPhone,
  toCanonicalPhone,
} from "@/lib/auth/phone";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FlagIcon } from "@/components/layout/flag-icon";

interface PhoneFormProps {
  lang: Locale;
  dict: Dictionary["account"];
  /**
   * `page` renders one field holding the full "+998 ..." value.
   * `dialog` splits the country code into a static addon beside the field.
   */
  variant?: "page" | "dialog";
  submitLabel?: string;
  /**
   * When given, replaces the navigation to the verify page. Receives the
   * masked number so the caller can show which phone the code went to.
   */
  onSuccess?: (maskedPhone: string) => void;
}

export function PhoneForm({
  lang,
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
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/request-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setError(authErrorMessage(dict, payload));
        setSubmitting(false);
        return;
      }

      if (onSuccess) {
        const canonical = toCanonicalPhone(phone);
        onSuccess(canonical ? maskPhone(canonical) : "");
        return;
      }
      router.push(`/${lang}/account/verify`);
    } catch {
      setError(dict.errorGeneric);
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
