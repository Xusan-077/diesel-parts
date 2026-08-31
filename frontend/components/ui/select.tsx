"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import { useControlProps, useFieldState } from "@/components/ui/form-field";
import { controlVariants, type ControlVariant } from "@/components/ui/field-styles";

export interface SelectProps extends React.ComponentProps<"select"> {
  /** Inferred from the surrounding FormField; pass it only to override. */
  variant?: ControlVariant;
  /** Applied to the positioning wrapper rather than the control. */
  wrapperClassName?: string;
}

/**
 * A native `<select>`, kept native.
 *
 * The panel's lists are short and closed sets — a role, a brand, a category —
 * and a listbox rebuilt in React would have to earn back the keyboard
 * type-ahead, the mobile wheel and the zero-JS render that the platform gives
 * for free. What the platform does not give is a themed arrow, so the UA one
 * is replaced: it is painted by the OS and stays light on a dark panel.
 */
export function Select({
  className,
  wrapperClassName,
  variant,
  id,
  disabled,
  required,
  "aria-describedby": describedBy,
  "aria-invalid": invalid,
  children,
  ...props
}: SelectProps) {
  const field = useFieldState();
  const control = useControlProps(field, {
    variant,
    id,
    disabled,
    required,
    describedBy,
    invalid,
  });
  const rail = control.variant === "rail";

  return (
    // `min-w-0 flex-1` keeps the arrow anchored to the control when the field
    // around it is a flex row rather than a block.
    <div className={cn("relative min-w-0 flex-1", wrapperClassName)}>
      <select
        id={control.id}
        disabled={control.disabled}
        required={control.required}
        aria-describedby={control["aria-describedby"]}
        aria-invalid={control["aria-invalid"]}
        className={cn(
          controlVariants({ variant: control.variant, ring: control.ring }),
          "h-10 appearance-none",
          // Room for the arrow.
          rail ? "pr-6" : "pr-9",
          // The open list is an OS surface. `color-scheme` on :root gets it
          // into the right theme; these two hold the exact panel tokens.
          "[&>option]:bg-surface [&>option]:text-foreground",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <Icon
        icon={ChevronDown}
        className={cn(
          "pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted",
          rail ? "right-1" : "right-3",
        )}
      />
    </div>
  );
}
