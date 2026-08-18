"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { staffLoginSchema, type StaffLoginInput } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface LoginResponse {
  success: boolean;
  redirectTo?: string;
  errors?: Record<string, string[] | undefined>;
}

/**
 * Each field sits behind a rule that turns brand orange while the field has
 * focus — the one piece of colour on the screen, marking where you are. It uses
 * `--accent-strong` rather than the fill orange: at 2.56:1 the fill would sit
 * under the 3:1 floor a state indicator has to clear. The compliant focus ring
 * from globals.css is still what marks focus; this only reinforces it.
 */
const FIELD = "border-l-2 border-border pl-4 transition-colors focus-within:border-accent-strong";

export function LoginForm({ next }: { next: string | null }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<StaffLoginInput>({ resolver: zodResolver(staffLoginSchema) });

  async function onSubmit(values: StaffLoginInput) {
    setFormError(null);

    let data: LoginResponse;
    try {
      const response = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      data = (await response.json()) as LoginResponse;
    } catch {
      setFormError("Ulanmadi. Internetni tekshirib, qayta urinib ko'ring.");
      return;
    }

    if (!data.success) {
      setFormError(data.errors?._root?.[0] ?? "Kirish amalga oshmadi.");
      return;
    }

    router.replace(next ?? data.redirectTo ?? "/admin");
    // The panel reads the user on the server, so the cached tree has to go.
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mt-10 space-y-6" noValidate>
      <div className={FIELD}>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="username"
          autoFocus
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={errors.email ? "email-error" : undefined}
          className="mt-1.5 border-0 px-0 focus:border-0"
          placeholder="direktor@dieselparts.uz"
          {...register("email")}
        />
        {errors.email ? (
          <p id="email-error" className="mt-1.5 text-xs text-danger">
            To&apos;g&apos;ri email kiriting.
          </p>
        ) : null}
      </div>

      <div className={FIELD}>
        <Label htmlFor="password">Parol</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={errors.password ? true : undefined}
          aria-describedby={errors.password ? "password-error" : undefined}
          className="mt-1.5 border-0 px-0 focus:border-0"
          {...register("password")}
        />
        {errors.password ? (
          <p id="password-error" className="mt-1.5 text-xs text-danger">
            Parolni kiriting.
          </p>
        ) : null}
      </div>

      {/* Reserved region rather than a conditional block, so the button does
          not jump down the screen the moment a sign-in fails. */}
      <div aria-live="polite" className="min-h-5">
        {formError ? (
          <p role="alert" className="text-sm text-danger">
            {formError}
          </p>
        ) : null}
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Kirilmoqda…" : "Kirish"}
      </Button>
    </form>
  );
}
