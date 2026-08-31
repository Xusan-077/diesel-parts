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
 *
 * This is the *bare* rail, with no frame around it. It is what a filter in a
 * toolbar wears: one control in a row of controls, where a box on each would
 * fence off six things that are read as one strip. A field inside a form wears
 * `fieldBox` instead — see the note there.
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
 * The framed field: the rail, now with a box around it.
 *
 * The rail alone was the panel's field treatment everywhere, and in a form it
 * failed at the one job a field has — looking like something you can type in.
 * A 2px stroke floating to the left of unbordered text reads as a quote mark
 * on a dense screen, not as an input, and directors said so.
 *
 * So the box is back, and the rail is kept: the frame says "control", the rail
 * says "which state". They are not redundant, because they answer at different
 * distances — the frame is visible across the room, the rail's colour is what
 * you read once you are looking at the field.
 *
 * State lives here rather than on the control inside, because a field is more
 * than its input: a select with an arrow, a price box with a currency suffix,
 * a search with a spinner all have to light up as one object. `focus-within`
 * is what makes that true whichever child actually took focus.
 *
 * The ring is two stops of one box-shadow: 2px of solid `--accent-strong`
 * hard against the border, then 4px more of the translucent halo behind it.
 * That shape is not decoration. WCAG 2.2 asks a focus indicator for a 2px
 * perimeter at 3:1 against what surrounds it, and a translucent bloom cannot
 * reach 3:1 at any opacity that still reads as a bloom — the old 3px halo
 * alone measured under 1.3:1. The solid stop clears it (5.17:1 light, 8.65:1
 * dark); the halo behind it is what keeps the field looking lit rather than
 * outlined.
 *
 * Because the ring is now sufficient on its own, the control inside gives up
 * the app's `:focus-visible` outline — see `controlVariants`. Previously both
 * were drawn, and the outline sat 2px out from the *bare* input: inside the
 * field's box horizontally, outside it vertically, so a near-black rectangle
 * cut straight through the top and bottom borders of a focused field. That is
 * the bug this pair of changes fixes, which is why the two halves move
 * together — dropping either one on its own leaves a field with no ring or
 * with two.
 */
export function fieldBox({
  invalid = false,
  disabled = false,
  multiline = false,
  className,
}: {
  invalid?: boolean;
  disabled?: boolean;
  /** A textarea grows; centring it would strand a 5-row box's text midway. */
  multiline?: boolean;
  className?: string;
} = {}) {
  return cn(
    "flex gap-2 rounded-md border border-l-2 bg-surface px-3 transition-[color,background-color,border-color,box-shadow]",
    multiline ? "items-stretch" : "items-center",
    disabled
      ? "cursor-not-allowed border-border bg-surface-muted"
      : invalid
        ? // A rejected field keeps its red under focus. Handing it the accent
          // the moment it is refocused would read as "fixed" before the value
          // has changed, which is the one thing an error state must not say.
          "border-danger focus-within:shadow-[0_0_0_2px_var(--danger),0_0_0_6px_var(--field-halo-danger)]"
        : "border-field-border focus-within:border-accent-strong focus-within:shadow-[0_0_0_2px_var(--accent-strong),0_0_0_6px_var(--field-halo)]",
    className,
  );
}

/**
 * Shared skin for every text-entry control.
 *
 * `rail` is what a control wears inside a field: the field — bare rail or box
 * — is the boundary, so the control adds no border, no padding and no shadow.
 * `box` is the standalone fallback — a bare search input with no field around
 * it — where something still has to say "control", held at `field-border` for
 * the 3:1 WCAG 1.4.11 asks of a user-interface component. That token, not
 * `border-strong`: they are the same value in the panel, but the marketing
 * palette's `border-strong` is a soft divider grey at 1.62:1, and an input is
 * the one box whose edge is the only evidence it exists. `--field-border` is
 * the token that exists to hold that line — see app/globals.css.
 *
 * The standalone box carries its own focus ring; the `rail` variant does not,
 * because inside a field that is `fieldBox`'s job and two rings on one control
 * would double the bloom.
 *
 * `ring` is the second axis, and it is here because "rail" alone cannot answer
 * the question that matters at focus time: is there anything around this
 * control that will light up? Inside `FormField` there is, and the app's
 * `:focus-visible` outline has to go or it draws a black rectangle through the
 * field's orange one. Inside a bare `fieldRail` — a toolbar filter, a checkbox
 * row — there is not, and the app ring is the only indicator the control has.
 * `useControlProps` reads the value off whether a field context is present, so
 * no call site sets it by hand.
 */
export const controlVariants = cva(
  // `min-w-0` because a field is a flex row: without it a long value in an
  // input refuses to shrink and pushes the suffix out of the box.
  "w-full min-w-0 bg-transparent text-sm text-foreground placeholder:text-muted disabled:cursor-not-allowed disabled:text-muted",
  {
    variants: {
      variant: {
        box: "rounded-md border border-field-border px-3 transition-[border-color,box-shadow] focus:border-accent-strong focus:shadow-[0_0_0_2px_var(--accent-strong),0_0_0_6px_var(--field-halo)] focus:outline-none disabled:border-border aria-invalid:border-danger aria-invalid:focus:shadow-[0_0_0_2px_var(--danger),0_0_0_6px_var(--field-halo-danger)]",
        rail: "border-0 px-0",
      },
      ring: {
        /** The field around this control lights up; the control draws nothing. */
        field: "focus:outline-none",
        /** Nothing else will, so the app's focus ring stays where it is. */
        none: "",
      },
    },
    defaultVariants: { variant: "box", ring: "none" },
  },
);

export type ControlVariant = "box" | "rail";
export type ControlRing = "field" | "none";
