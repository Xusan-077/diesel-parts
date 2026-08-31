"use client";

import { useId, useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { MAX_RATING } from "@/lib/product-stats";

/**
 * Picking one to five stars.
 *
 * Built on real radio inputs rather than buttons with `role="radio"`. Arrow
 * keys, the roving tab stop, form association and the required-group semantics
 * all come with the platform's own control; a hand-rolled group has to
 * reimplement every one of them and usually reimplements four.
 *
 * The stars stay monochrome, like the ones that display a score elsewhere on
 * the site. This palette gives the brand orange exactly one job — "you can act
 * on this, or you are here" — so a row of amber stars would put the accent on
 * a value while the submit button beside it is the thing to act on.
 *
 * Hover and keyboard focus both preview: the row fills to whichever star the
 * pointer or the focus ring is on, and falls back to the chosen value when
 * neither is. That is the whole affordance — without it, five outlines give no
 * clue that they fill left-to-right rather than one at a time.
 */
export function StarRatingInput({
  value,
  onChange,
  label,
  optionLabel,
  invalid = false,
  describedBy,
  disabled = false,
}: {
  /** 0 means nothing chosen yet. */
  value: number;
  onChange: (rating: number) => void;
  label: string;
  /** Template for one star's accessible name, e.g. "{n} yulduz". */
  optionLabel: string;
  /**
   * Reddens the empty stars. There is no `aria-invalid` to go with it: the
   * attribute is not supported on `radio`, and putting it on each option would
   * say the option is wrong rather than that nothing was chosen. The complaint
   * is announced by `describedBy` below, on the group, which is what the
   * validity actually belongs to.
   */
  invalid?: boolean;
  /** Id of the error text, associated with the whole group. */
  describedBy?: string;
  disabled?: boolean;
}) {
  const name = useId();
  const [preview, setPreview] = useState(0);

  const shown = preview || value;

  return (
    <fieldset
      disabled={disabled}
      aria-describedby={describedBy}
      className="min-w-0 border-0 p-0"
      onMouseLeave={() => setPreview(0)}
    >
      <legend className="type-eyebrow text-muted">{label}</legend>

      <div
        className={cn(
          "mt-3 inline-flex items-center gap-1",
          disabled && "opacity-50"
        )}
      >
        {Array.from({ length: MAX_RATING }, (_, index) => {
          const rating = index + 1;
          const filled = rating <= shown;

          return (
            <label
              key={rating}
              onMouseEnter={() => setPreview(rating)}
              className={cn(
                "cursor-pointer rounded-sm p-0.5 transition-colors",
                // The ring is drawn on the label because the input it belongs
                // to is visually hidden; without this a keyboard user moving
                // through the group would see nothing move.
                "focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent-strong",
                disabled && "cursor-not-allowed"
              )}
            >
              <input
                type="radio"
                name={name}
                value={rating}
                checked={value === rating}
                onChange={() => onChange(rating)}
                onFocus={() => setPreview(rating)}
                onBlur={() => setPreview(0)}
                className="sr-only"
              />
              <Star
                aria-hidden
                className={cn(
                  "h-6 w-6 shrink-0 stroke-[1.5] transition-colors",
                  filled
                    ? "fill-current text-foreground"
                    : invalid
                      ? "text-danger"
                      : "text-border-strong"
                )}
              />
              <span className="sr-only">{optionLabel.replace("{n}", String(rating))}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
