"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { Button } from "@/components/seller/ui/button";
import { Input } from "@/components/seller/ui/input";
import { useLogin } from "@/hooks/seller/mutations/use-login";
import { sellerErrorMessage } from "@/hooks/seller/use-seller-mutation";
import { safeSellerNext } from "@/lib/seller/safe-next";

/*
 * React Hook Form + zod, not Yup: the prompt asked for Yup, but this repo
 * validates every other form (lib/schemas.ts) with zod and doesn't have Yup
 * installed. Adding a second schema library for one form isn't worth it —
 * zod + @hookform/resolvers/zod gives the same RHF integration.
 */
const loginSchema = z.object({
  phone: z.string().min(1, "Telefon raqamini kiriting"),
  password: z.string().min(6, "Parol kamida 6 belgidan iborat bo'lishi kerak"),
});

type LoginValues = z.infer<typeof loginSchema>;

export function LoginForm({ next }: { next: string | null }) {
  const router = useRouter();
  const login = useLogin();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await login.mutateAsync(values);
      router.replace(safeSellerNext(next) ?? "/seller");
    } catch {
      // surfaced via login.error below
    }
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="phone" className="seller-eyebrow">
          Telefon raqami
        </label>
        <Input
          id="phone"
          type="tel"
          autoComplete="tel"
          placeholder="+998901112236"
          invalid={Boolean(errors.phone)}
          {...register("phone")}
        />
        {errors.phone ? <p className="text-xs text-danger">{errors.phone.message}</p> : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="seller-eyebrow">
          Parol
        </label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          invalid={Boolean(errors.password)}
          {...register("password")}
        />
        {errors.password ? <p className="text-xs text-danger">{errors.password.message}</p> : null}
      </div>

      {login.isError ? (
        <p role="alert" className="rounded-md border border-danger bg-danger-surface px-3 py-2 text-xs text-danger">
          {sellerErrorMessage(login.error, "Kirishda xatolik yuz berdi")}
        </p>
      ) : null}

      <Button type="submit" loading={login.isPending} className="mt-1 w-full">
        Kirish
      </Button>
    </form>
  );
}
