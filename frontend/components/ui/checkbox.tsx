"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { FieldMessage } from "@/components/ui/form-field";
import { fieldRail } from "@/components/ui/field-styles";

/**
 * A native checkbox tinted with the brand accent.
 *
 * Native because the platform box brings its own focus ring, its own
 * forced-colors rendering and a real indeterminate state; a div-and-svg
 * reimplementation has to win all three back before it has broken even.
 *
 * The accent tint is the one place orange marks a value rather than an action.
 * It stays inside the rule — a checked box is a control you are operating, not
 * a status being reported about a record.
 */
export function Checkbox({
  className,
  ...props
}: Omit<React.ComponentProps<"input">, "type">) {
  return (
    <input
      type="checkbox"
      className={cn("size-4 shrink-0 accent-accent disabled:cursor-not-allowed", className)}
      {...props}
    />
  );
}

export interface CheckboxFieldProps extends Omit<React.ComponentProps<"input">, "type"> {
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: string | null;
  /** Applied to the field rail rather than the box. */
  fieldClassName?: string;
}

/**
 * A checkbox on the panel's rail, with the same label, hint and error slots
 * every other field has.
 *
 * It cannot go through `FormField`: a checkbox labels itself from the right,
 * and the label is the click target, so the label-above layout does not apply.
 * Everything else — the rail, the shared message slot, the a11y wiring — is the
 * same code.
 */
export function CheckboxField({
  label,
  hint,
  error,
  className,
  fieldClassName,
  id,
  disabled,
  ...props
}: CheckboxFieldProps) {
  const generatedId = React.useId();
  const controlId = id ?? generatedId;
  const messageId = controlId + "-message";

  const invalid = Boolean(error);
  const message = error ?? hint ?? null;
  const tone = error ? "error" : "hint";

  return (
    <div className={fieldRail({ invalid, className: fieldClassName })}>
      <div className="flex items-center gap-3">
        <Checkbox
          id={controlId}
          disabled={disabled}
          aria-describedby={message === null ? undefined : messageId}
          aria-invalid={invalid || undefined}
          className={className}
          {...props}
        />
        <Label htmlFor={controlId} className={cn(disabled && "text-muted")}>
          {label}
        </Label>
      </div>
      {message === null ? null : (
        <FieldMessage
          key={tone}
          id={messageId}
          message={message}
          tone={tone}
          // Aligned under the label, past the box and its gap.
          className="pl-7"
        />
      )}
    </div>
  );
}
