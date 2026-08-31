"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarRange } from "lucide-react";
import { ANALYTICS_PERIOD_OPTIONS, MAX_CUSTOM_DAYS } from "@/lib/analytics/period";
import { isoDay, type Range } from "@/lib/calendar";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Icon } from "@/components/ui/icon";

const PRESET_LABEL: Record<number, string> = {
  1: "Bugun",
  7: "7 kun",
  30: "30 kun",
  90: "90 kun",
};

const DAY_MS = 86_400_000;

/**
 * The window every figure on the analytics screen is measured over.
 *
 * The presets stay links, for the same reason the dashboard's do: the period
 * lives in the URL, so a director can bookmark the 90-day view and the back
 * button steps through the windows they actually looked at.
 *
 * The custom range is the one exception, and it is a calendar rather than two
 * date boxes parked in the toolbar. A half-typed range is not a window: picking
 * a start would otherwise refetch the whole page against a range whose end is
 * still yesterday's value. The calendar holds both ends until they are a pair,
 * then commits once.
 */
export function AnalyticsPeriod({
  days,
  from,
  to,
  custom,
}: {
  days: number;
  /** The active window's bounds, used to seed the calendar. */
  from: Date;
  to: Date;
  custom: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  /*
   * The last day a person would name, from the exclusive bound the period
   * arithmetic works in.
   *
   * A hand-picked window ends at midnight after its last day, so a day comes
   * off it. A preset window ends at the live clock, so today *is* its last day
   * and taking a day off would seed the calendar with yesterday — which is what
   * the old dialog did, and why re-opening it offered a range one day short of
   * the one on screen.
   */
  const lastDay = custom ? isoDay(new Date(to.getTime() - DAY_MS)) : isoDay(to);
  const firstDay = isoDay(from);
  /* Presets always end today, so today is also the furthest the calendar goes. */
  const today = custom ? isoDay(new Date()) : lastDay;

  const presetHref = (option: number) => {
    const next = new URLSearchParams(params.toString());
    next.set("days", String(option));
    // A preset and a custom range are alternatives, so choosing one clears the
    // other rather than leaving a stale pair in the URL for `resolvePeriod` to
    // prefer over the button that was just pressed.
    next.delete("from");
    next.delete("to");
    return pathname + "?" + next.toString();
  };

  function apply(range: Range) {
    const next = new URLSearchParams(params.toString());
    next.set("from", range.start);
    next.set("to", range.end);
    next.delete("days");
    router.push(pathname + "?" + next.toString());
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <nav
        aria-label="Davr"
        className="flex items-center gap-1 rounded-md border border-border bg-surface-muted p-1"
      >
        {ANALYTICS_PERIOD_OPTIONS.map((option) => {
          const active = !custom && option === days;

          return (
            <a
              key={option}
              href={presetHref(option)}
              aria-current={active ? "true" : undefined}
              className={
                "type-eyebrow inline-flex h-7 items-center rounded-sm px-3 transition-colors " +
                (active
                  ? /* The accent fill carries its 1px edge for the same reason
                       the primary button does: the brand orange is 2.56:1 on
                       white, under the 3:1 a control's boundary owes. */
                    "border border-accent-edge bg-accent text-accent-foreground"
                  : "border border-transparent text-muted hover:bg-surface-hover hover:text-foreground")
              }
            >
              {PRESET_LABEL[option] ?? option}
            </a>
          );
        })}
      </nav>

      <DateRangePicker
        start={firstDay}
        end={lastDay}
        max={today}
        maxDays={MAX_CUSTOM_DAYS}
        onApply={apply}
        onClear={custom ? () => router.push(presetHref(30)) : undefined}
      >
        <button
          type="button"
          aria-current={custom ? "true" : undefined}
          className={
            "inline-flex h-9 items-center gap-2 rounded-md border px-3 text-xs transition-colors " +
            (custom
              ? "border-accent-edge bg-accent text-accent-foreground"
              : "border-border text-muted hover:bg-surface-hover hover:text-foreground")
          }
        >
          <Icon icon={CalendarRange} size="xs" />
          {custom ? (
            // Once a range is in force the button stops saying what it does and
            // starts saying what is selected — it is now a readout as much as a
            // control, and the alternative is a chosen window with nowhere on
            // screen that states it.
            <span className="font-mono tabular-nums">
              {firstDay} — {lastDay}
            </span>
          ) : (
            "Boshqa oraliq"
          )}
        </button>
      </DateRangePicker>
    </div>
  );
}
