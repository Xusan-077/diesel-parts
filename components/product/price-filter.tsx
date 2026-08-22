"use client";

import { useState } from "react";
import { RangeSlider } from "@/components/ui/range-slider";
import { controlVariants } from "@/components/ui/field-styles";
import { formatNumber, formatPrice, parseAmount } from "@/lib/format-price";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import { cn } from "@/lib/utils";

export interface PriceBounds {
  min: number;
  max: number;
}

export interface PriceFilterProps {
  /** The cheapest and dearest priced product in the catalog. */
  bounds: PriceBounds;
  min: number | null;
  max: number | null;
  onChange: (min: number | null, max: number | null) => void;
  lang: Locale;
  dict: Dictionary["catalog"];
}

type Draft = [string, string];

function clamp(value: number, bounds: PriceBounds): number {
  return Math.min(bounds.max, Math.max(bounds.min, value));
}

/**
 * How far one keypress, or one notch of the drag, moves a thumb.
 *
 * Derived from the catalog's own range rather than fixed, because the two
 * failures are opposite and both real: a flat 10 000 across a 31-million
 * catalog is three thousand arrow presses from end to end, while the same step
 * across a range of 200 000 would give the reader twenty positions to choose
 * from. A two-hundredth of the span is roughly one step per pixel of sidebar,
 * rounded down to a power of ten so the thumbs land on figures a reader would
 * have typed themselves.
 */
function sliderStep(bounds: PriceBounds): number {
  const span = Math.max(bounds.max - bounds.min, 1);
  const magnitude = 10 ** Math.floor(Math.log10(span / 200));
  return Math.max(1_000, magnitude);
}

/**
 * A price range, entered two ways.
 *
 * The slider is for "roughly this much" and the boxes are for "under two
 * million exactly"; both edit the same pair, so whichever the reader reaches
 * for, the other follows. The boxes are the authority on what was meant — the
 * slider steps in whole thousands and cannot express 1 999 000.
 *
 * A thumb parked on its own end of the track clears that end rather than
 * pinning it to the catalog's cheapest or dearest price. The two are the same
 * result set today, but the bounds move as stock changes, and a filter that
 * silently freezes today's ceiling would start hiding tomorrow's parts.
 */
export function PriceFilter({ bounds, min, max, onChange, lang, dict }: PriceFilterProps) {
  const format = (value: number | null) => (value === null ? "" : formatNumber(value, lang));

  const [draft, setDraft] = useState<Draft>(() => [format(min), format(max)]);
  /*
   * What this component last put into the filter state. Re-checked on render so
   * a change from anywhere else — a chip's ✕, "clear all", the drawer being
   * reopened — rewrites the boxes, while the reader's own typing does not get
   * reformatted from under the caret.
   */
  const [emitted, setEmitted] = useState<[number | null, number | null]>([min, max]);

  if (emitted[0] !== min || emitted[1] !== max) {
    setEmitted([min, max]);
    setDraft([format(min), format(max)]);
  }

  function commit(nextMin: number | null, nextMax: number | null) {
    setEmitted([nextMin, nextMax]);
    onChange(nextMin, nextMax);
  }

  function handleSlide([low, high]: [number, number]) {
    const nextMin = low <= bounds.min ? null : low;
    const nextMax = high >= bounds.max ? null : high;
    setDraft([format(nextMin), format(nextMax)]);
    commit(nextMin, nextMax);
  }

  /** Digits only while typing: grouping mid-entry moves the caret. */
  function handleType(end: 0 | 1, raw: string) {
    const digits = raw.replace(/\D/g, "");
    setDraft((current) => (end === 0 ? [digits, current[1]] : [current[0], digits]));

    const parsed = parseAmount(digits);
    commit(end === 0 ? parsed : min, end === 1 ? parsed : max);
  }

  /**
   * Leaving a box is when the entry is tidied: grouped, clamped into the
   * catalog's real range, and swapped if the reader typed the ends the wrong
   * way round. Doing any of that on each keystroke fights the typing — "50"
   * would clamp to the catalog minimum before "500 000" was finished.
   */
  function handleBlur() {
    const typedMin = parseAmount(draft[0]);
    const typedMax = parseAmount(draft[1]);

    let nextMin = typedMin === null ? null : clamp(typedMin, bounds);
    let nextMax = typedMax === null ? null : clamp(typedMax, bounds);

    if (nextMin !== null && nextMax !== null && nextMin > nextMax) {
      [nextMin, nextMax] = [nextMax, nextMin];
    }

    setDraft([format(nextMin), format(nextMax)]);
    commit(nextMin, nextMax);
  }

  const inputClass = cn(controlVariants({ variant: "box" }), "h-9 tabular-nums");

  return (
    <div className="pt-1">
      <RangeSlider
        min={bounds.min}
        max={bounds.max}
        step={sliderStep(bounds)}
        value={[
          min === null ? bounds.min : clamp(min, bounds),
          max === null ? bounds.max : clamp(max, bounds),
        ]}
        onChange={handleSlide}
        // Named apart from the boxes below: they edit the same pair, and a
        // screen reader announcing four controls all called "lowest price"
        // cannot say which one has focus.
        minLabel={dict.priceSliderFrom}
        maxLabel={dict.priceSliderTo}
        formatValue={(value) => formatPrice(value, lang) ?? String(value)}
      />

      <div className="mt-3 grid grid-cols-2 gap-2">
        <input
          type="text"
          inputMode="numeric"
          value={draft[0]}
          onChange={(event) => handleType(0, event.target.value)}
          onBlur={handleBlur}
          placeholder={dict.priceFromPlaceholder}
          aria-label={dict.priceFromLabel}
          className={inputClass}
        />
        <input
          type="text"
          inputMode="numeric"
          value={draft[1]}
          onChange={(event) => handleType(1, event.target.value)}
          onBlur={handleBlur}
          placeholder={dict.priceToPlaceholder}
          aria-label={dict.priceToLabel}
          className={inputClass}
        />
      </div>
    </div>
  );
}
