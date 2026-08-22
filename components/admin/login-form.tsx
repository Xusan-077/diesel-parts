"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { panelClient } from "@/lib/api/admin/client";
import { toast } from "sonner";
import { requestErrorMessage } from "@/lib/api/request-error";
import { staffLoginSchema, type StaffLoginInput } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { controlVariants } from "@/components/ui/field-styles";
import { cn } from "@/lib/utils";

interface LoginResponse {
  success: boolean;
  redirectTo?: string;
  errors?: Record<string, string[] | undefined>;
}

/**
 * The panel's front door.
 *
 * The fields are not `FormField`s, and this is the one screen where that is
 * the right call: a door field is 56px tall, carries its own glyph and, in the
 * password's case, a control of its own on the right — none of which the
 * form layer's label-above-a-40px-box layout has a slot for. The control skin
 * is still that layer's `controlVariants`, so the type, the placeholder colour
 * and the disabled state stay the panel's; the box around it is `.door-field`,
 * because the door's focus state is a line drawn along the foot of the box and
 * layering that over `fieldBox`'s ring left two rules fighting for one
 * property. See the FRONT DOOR block in app/globals.css.
 */
export function LoginForm({ next }: { next: string | null }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const form = useRef<HTMLFormElement>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<StaffLoginInput>({ resolver: zodResolver(staffLoginSchema) });

  /**
   * Shakes the form once, for a refusal.
   *
   * The attribute is written to the DOM rather than held in React state, and
   * it is removed before it is set. A CSS animation only restarts when the
   * element enters the animated state afresh, so a second refusal with the
   * attribute already present would light up the error text and move nothing —
   * which is the case that most needs the shake. Reading `offsetWidth` between
   * the two writes is what forces the style to be recomputed in between.
   */
  function refuse() {
    const element = form.current;
    if (!element) {
      return;
    }
    element.removeAttribute("data-shake");
    void element.offsetWidth;
    element.setAttribute("data-shake", "true");
  }

  async function onSubmit(values: StaffLoginInput) {
    setFormError(null);

    let data: LoginResponse;
    try {
      const response = await panelClient.post<LoginResponse>("/auth/login", values);
      data = response.data;
    } catch (error) {
      const message = requestErrorMessage(
        error,
        "Kirish amalga oshmadi.",
        "Ulanmadi. Internetni tekshirib, qayta urinib ko'ring.",
      );
      setFormError(message);
      toast.error(message);
      refuse();
      return;
    }

    toast.success("Panelga kirdingiz");
    router.replace(next ?? data.redirectTo ?? "/admin");
    // The panel reads the user on the server, so the cached tree has to go.
    router.refresh();
  }

  return (
    <form
      ref={form}
      /* Built inside the handler rather than during render: both callbacks
         read the form ref, and the compiler refuses a ref reaching a
         function that render itself calls. */
      onSubmit={(event) => void handleSubmit(onSubmit, refuse)(event)}
      /* Cleared once the shake has run, so the next refusal can set it again.
         The name is checked because `animationend` bubbles: the boot sequence
         above runs on this element and on every field inside it. */
      onAnimationEnd={(event) => {
        if (event.animationName === "door-shake") {
          form.current?.removeAttribute("data-shake");
        }
      }}
      className="door-form door-boot mt-8 space-y-6"
      style={{ "--door-boot-offset": "320ms" } as React.CSSProperties}
      noValidate
    >
      <DoorField label="Email" glyph={Mail} error={errors.email ? "To'g'ri email kiriting." : null}>
        {(id, invalid) => (
          <input
            id={id}
            type="email"
            autoComplete="username"
            autoFocus
            placeholder="direktor@dieselparts.uz"
            aria-invalid={invalid}
            className={cn(controlVariants({ variant: "rail", ring: "field" }), "text-[0.9375rem]")}
            {...register("email")}
          />
        )}
      </DoorField>

      <DoorField label="Parol" glyph={Lock} error={errors.password ? "Parolni kiriting." : null}>
        {(id, invalid) => (
          <>
            <input
              id={id}
              type={revealed ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••••"
              aria-invalid={invalid}
              className={cn(controlVariants({ variant: "rail", ring: "field" }), "text-[0.9375rem]")}
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setRevealed((shown) => !shown)}
              aria-label={revealed ? "Parolni yashirish" : "Parolni ko'rsatish"}
              aria-pressed={revealed}
              className="shrink-0 rounded-full p-1 text-muted transition-colors hover:text-foreground"
            >
              <Icon icon={revealed ? EyeOff : Eye} size="md" />
            </button>
          </>
        )}
      </DoorField>

      {/* Reserved region rather than a conditional block, so the button does
          not jump down the screen the moment a sign-in fails. */}
      <div aria-live="polite" className="min-h-5">
        {formError ? (
          <p role="alert" className="type-body font-medium text-danger">
            {formError}
          </p>
        ) : null}
      </div>

      {/* The panel's own primary button, taken to the door's height and given
          the ignition flash: the fill, the edge and every state stay the ones
          every other action in the panel wears — on this screen the tokens
          under them are the door's. */}
      <Button
        type="submit"
        size="lg"
        className="door-ignite h-14 w-full"
        disabled={isSubmitting}
      >
        {isSubmitting ? "Kirilmoqda…" : "Kirish"}
      </Button>

      <p className="type-caption pt-1 text-center text-muted">
        Parolni unutdingizmi? Direktorga murojaat qiling.
      </p>
    </form>
  );
}

interface DoorFieldProps {
  label: string;
  glyph: LucideIcon;
  error: string | null;
  /** Rendered with the id the label points at, and whether the value was refused. */
  children: (id: string, invalid: boolean) => React.ReactNode;
}

/**
 * Label, box, glyph, message — the four parts of a door field.
 *
 * The label stays visible. The screen it is drawn from labels its fields with
 * placeholders alone, which is fine for a page someone visits once and wrong
 * for the one staff sign into every morning: a placeholder disappears at the
 * first keystroke, and with it the only statement of what the field is.
 */
function DoorField({ label, glyph, error, children }: DoorFieldProps) {
  const id = useId();
  const invalid = Boolean(error);

  return (
    <div>
      <label htmlFor={id} className="type-eyebrow mb-2 block text-muted">
        {label}
      </label>
      {/* `data-invalid` and not a class: the state is read by `.door-field`'s
          own rules, and an attribute keeps the refused colours in one place
          rather than splitting them between here and the stylesheet. */}
      <div data-invalid={invalid} className="door-field h-14 gap-3 px-4">
        <Icon icon={glyph} size="md" className={invalid ? "text-danger" : "text-muted"} />
        {children(id, invalid)}
      </div>
      {error ? (
        <p role="alert" className="type-caption mt-2 text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
