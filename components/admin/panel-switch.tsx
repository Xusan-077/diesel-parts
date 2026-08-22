"use client";

import { cn } from "@/lib/utils";

/**
 * A two-state control that takes effect the moment it is thrown.
 *
 * `role="switch"` rather than a checkbox because there is no form and nothing
 * to submit: the dark mode is on or off as soon as it is pressed, and a
 * checkbox promises a save that never comes.
 *
 * The knob's travel is a transform, so a reader who asked for less motion gets
 * the state change without the slide — the stylesheet's reduced-motion block
 * collapses the duration and the knob simply appears at the other end.
 */
export function PanelSwitch({
  checked,
  onChange,
  label,
  className,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** Names the control for a screen reader; the visible text is beside it. */
  label: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full border transition-colors",
        checked
          ? "border-accent-edge bg-accent"
          : "border-border-strong bg-surface-muted",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute top-0.5 h-4.5 w-4.5 rounded-full transition-transform",
          checked
            ? "translate-x-5.5 bg-accent-foreground"
            : "translate-x-0.5 bg-border-strong",
        )}
      />
    </button>
  );
}
