"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useControlProps, useFieldState } from "@/components/ui/form-field";
import { controlVariants, type ControlVariant } from "@/components/ui/field-styles";

export interface TextareaProps extends React.ComponentProps<"textarea"> {
  /** Inferred from the surrounding FormField; pass it only to override. */
  variant?: ControlVariant;
}

export function Textarea({
  className,
  variant,
  id,
  disabled,
  "aria-describedby": describedBy,
  "aria-invalid": invalid,
  ...props
}: TextareaProps) {
  const field = useFieldState();
  const control = useControlProps(field, { variant, id, disabled, describedBy, invalid });

  return (
    <textarea
      id={control.id}
      disabled={control.disabled}
      aria-describedby={control["aria-describedby"]}
      aria-invalid={control["aria-invalid"]}
      className={cn(
        controlVariants({ variant: control.variant }),
        // A box needs a floor so it reads as more than a tall input. A rail
        // does not, and the old blanket `min-h-24` meant `rows` was a lie
        // everywhere — call sites were passing `rows={2}` and getting 96px,
        // then cancelling it again with `min-h-0`.
        control.variant === "box" ? "min-h-24 py-2" : "py-1",
        className,
      )}
      {...props}
    />
  );
}
