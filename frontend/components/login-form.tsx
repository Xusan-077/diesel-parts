"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import { formatPhone, isValidPhone, toCanonicalPhone } from "@/lib/auth/phone";
import { login as sellerLogin } from "@/lib/api/seller-panel/auth";
import { SellerApiError } from "@/lib/api/seller-panel/client";
import { useSellerAuthStore } from "@/lib/store/seller-auth-store";
import { Button } from "@/components/ui/shadcn/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
} from "@/components/ui/shadcn/card";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/shadcn/field";
import { Input } from "@/components/ui/shadcn/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/shadcn/input-group";

/**
 * The one sign-in screen for both staff panels.
 *
 * Built entirely from shadcn primitives — `Card`, `Field`, `Input`,
 * `InputGroup`, `Button`. No hand-rolled control skins: the password reveal is
 * an `InputGroupButton` in an `InputGroupAddon`, not a positioned `<button>`.
 * Spacing and typography are the primitives' own defaults; colour comes from
 * the `.auth-scene` token scope in app/globals.css (mirrored in
 * app/seller-globals.css), which maps the standard shadcn variable names
 * (`--card`, `--primary`, `--border`, `--input`, ...) to the sign-in palette.
 *
 * Director and seller render the same card — only the copy changes, plus the
 * one thing behind it: a director signs in with an email, a seller with a
 * phone number, because the two panels' backends identify them that way.
 *
 * The two roles also submit to two different back ends, mirroring how the two
 * panels already authenticate elsewhere:
 *   - director → this app's own `/api/v1/auth/login` route, which talks to
 *     backend/ and sets the httpOnly staff-session cookie; the server decides
 *     where the role lands (`redirectTo`).
 *   - seller → backend/ directly via `lib/api/seller-panel`, whose access
 *     token lives only in the in-memory `useSellerAuthStore` (the refresh
 *     token is an httpOnly cookie backend/ sets itself).
 */

type Role = "director" | "seller";

interface RoleCopy {
  eyebrow: string;
  title: string;
  subtitle: string;
  identifierLabel: string;
  identifierType: "email" | "tel";
  identifierAutoComplete: string;
  identifierPlaceholder: string;
  identifierRequiredMessage: string;
  identifierInvalidMessage: string;
  forgotText: string;
  /** Where a successful sign-in lands when no `next` was supplied. */
  home: string;
}

const COPY: Record<Role, RoleCopy> = {
  director: {
    eyebrow: "Diesel Parts",
    title: "Direktor paneli",
    subtitle: "Hisobingizga kiring",
    identifierLabel: "Email",
    identifierType: "email",
    identifierAutoComplete: "username",
    identifierPlaceholder: "direktor@dieselparts.uz",
    identifierRequiredMessage: "Email manzilini kiriting",
    identifierInvalidMessage: "To'g'ri email kiriting",
    forgotText: "Parolni unutdingizmi? Tizim administratoriga murojaat qiling.",
    home: "/director",
  },
  seller: {
    eyebrow: "Diesel Parts",
    title: "Sotuvchi paneli",
    subtitle: "Hisobingizga kiring",
    identifierLabel: "Telefon raqami",
    identifierType: "tel",
    identifierAutoComplete: "tel",
    identifierPlaceholder: "+998 90 123-45-67",
    identifierRequiredMessage: "Telefon raqamini kiriting",
    identifierInvalidMessage: "To'g'ri telefon raqamini kiriting",
    forgotText: "Parolni unutdingizmi? Direktoringizga murojaat qiling.",
    home: "/seller",
  },
};

interface LoginValues {
  identifier: string;
  password: string;
}

function buildSchema(role: Role): yup.ObjectSchema<LoginValues> {
  const copy = COPY[role];

  const identifier =
    role === "director"
      ? yup
          .string()
          .trim()
          .required(copy.identifierRequiredMessage)
          .email(copy.identifierInvalidMessage)
      : yup
          .string()
          .trim()
          .required(copy.identifierRequiredMessage)
          .test("phone", copy.identifierInvalidMessage, (value) => isValidPhone(value ?? ""));

  return yup.object({
    identifier,
    password: yup
      .string()
      .required("Parolni kiriting")
      .min(6, "Parol kamida 6 belgidan iborat bo'lishi kerak"),
  });
}

const GENERIC_ERROR = "Kirishda xatolik yuz berdi. Qayta urinib ko'ring.";
const OFFLINE_ERROR = "Ulanmadi. Internetni tekshirib, qayta urinib ko'ring.";

interface StaffLoginResult {
  success: boolean;
  redirectTo?: string;
  errors?: { _root?: string[] };
}

export function LoginForm({ role, next }: { role: Role; next: string | null }) {
  const copy = COPY[role];
  const router = useRouter();
  const setSellerSession = useSellerAuthStore((state) => state.setSession);
  const schema = useMemo(() => buildSchema(role), [role]);
  const [revealed, setRevealed] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: yupResolver(schema),
    defaultValues: {
      identifier: role === "seller" ? formatPhone("") : "",
      password: "",
    },
  });

  async function signInAsDirector(values: LoginValues) {
    let result: StaffLoginResult;
    try {
      const response = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: values.identifier.trim(),
          password: values.password,
        }),
      });
      result = (await response.json()) as StaffLoginResult;
    } catch {
      setNotice(OFFLINE_ERROR);
      return;
    }

    if (!result.success) {
      setNotice(result.errors?._root?.[0] ?? GENERIC_ERROR);
      return;
    }

    // The staff area reads the user on the server, so the cached tree has to
    // go — same two-step the old panel login did.
    router.replace(next ?? result.redirectTo ?? copy.home);
    router.refresh();
  }

  async function signInAsSeller(values: LoginValues) {
    // `isValidPhone` already passed in the resolver, so this is never null.
    const canonical = toCanonicalPhone(values.identifier);
    if (!canonical) {
      setNotice(copy.identifierInvalidMessage);
      return;
    }

    try {
      const session = await sellerLogin(`+${canonical}`, values.password);
      setSellerSession(session.accessToken, session.user);
    } catch (error) {
      if (error instanceof SellerApiError) {
        setNotice(error.message || GENERIC_ERROR);
        return;
      }
      setNotice(OFFLINE_ERROR);
      return;
    }

    router.replace(next ?? copy.home);
  }

  async function onSubmit(values: LoginValues) {
    setNotice(null);
    if (role === "director") {
      await signInAsDirector(values);
    } else {
      await signInAsSeller(values);
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center">
        <p className="type-eyebrow text-primary">{copy.eyebrow}</p>
        <h1 className="mt-1 text-2xl font-semibold text-card-foreground">{copy.title}</h1>
        <CardDescription className="mt-1">{copy.subtitle}</CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            <Field data-invalid={Boolean(errors.identifier) || undefined}>
              <FieldLabel htmlFor="identifier">{copy.identifierLabel}</FieldLabel>
              <Input
                id="identifier"
                type={copy.identifierType}
                inputMode={copy.identifierType === "tel" ? "tel" : "email"}
                autoComplete={copy.identifierAutoComplete}
                placeholder={copy.identifierPlaceholder}
                autoFocus
                aria-invalid={Boolean(errors.identifier) || undefined}
                {...register(
                  "identifier",
                  role === "seller"
                    ? {
                        // Reformats "+998 90 123-45-67" as the seller types,
                        // the same masking the old seller login used.
                        onChange: (event) => {
                          event.target.value = formatPhone(event.target.value);
                        },
                      }
                    : undefined,
                )}
              />
              <FieldError errors={errors.identifier ? [errors.identifier] : undefined} />
            </Field>

            <Field data-invalid={Boolean(errors.password) || undefined}>
              <FieldLabel htmlFor="password">Parol</FieldLabel>
              <InputGroup>
                <InputGroupInput
                  id="password"
                  type={revealed ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  aria-invalid={Boolean(errors.password) || undefined}
                  {...register("password")}
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    type="button"
                    size="icon-xs"
                    aria-label={revealed ? "Parolni yashirish" : "Parolni ko'rsatish"}
                    aria-pressed={revealed}
                    onClick={() => setRevealed((shown) => !shown)}
                  >
                    {revealed ? (
                      <EyeOff className="size-3.5" />
                    ) : (
                      <Eye className="size-3.5" />
                    )}
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
              <FieldError errors={errors.password ? [errors.password] : undefined} />
            </Field>

            {notice ? <FieldError errors={[{ message: notice }]} /> : null}

            <Field>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <LoaderCircle className="animate-spin" />
                    Kirilmoqda…
                  </>
                ) : (
                  "Kirish"
                )}
              </Button>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>

      <CardFooter>
        <p className="w-full text-center text-xs text-muted-foreground">{copy.forgotText}</p>
      </CardFooter>
    </Card>
  );
}
