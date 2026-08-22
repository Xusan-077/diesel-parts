"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { AlertCircle } from "lucide-react";
import { fieldBox, type ControlRing, type ControlVariant } from "@/components/ui/field-styles";

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
  required: boolean;
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
    required?: boolean;
    describedBy?: string;
    invalid?: React.AriaAttributes["aria-invalid"];
  },
) {
  const variant: ControlVariant = explicit.variant ?? (field ? "rail" : "box");

  return {
    variant,
    /*
     * Who draws the focus ring. A field is a box with `focus-within` on it, so
     * when there is one the control must drop the app's `:focus-visible`
     * outline — two indicators on one control is what put a black rectangle
     * through the middle of a focused field. A control standing on its own
     * keeps the outline unless its own variant already rings it.
     */
    ring: (field !== null || variant === "box" ? "field" : "none") satisfies ControlRing,
    id: explicit.id ?? field?.controlId,
    disabled: explicit.disabled ?? field?.disabled,
    /*
     * The requirement rides on the control, not on the label.
     *
     * The obvious alternative — appending "(majburiy)" to the label for screen
     * readers — puts the word inside the field's accessible name, so the field
     * is announced as "Nomi (uz) majburiy, edit text" and is no longer findable
     * by the name printed on screen. `required` is the platform's own answer:
     * it is announced at the right moment, in the reader's own words, and it
     * leaves the name alone. The asterisk stays purely visual.
     */
    required: explicit.required ?? field?.required,
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
        "mt-1 flex items-start gap-2 text-xs",
        tone === "error" ? "font-medium text-danger" : "text-muted",
        className,
      )}
    >
      {tone === "error" ? (
        /* Colour is never the only carrier of a state in this panel. The
           border is red, the text is red, and neither survives a monochrome
           print or a red-green reader — the glyph does. */
        <AlertCircle aria-hidden className="mt-px size-3.5 shrink-0" strokeWidth={2.25} />
      ) : null}
      <span>{message}</span>
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
  /** Prints the required marker beside the label and nothing else — the
   *  browser's own `required` still belongs on the control. */
  required?: boolean;
  /** Stretches the box for a textarea instead of centring one line in it. */
  multiline?: boolean;
  /** Trailing content inside the box: a unit, a currency word, a clear button. */
  suffix?: React.ReactNode;
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
  required = false,
  multiline = false,
  suffix,
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
      required,
    }),
    [controlId, messageId, message, invalid, disabled, required],
  );

  return (
    <div className={className}>
      {/*
        * The label sits above the box, never inside it. A floating label is a
        * placeholder until you commit, which means the one moment you most
        * want to re-read what a half-filled field was asking for is the moment
        * its question has scrolled into the value. Static costs one line and
        * never lies.
        */}
      <div className="mb-2 flex items-center gap-1">
        <Label htmlFor={controlId} className={cn(disabled && "text-muted")}>
          {label}
        </Label>
        {required ? (
          /*
           * A sibling of the label, not a child of it. The accessible name of a
           * field is built from its label's contents, and an asterisk in there
           * makes the field "SKU star" — findable by neither the words on
           * screen nor the words a person would say. `aria-hidden` is not
           * enough on its own: it is honoured by the name computation but not
           * by every tool that reads a label, so the mark is kept out of the
           * element entirely. The control's own `required` is what carries the
           * fact to assistive technology.
           */
          <span aria-hidden className="text-danger">
            *
          </span>
        ) : null}
      </div>

      <div className={fieldBox({ invalid, disabled, multiline })}>
        <FieldContext.Provider value={state}>{children}</FieldContext.Provider>
        {suffix === undefined ? null : (
          <span className="shrink-0 text-xs text-muted select-none">{suffix}</span>
        )}
      </div>

      {message === null ? null : (
        <FieldMessage key={tone} id={messageId} message={message} tone={tone} />
      )}
    </div>
  );
}
