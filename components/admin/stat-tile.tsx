import { formatDelta } from "@/lib/analytics/format";

/**
 * One headline number. A single current value is a stat tile, not a one-bar
 * chart — see the data-viz form heuristic.
 *
 * The delta carries an arrow and an explicit sign as well as its colour, so the
 * direction survives colour-blindness and a monochrome print.
 */
export function StatTile({
  label,
  value,
  change,
  comparisonLabel,
  hint,
}: {
  label: string;
  value: string;
  change?: number | null;
  comparisonLabel?: string;
  hint?: string;
}) {
  const delta = change === undefined ? null : formatDelta(change);
  const rising = (change ?? 0) > 0;
  const flat = change === 0;

  return (
    <div className="border-l-2 border-border pl-4">
      <p className="font-mono text-[0.6875rem] uppercase tracking-[0.15em] text-muted">
        {label}
      </p>
      <p className="mt-2 font-mono text-2xl font-semibold tabular-nums tracking-tight text-foreground">
        {value}
      </p>

      {delta !== null ? (
        <p className="mt-1.5 flex items-baseline gap-1.5 text-xs">
          <span
            className={
              flat ? "text-muted" : rising ? "text-success" : "text-danger"
            }
          >
            <span aria-hidden="true">{flat ? "→" : rising ? "↑" : "↓"}</span> {delta}
          </span>
          {comparisonLabel ? <span className="text-muted">{comparisonLabel}</span> : null}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-muted">{hint}</p>
      ) : (
        <p className="mt-1.5 text-xs text-muted">Taqqoslash uchun ma&apos;lumot yo&apos;q</p>
      )}
    </div>
  );
}
