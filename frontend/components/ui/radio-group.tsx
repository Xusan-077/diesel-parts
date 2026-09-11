"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";

/**
 * Native radios, styled like `Checkbox` — a native box brings its own focus
 * ring, forced-colors rendering and keyboard grouping (arrow keys move
 * between radios that share a `name` for free); a div-and-pointer
 * reimplementation has to win all three back before it has broken even.
 */
interface RadioGroupContextValue {
  name: string;
  value: string;
  onValueChange: (value: string) => void;
}

const RadioGroupContext = React.createContext<RadioGroupContextValue | null>(null);

export interface RadioGroupProps extends Omit<React.ComponentProps<"div">, "onChange"> {
  name: string;
  value: string;
  onValueChange: (value: string) => void;
}

export function RadioGroup({
  name,
  value,
  onValueChange,
  className,
  children,
  ...props
}: RadioGroupProps) {
  const context = React.useMemo(() => ({ name, value, onValueChange }), [name, value, onValueChange]);

  return (
    <RadioGroupContext.Provider value={context}>
      <div role="radiogroup" className={cn("flex flex-col gap-3", className)} {...props}>
        {children}
      </div>
    </RadioGroupContext.Provider>
  );
}

export interface RadioGroupItemProps {
  value: string;
  label: React.ReactNode;
  description?: React.ReactNode;
  /** Optional leading glyph, sized to sit level with the label + description. */
  icon?: LucideIcon;
  disabled?: boolean;
  className?: string;
}

/** A selectable row rather than a bare dot — the label and the description
 *  both sit inside the click target, and the whole row marks the selection. */
export function RadioGroupItem({ value, label, description, icon, disabled, className }: RadioGroupItemProps) {
  const group = React.useContext(RadioGroupContext);
  if (!group) {
    throw new Error("RadioGroupItem must be rendered inside a RadioGroup");
  }
  const id = `${group.name}-${value}`;
  const checked = group.value === value;

  return (
    <label
      htmlFor={id}
      className={cn(
        "flex items-start gap-3 rounded-lg border p-4 transition-[color,background-color,border-color,box-shadow]",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
        // Selected reads as a lit card: accent edge doubled by an inset ring so
        // the choice is unmistakable across a stack of them. Unselected answers
        // the pointer with a firmer edge, not just a wash.
        checked
          ? "border-accent-edge bg-accent-subtle shadow-[inset_0_0_0_1px_var(--accent-edge)]"
          : "border-border bg-surface hover:border-border-strong hover:bg-surface-hover",
        className,
      )}
    >
      <input
        type="radio"
        id={id}
        name={group.name}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={() => group.onValueChange(value)}
        className="mt-0.5 size-4 shrink-0 accent-accent"
      />
      {icon ? (
        <Icon
          icon={icon}
          size="md"
          className={cn("mt-0.5", checked ? "text-accent-strong" : "text-muted")}
        />
      ) : null}
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-foreground">{label}</span>
        {description ? <span className="text-xs text-muted">{description}</span> : null}
      </span>
    </label>
  );
}
