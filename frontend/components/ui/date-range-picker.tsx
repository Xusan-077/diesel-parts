"use client";

import * as React from "react";
import * as Popover from "@radix-ui/react-popover";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  QUICK_SPANS,
  WEEKDAYS,
  dayNumber,
  firstOfMonth,
  fullDayLabel,
  isoDay,
  lastOfMonth,
  monthCells,
  monthKey,
  monthLabel,
  monthOf,
  order,
  shiftDays,
  shiftMonth,
  spanDays,
  weekdayIndex,
  type Month,
  type Range,
} from "@/lib/calendar";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

/**
 * A two-month range calendar in a popover.
 *
 * It replaces a pair of native `type="date"` boxes in a dialog, which failed
 * this screen three separate ways: the native control on Windows is a
 * `dd.mm.yyyy` mask that has to be typed into, a half-typed range is not a
 * window at all, and neither box ever said how long the chosen span was — the
 * one number that makes two windows comparable to each other.
 *
 * All the date arithmetic lives in `lib/calendar.ts`, which is where the parts
 * of a calendar that break silently — month lengths, leap years, the
 * Monday-first offset, the UTC discipline the URL's bounds depend on — can be
 * asserted without rendering anything.
 */

export interface DateRangePickerProps {
  /** The window in force, as inclusive `YYYY-MM-DD` bounds. */
  start: string;
  end: string;
  /**
   * The latest day that can be chosen. Passed in rather than read off the
   * browser clock, so the calendar's "today" is the same one the server built
   * the report against.
   */
  max: string;
  /** Widest window the report will accept, in days. */
  maxDays: number;
  onApply: (range: Range) => void;
  /** Offered only when a hand-picked window is currently in force. */
  onClear?: () => void;
  /** The control the popover hangs from. */
  children: React.ReactNode;
}

export function DateRangePicker({
  start,
  end,
  max,
  maxDays,
  onApply,
  onClear,
  children,
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>{children}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          collisionPadding={12}
          aria-label="Oraliqni tanlang"
          // The calendar puts focus on the day cursor itself, so the arrow keys
          // work on the first press rather than after a tab into the grid.
          onOpenAutoFocus={(event) => event.preventDefault()}
          className="z-100 rounded-lg border border-border bg-surface p-3 shadow-xl"
        >
          {/*
            * Mounted only while open, and remounted on every open. That is what
            * seeds the draft from the window currently in force: a calendar
            * that kept last time's half-finished pick would open offering a
            * range the director had already walked away from.
            */}
          <RangeCalendar
            start={start}
            end={end}
            max={max}
            maxDays={maxDays}
            onApply={(range) => {
              setOpen(false);
              onApply(range);
            }}
            onCancel={() => setOpen(false)}
            onClear={
              onClear === undefined
                ? undefined
                : () => {
                    setOpen(false);
                    onClear();
                  }
            }
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function RangeCalendar({
  start,
  end,
  max,
  maxDays,
  onApply,
  onCancel,
  onClear,
}: {
  start: string;
  end: string;
  max: string;
  maxDays: number;
  onApply: (range: Range) => void;
  onCancel: () => void;
  onClear?: () => void;
}) {
  const gridsRef = React.useRef<HTMLDivElement>(null);
  const entered = React.useRef(false);
  const captionId = React.useId();

  const [range, setRange] = React.useState<Range>({ start, end });
  /**
   * The first click of a new pick. While it is set, what the grid shows is a
   * preview rather than a choice — which is why Apply is held until the second
   * click lands. Committing on the first click would refetch the whole report
   * against a window whose other end is still the old one.
   */
  const [anchor, setAnchor] = React.useState<string | null>(null);
  const [hovered, setHovered] = React.useState<string | null>(null);
  const [focused, setFocused] = React.useState(end);

  /** The left panel; the right one is always the month after it. */
  const [cursor, setCursor] = React.useState<Month>(() => shiftMonth(monthOf(end), -1));

  /**
   * What the grid paints. Mid-pick it follows the pointer — or the keyboard
   * cursor, so the preview is not a mouse-only affordance — and the day count
   * in the footer counts with it. Seeing "40 kun" before committing is the
   * whole reason this is a calendar and not two text boxes.
   */
  const preview = anchor === null ? range : order(anchor, hovered ?? focused);
  const pending = anchor !== null;
  const days = spanDays(preview);
  const tooLong = days > maxDays;

  /** Mid-pick, everything out of the anchor's reach is struck out as well. */
  function unreachable(day: string): boolean {
    if (day > max) {
      return true;
    }
    return anchor !== null && spanDays(order(anchor, day)) > maxDays;
  }

  function choose(day: string) {
    if (unreachable(day)) {
      return;
    }
    if (anchor === null) {
      setAnchor(day);
      setRange({ start: day, end: day });
      return;
    }
    setRange(order(anchor, day));
    setAnchor(null);
    setHovered(null);
  }

  function takeQuickSpan(span: Range) {
    setAnchor(null);
    setHovered(null);
    setRange(span);
    setFocused(span.end);
    setCursor(shiftMonth(monthOf(span.end), -1));
  }

  /** Keeps the day cursor on screen when the arrow keys walk off a panel. */
  function moveTo(day: string) {
    if (unreachable(day)) {
      return;
    }
    setFocused(day);

    const target = monthOf(day);
    if (monthKey(target) < monthKey(cursor)) {
      setCursor(target);
    } else if (monthKey(target) > monthKey(shiftMonth(cursor, 1))) {
      setCursor(shiftMonth(target, -1));
    }
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    const step: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };

    if (event.key in step) {
      event.preventDefault();
      moveTo(shiftDays(focused, step[event.key]));
      return;
    }

    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const column = weekdayIndex(focused);
      moveTo(shiftDays(focused, event.key === "Home" ? -column : 6 - column));
      return;
    }

    if (event.key === "PageUp" || event.key === "PageDown") {
      event.preventDefault();
      const by = event.key === "PageUp" ? -1 : 1;
      const target = shiftMonth(monthOf(focused), event.shiftKey ? by * 12 : by);
      // Clamped, so paging off the 31st into a 30-day month lands on the 30th
      // instead of silently skipping the month entirely.
      const last = dayNumber(lastOfMonth(target));
      moveTo(
        isoDay(
          new Date(Date.UTC(target.year, target.index, Math.min(dayNumber(focused), last))),
        ),
      );
    }
  }

  /*
   * The roving focus follows the day cursor. On mount it claims focus outright
   * — the popover handed it over. After that it moves focus only while the
   * grid already owns it, so clicking a day does not drag focus back onto a
   * button the pointer has left, and a quick-span chip keeps its own ring.
   */
  React.useEffect(() => {
    const grid = gridsRef.current;
    if (grid === null) {
      return;
    }
    if (entered.current && !grid.contains(document.activeElement)) {
      return;
    }
    entered.current = true;
    grid.querySelector<HTMLButtonElement>('[data-day="' + focused + '"]')?.focus();
  }, [focused]);

  const months = [cursor, shiftMonth(cursor, 1)];

  return (
    <div>
      {/* --- Quick spans ----------------------------------------------------- */}
      <div className="flex flex-wrap gap-1 border-b border-border pb-3">
        {QUICK_SPANS.map((quick) => {
          const span = quick.of(max);
          const active = !pending && span.start === range.start && span.end === range.end;

          return (
            <button
              key={quick.label}
              type="button"
              onClick={() => takeQuickSpan(span)}
              aria-pressed={active}
              className={cn(
                "type-eyebrow inline-flex h-7 items-center rounded-sm border px-2.5 transition-colors",
                active
                  ? "border-accent-edge bg-accent text-accent-foreground"
                  : "border-border text-muted hover:bg-surface-hover hover:text-foreground",
              )}
            >
              {quick.label}
            </button>
          );
        })}
      </div>

      {/* --- The two month grids ---------------------------------------------
        * They stack on a phone and the pair scrolls, rather than the popover as
        * a whole: the readout and Apply stay pinned where the thumb left them.
        */}
      <div
        ref={gridsRef}
        onKeyDown={handleKeyDown}
        onMouseLeave={() => setHovered(null)}
        className="flex max-h-[50vh] flex-col gap-5 overflow-y-auto py-3 sm:max-h-none sm:flex-row sm:gap-6 sm:overflow-visible"
      >
        {months.map((month, panel) => {
          const cells = monthCells(month);
          const headingId = captionId + "-" + panel;

          return (
            <section key={monthKey(month)}>
              <header className="mb-2 flex h-7 items-center justify-between gap-2">
                {/*
                  * One pair of arrows for both panels, split across them: back
                  * on the left month, forward on the right. Two full sets would
                  * give the same two months four ways to be reached.
                  */}
                {panel === 0 ? (
                  <StepButton
                    label="Oldingi oy"
                    icon={ChevronLeft}
                    onClick={() => setCursor(shiftMonth(cursor, -1))}
                  />
                ) : (
                  <span className="size-7" />
                )}

                <h3 id={headingId} className="text-sm font-medium text-foreground">
                  {monthLabel(month)}
                </h3>

                {panel === 1 ? (
                  <StepButton
                    label="Keyingi oy"
                    icon={ChevronRight}
                    // Nothing past today is reportable, so the calendar stops
                    // where the data does instead of offering empty months.
                    disabled={firstOfMonth(shiftMonth(month, 1)) > max}
                    onClick={() => setCursor(shiftMonth(cursor, 1))}
                  />
                ) : (
                  <span className="size-7" />
                )}
              </header>

              <table
                role="grid"
                aria-labelledby={headingId}
                className="border-separate border-spacing-0"
              >
                <thead>
                  <tr>
                    {WEEKDAYS.map((weekday) => (
                      <th
                        key={weekday.short}
                        scope="col"
                        abbr={weekday.long}
                        className="type-caption size-9 pb-1 font-normal text-muted"
                      >
                        {weekday.short}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 6 }, (_unused, week) => (
                    <tr key={week}>
                      {cells.slice(week * 7, week * 7 + 7).map((day, column) => (
                        <DayCell
                          key={day ?? "blank-" + week + "-" + column}
                          day={day}
                          column={column}
                          preview={preview}
                          today={max}
                          focused={focused}
                          disabled={day !== null && unreachable(day)}
                          onChoose={choose}
                          onHover={setHovered}
                        />
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          );
        })}
      </div>

      {/* --- Readout and commit ----------------------------------------------- */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-border pt-3">
        <p className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
          <span className="font-mono tabular-nums text-foreground">
            {preview.start} → {preview.end}
          </span>
          <span
            className={cn(
              "rounded-sm px-2 py-0.5 font-mono text-xs tabular-nums",
              tooLong ? "bg-danger-surface text-danger" : "bg-accent-subtle text-accent-strong",
            )}
          >
            {days} kun
          </span>
        </p>

        {/* Wraps, because on a phone the popover is one month wide and three
            buttons are not. */}
        <div className="ms-auto flex flex-wrap items-center justify-end gap-2">
          {onClear === undefined ? null : (
            /*
              * "Tozalash", not "Oraliqni bekor qilish". Next to the Cancel
              * button that sits beside it, two labels both starting "bekor
              * qilish" are one glance away from dropping the window when all
              * you meant to do was close the calendar.
              */
            <Button type="button" variant="ghost" size="sm" onClick={onClear}>
              Tozalash
            </Button>
          )}
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            Bekor qilish
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={pending || tooLong}
            onClick={() => onApply(range)}
          >
            Qo&apos;llash
          </Button>
        </div>

        {/*
          * One line, and mid-pick it says what to do next rather than what went
          * wrong — an unfinished range is not yet a mistake.
          */}
        <p
          aria-live="polite"
          className={cn("type-caption basis-full", tooLong ? "text-danger" : "text-muted")}
        >
          {tooLong
            ? "Eng uzuni " + maxDays + " kun. Boshlanish sanasini kechroq oling."
            : pending
              ? "Oraliqning ikkinchi kunini tanlang."
              : "Ikkala kun ham oraliqqa kiradi."}
        </p>
      </div>
    </div>
  );
}

function StepButton({
  label,
  icon,
  disabled,
  onClick,
}: {
  label: string;
  icon: LucideIcon;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-7 shrink-0 items-center justify-center rounded-sm text-muted transition-colors hover:bg-surface-hover hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
    >
      <Icon icon={icon} size="sm" />
    </button>
  );
}

/**
 * One day.
 *
 * The band and the chip are two layers on purpose. The band is the cell, and
 * it is square through the middle of a range so it runs unbroken from Monday
 * to Sunday and picks up again on the next row — the way an interval is marked
 * across a service chart, rather than as thirty separate blobs. The chip is
 * the button, and only the two endpoints wear one.
 */
function DayCell({
  day,
  column,
  preview,
  today,
  focused,
  disabled,
  onChoose,
  onHover,
}: {
  day: string | null;
  column: number;
  preview: Range;
  today: string;
  focused: string;
  disabled: boolean;
  onChoose: (day: string) => void;
  onHover: (day: string | null) => void;
}) {
  if (day === null) {
    return <td className="size-9" />;
  }

  const inRange = day >= preview.start && day <= preview.end;
  const isStart = day === preview.start;
  const isEnd = day === preview.end;
  const edge = isStart || isEnd;
  const isToday = day === today;

  return (
    <td
      role="gridcell"
      aria-selected={inRange}
      className={cn(
        "size-9 p-0",
        inRange && !disabled && "bg-accent-subtle",
        isStart && "rounded-l-md",
        isEnd && "rounded-r-md",
      )}
    >
      <button
        type="button"
        data-day={day}
        // Roving tabindex: one tab stop for the whole calendar, and the arrow
        // keys move it. Forty-two stops per month is not navigation.
        tabIndex={day === focused ? 0 : -1}
        disabled={disabled}
        aria-label={fullDayLabel(day)}
        aria-current={isToday ? "date" : undefined}
        onClick={() => onChoose(day)}
        onFocus={() => onHover(null)}
        onMouseEnter={() => onHover(day)}
        className={cn(
          "relative flex size-9 items-center justify-center rounded-md border border-transparent",
          "font-mono text-sm tabular-nums transition-colors",
          // The app's ring sits at a 2px offset, which on a gapless grid lands
          // on the neighbouring day. Here it hugs the chip instead — and the
          // accent bloom `.bg-accent:focus-visible` adds to a filled button is
          // dropped for the same reason.
          "focus-visible:shadow-none focus-visible:outline-offset-0",
          disabled && "cursor-not-allowed text-muted/50",
          !disabled &&
            (edge
              ? "border-accent-edge bg-accent font-medium text-accent-foreground"
              : inRange
                ? "text-foreground hover:bg-accent-subtle"
                : cn(
                    // Sunday is the quiet column: still legible, just not as
                    // loud as a trading day.
                    column === 6 ? "text-muted" : "text-foreground",
                    "hover:bg-surface-hover",
                  )),
        )}
      >
        {dayNumber(day)}
        {isToday ? (
          <span
            aria-hidden
            className={cn(
              "absolute bottom-1 size-1 rounded-full",
              edge && !disabled ? "bg-accent-foreground" : "bg-accent-strong",
            )}
          />
        ) : null}
      </button>
    </td>
  );
}
