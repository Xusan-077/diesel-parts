import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

/*
 * The field's looks, with none of its behaviour.
 *
 * This module is deliberately free of React and of `"use client"`: a Server
 * Component that only wants the panel's field treatment — the catalogue's
 * search box, the customer book's — can import from here and stay on the
 * server. `form-field.tsx` is the client half, and importing anything from it
 * (even a plain string) turns the importer into a client reference. Keep those
 * two facts apart and the boundary stays where it belongs: open in real forms,
 * closed in a plain GET filter.
 */

/**
 * The rail: a 2px stroke down the left of a field, carrying its whole state.
 * Quiet at rest, orange under focus, red when the value was rejected.
 *
 * Focus and error are mutually exclusive on purpose — a field that is already
 * wrong stays red while you correct it, because turning it orange the moment
 * it takes focus would read as "fixed".
 */
export function fieldRail({
  invalid = false,
  className,
}: { invalid?: boolean; className?: string } = {}) {
  return cn(
    "border-l-2 pl-4 transition-colors",
    invalid ? "border-danger" : "border-border focus-within:border-accent-strong",
    className,
  );
}

/**
 * Shared skin for every text-entry control.
 *
 * `rail` is what a control wears inside a field: the rail is the boundary, so
 * the control adds no border, no padding and no shadow. `box` is the
 * standalone fallback — a dialog, a bare search input — where something still
 * has to say "control", held at `border-strong` for the 3:1 WCAG 1.4.11 asks
 * of a user-interface component.
 *
 * There is no focus ring here. `:focus-visible` in globals.css draws one ring
 * for the whole app; a per-control ring would be a second, competing answer.
 */
export const controlVariants = cva(
  "w-full bg-transparent text-sm text-foreground placeholder:text-muted disabled:cursor-not-allowed disabled:text-muted",
  {
    variants: {
      variant: {
        box: "rounded-md border border-border-strong px-3 focus:border-accent-strong disabled:border-border aria-invalid:border-danger",
        rail: "border-0 px-0",
      },
    },
    defaultVariants: { variant: "box" },
  },
);

export type ControlVariant = "box" | "rail";
