"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import axios from "axios";
import { toast } from "sonner";
import { requestErrorMessage } from "@/lib/api/request-error";
import { staffLoginSchema, type StaffLoginInput } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";

interface LoginResponse {
  success: boolean;
  redirectTo?: string;
  errors?: Record<string, string[] | undefined>;
}

/**
 * The panel's front door.
 *
 * The fields are plain `FormField`s. This screen used to carry its own copy of
 * the rail as a local `FIELD` constant, written before the shared field layer
 * existed; the copy had already fallen behind it — it never went red on a
 * rejected value, and its error line was a bare `<p>` with no `role="alert"`,
 * so a screen reader was told nothing when a login failed. Nothing here is
 * login-specific, so nothing here is styled locally.
 */
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
      const response = await axios.post<LoginResponse>("/api/v1/auth/login", values);
      data = response.data;
    } catch (error) {
      const message = requestErrorMessage(
        error,
        "Kirish amalga oshmadi.",
        "Ulanmadi. Internetni tekshirib, qayta urinib ko'ring.",
      );
      setFormError(message);
      toast.error(message);
      return;
    }

    toast.success("Panelga kirdingiz");
    router.replace(next ?? data.redirectTo ?? "/admin");
    // The panel reads the user on the server, so the cached tree has to go.
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-6" noValidate>
      <FormField
        label="Email"
        error={errors.email ? "To'g'ri email kiriting." : null}
      >
        <Input
          type="email"
          autoComplete="username"
          autoFocus
          placeholder="direktor@dieselparts.uz"
          {...register("email")}
        />
      </FormField>

      <FormField
        label="Parol"
        error={errors.password ? "Parolni kiriting." : null}
      >
        <Input type="password" autoComplete="current-password" {...register("password")} />
      </FormField>

      {/* Reserved region rather than a conditional block, so the button does
          not jump down the screen the moment a sign-in fails. */}
      <div aria-live="polite" className="min-h-5">
        {formError ? (
          <p role="alert" className="type-body font-medium text-danger">
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
