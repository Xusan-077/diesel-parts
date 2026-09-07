import { formatDelta } from "@/lib/analytics/format";
import { cn } from "@/lib/utils";

export interface HeroStat {
  id: string;
  label: string;
  /** Pre-formatted figure — the component only sizes and sets it. */
  value: string;
  unit?: string;
  /** Period-over-period change as a fraction-of-100, or `null` when there is
      no previous window to compare against. */
  change?: number | null;
  /** "oldingi 30 kunga nisbatan" — printed after the delta. */
  comparisonLabel?: string;
  /** Shown in place of the delta when `change` is `null`. */
  noComparisonLabel?: string;
}

/**
 * The three figures the analytics screen exists to report — the period's
 * revenue, its order count, its average ticket — set as the page's headline
 * rather than as a row of cards.
 *
 * `type-figure` is a step above the shared type scale (see globals.css) and is
 * used nowhere else on this screen, so the first thing the eye lands on is the
 * period's money. The dynamics chart below answers "what shape"; this answers
 * "how much".
 *
 * Drawn as one hairline-ruled strip rather than three shadowed cards: depth on
 * this panel comes from borders, and a KPI a director reads every morning does
 * not need to float.
 */
export function HeroStats({ items }: { items: readonly HeroStat[] }) {
  return (
    <dl className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3">
      {items.map((item) => {
        const delta = formatDelta(item.change ?? null);
        const rising = (item.change ?? 0) > 0;
        const flat = item.change === 0;

        return (
          <div key={item.id} className="bg-surface px-5 py-5">
            <dt className="type-eyebrow text-muted">{item.label}</dt>
            <dd className="mt-2 flex flex-wrap items-baseline gap-x-2">
              <span className="type-figure text-foreground">{item.value}</span>
              {item.unit ? (
                <span className="type-caption text-muted">{item.unit}</span>
              ) : null}
            </dd>
            <p className="mt-2 type-caption text-muted">
              {delta ? (
                <span className="inline-flex flex-wrap items-baseline gap-x-2">
                  <span
                    className={cn(
                      "font-mono tabular-nums",
                      flat
                        ? "text-muted"
                        : rising
                          ? "text-success"
                          : "text-danger",
                    )}
                  >
                    <span aria-hidden="true">
                      {flat ? "→ " : rising ? "↑ " : "↓ "}
                    </span>
                    {delta}
                  </span>
                  {item.comparisonLabel ? <span>{item.comparisonLabel}</span> : null}
                </span>
              ) : (
                (item.noComparisonLabel ?? null)
              )}
            </p>
          </div>
        );
      })}
    </dl>
  );
}
