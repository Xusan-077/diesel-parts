import Link from "next/link";
import { PERIOD_OPTIONS } from "@/lib/analytics/period";

/**
 * The window every figure on the dashboard is measured over.
 *
 * A segmented control, and the elevation system is what makes it read as one:
 * the track is recessed (`surface-muted`, level 0 inside a level-1 page) and
 * the selected segment is a raised chip sitting on it. The previous version put
 * an orange fill straight onto the page background with no track behind it, so
 * the two unselected options had nothing to be unselected *within* — they read
 * as three loose links, one of which happened to be orange.
 *
 * These are links and not buttons because the period is in the URL: a director
 * can bookmark the 90-day view, and the back button steps through the windows
 * they actually looked at.
 */
export function PeriodToggle({
  days,
  hrefFor,
  label,
  labels,
}: {
  days: number;
  hrefFor: (option: number) => string;
  /** The control's accessible name, from the panel dictionary. */
  label: string;
  /** Option text keyed by day count — "7 kun" / "7 дней" / "7 days". */
  labels: Record<string, string>;
}) {
  return (
    <nav
      aria-label={label}
      className="flex items-center gap-1 rounded-md border border-border bg-surface-muted p-1"
    >
      {PERIOD_OPTIONS.map((option) => {
        const active = option === days;

        return (
          <Link
            key={option}
            href={hrefFor(option)}
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
            {labels[String(option)] ?? option}
          </Link>
        );
      })}
    </nav>
  );
}
