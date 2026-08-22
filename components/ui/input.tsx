"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useControlProps, useFieldState } from "@/components/ui/form-field";
import { controlVariants, type ControlVariant } from "@/components/ui/field-styles";

export interface InputProps extends React.ComponentProps<"input"> {
  /** Inferred from the surrounding FormField; pass it only to override. */
  variant?: ControlVariant;
}

export function Input({
  className,
  variant,
  id,
  disabled,
  required,
  "aria-describedby": describedBy,
  "aria-invalid": invalid,
  ...props
}: InputProps) {
  const field = useFieldState();
  const control = useControlProps(field, {
    variant,
    id,
    disabled,
    required,
    describedBy,
    invalid,
  });

  return (
    <input
      id={control.id}
      disabled={control.disabled}
      required={control.required}
      aria-describedby={control["aria-describedby"]}
      aria-invalid={control["aria-invalid"]}
      className={cn(controlVariants({ variant: control.variant, ring: control.ring }), "h-10", className)}
      {...props}
    />
  );
}
