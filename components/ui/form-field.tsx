"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { fieldRail, type ControlVariant } from "@/components/ui/field-styles";

/*
 * The field's behaviour. Its looks live in `field-styles.ts`, which carries no
 * React and no `"use client"` so a Server Component can share the treatment
 * without opening a client boundary. Do not re-export from here: anything this
 * module exports is a client reference.
 */

/** What a control inherits from the field around it. */
export interface FieldState {
  controlId: string;
  describedBy: string | undefined;
  invalid: boolean;
  disabled: boolean;
}

const FieldContext = React.createContext<FieldState | null>(null);

/**
 * Null when a control is rendered on its own, which is also how a control
 * decides which variant to wear: inside a field it is a rail, outside it is a
 * box. No call site has to pass that through.
 */
export function useFieldState(): FieldState | null {
  return React.useContext(FieldContext);
}

/**
 * Resolves the props a control shares with its field. An explicit prop always
 * wins over the inherited one, so a control can still be driven directly.
 */
export function useControlProps(
  field: FieldState | null,
  explicit: {
    variant?: ControlVariant;
    id?: string;
    disabled?: boolean;
    describedBy?: string;
    invalid?: React.AriaAttributes["aria-invalid"];
  },
) {
  return {
    variant: explicit.variant ?? (field ? "rail" : "box"),
    id: explicit.id ?? field?.controlId,
    disabled: explicit.disabled ?? field?.disabled,
    "aria-describedby": explicit.describedBy ?? field?.describedBy,
    "aria-invalid": explicit.invalid ?? (field?.invalid ? true : undefined),
  } as const;
}

/**
 * The line under a field. Hint and error share it rather than stacking,
 * because both are guidance about this one field and the error is the version
 * that matters right now — and because a field that keeps its height cannot
 * shove the rest of a two-column grid down the page when it fails.
 *
 * Render this with `key={tone}` so the swap remounts the node: adding
 * `role="alert"` to a paragraph that is already in the DOM is not reliably
 * announced, while inserting one that carries it is.
 */
export function FieldMessage({
  id,
  message,
  tone,
  className,
}: {
  id: string;
  message: React.ReactNode;
  tone: "hint" | "error";
  className?: string;
}) {
  return (
    <p
      id={id}
      role={tone === "error" ? "alert" : undefined}
      className={cn(
        // Same size as the hint, heavier and red: an error is distinguishable
        // at a glance without occupying more room than the hint it replaced.
        "mt-1 text-xs",
        tone === "error" ? "font-medium text-danger" : "text-muted",
        className,
      )}
    >
      {message}
    </p>
  );
}

export interface FormFieldProps {
  /** Always visible, always above the control. Never a placeholder. */
  label: React.ReactNode;
  /** Standing guidance — what the value does, not what it should look like. */
  hint?: React.ReactNode;
  /** Replaces the hint while set, and marks the rail and the control. */
  error?: string | null;
  /** Only for a field whose id another element has to point at. */
  id?: string;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}

/**
 * Label, control, and one line of guidance, wired together.
 *
 * The control inside needs no `id`, no `aria-describedby` and no `aria-invalid`
 * — it reads them from here.
 */
export function FormField({
  label,
  hint,
  error,
  id,
  disabled = false,
  className,
  children,
}: FormFieldProps) {
  const generatedId = React.useId();
  const controlId = id ?? generatedId;
  const messageId = controlId + "-message";

  const invalid = Boolean(error);
  const message = error ?? hint ?? null;
  const tone = error ? "error" : "hint";

  const state = React.useMemo<FieldState>(
    () => ({
      controlId,
      describedBy: message === null ? undefined : messageId,
      invalid,
      disabled,
    }),
    [controlId, messageId, message, invalid, disabled],
  );

  return (
    <div className={fieldRail({ invalid, className })}>
      <Label htmlFor={controlId} className={cn("block", disabled && "text-muted")}>
        {label}
      </Label>
      <div className="mt-2">
        <FieldContext.Provider value={state}>{children}</FieldContext.Provider>
      </div>
      {message === null ? null : (
        <FieldMessage key={tone} id={messageId} message={message} tone={tone} />
      )}
    </div>
  );
}
