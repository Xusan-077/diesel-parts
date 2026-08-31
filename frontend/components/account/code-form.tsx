"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import axios from "axios";
import { toast } from "sonner";
import { authErrorMessage, type AuthErrorPayload } from "@/lib/auth/error-message";
import { notifyDevCode } from "@/lib/auth/dev-code-notice";
import { refusalPayload } from "@/lib/api/request-error";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const CODE_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 60;

interface CodeFormProps {
  dict: Dictionary["account"];
  /** When given, replaces the navigation to the account page. */
  onSuccess?: () => void;
  /** When given, replaces the "change number" link with a button. */
  onChangePhone?: () => void;
}

export function CodeForm({ dict, onSuccess, onChangePhone }: CodeFormProps) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_COOLDOWN_SECONDS);

  useEffect(() => {
    if (secondsLeft <= 0) {
      return;
    }
    const timer = setInterval(() => {
      setSecondsLeft((current) => Math.max(0, current - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [secondsLeft]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (code.length !== CODE_LENGTH) {
      setError(dict.errorCodeFormat);
      return;
    }

    setSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      await axios.post("/api/auth/verify-code", { code });
      toast.success(dict.toastSignedIn);

      if (onSuccess) {
        onSuccess();
        return;
      }
      router.push("/account");
      // The account page reads the session cookie on the server.
      router.refresh();
    } catch (error) {
      const payload = refusalPayload<AuthErrorPayload>(error);
      const message = payload ? authErrorMessage(dict, payload) : dict.errorGeneric;
      setError(message);
      toast.error(message);
      setSubmitting(false);
    }
  }

  async function handleResend() {
    setError(null);
    setNotice(null);

    try {
      // No body: the server re-reads the phone from its httpOnly cookie.
      const { data } = await axios.post<{ resendAfterSeconds?: number; devCode?: string }>(
        "/api/auth/resend-code",
      );
      notifyDevCode(data.devCode);

      setNotice(dict.resent);
      setSecondsLeft(data.resendAfterSeconds ?? RESEND_COOLDOWN_SECONDS);
    } catch (error) {
      const payload = refusalPayload<AuthErrorPayload>(error);

      if (!payload) {
        setError(dict.errorGeneric);
        return;
      }

      setError(authErrorMessage(dict, payload));
      if (typeof payload.retryAfterSeconds === "number") {
        setSecondsLeft(payload.retryAfterSeconds);
      }
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <div>
        <Label htmlFor="account-code">{dict.codeLabel}</Label>
        <Input
          id="account-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          maxLength={CODE_LENGTH}
          placeholder="------"
          className="mt-2 text-center text-lg tracking-[0.5em]"
          value={code}
          onChange={(event) =>
            setCode(event.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH))
          }
          aria-invalid={error !== null}
        />
      </div>

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      {notice ? (
        <p role="status" className="text-sm text-muted">
          {notice}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? dict.verifying : dict.confirm}
      </Button>

      <div className="flex items-center justify-between gap-4 text-sm">
        <button
          type="button"
          onClick={handleResend}
          disabled={secondsLeft > 0}
          className="text-accent-strong transition-opacity hover:underline disabled:cursor-not-allowed disabled:text-muted disabled:no-underline"
        >
          {secondsLeft > 0
            ? dict.resendIn.replace("{seconds}", String(secondsLeft))
            : dict.resend}
        </button>

        {onChangePhone ? (
          <button
            type="button"
            onClick={onChangePhone}
            className="text-muted transition-colors hover:text-foreground"
          >
            {dict.changePhone}
          </button>
        ) : (
          <Link
            href="/account/login"
            className="text-muted transition-colors hover:text-foreground"
          >
            {dict.changePhone}
          </Link>
        )}
      </div>
    </form>
  );
}
