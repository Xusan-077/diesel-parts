import { formatDelta } from "@/lib/analytics/format";

/**
 * One headline number. A single current value is a stat tile, not a one-bar
 * chart — see the data-viz form heuristic.
 *
 * It used to be drawn as a 2px rail down its left side. Two reasons that had
 * to go: the rail is now the form layer's own mark — `fieldRail` gives every
 * input the identical stroke, quiet at rest and orange on focus — so a KPI and
 * a text box wore the same badge; and a rail leaves the tile with no right-hand
 * edge, which is why the four across the top of the dashboard read as unevenly
 * spaced. Their gap was even at 24px all along; what differed was that each
 * tile's ink sat 16px right of its own rule and 24px left of the next one.
 *
 * A `panel` card fixes both: equal padding on all four sides, the grid gap as
 * the only separation, and `h-full` so a tile with a two-line hint does not
 * make its neighbour look clipped.
 *
 * The delta carries an arrow and an explicit sign as well as its colour, so the
 * direction survives colour-blindness and a monochrome print.
 */
export function StatTile({
  label,
  value,
  unit,
  change,
  comparisonLabel,
  hint,
}: {
  label: string;
  value: string;
  /**
   * The currency word, kept out of `value`.
   *
   * `formatSum` returns "1 897 471 900 so'm" as one string, and at four tiles
   * across that wraps — leaving "so'm" alone on a second line at the same size
   * and weight as the figure, where it reads for a beat as another number. The
   * unit is not data; it is small and muted, and it is the part allowed to
   * wrap.
   */
  unit?: string;
  change?: number | null;
  comparisonLabel?: string;
  hint?: string;
}) {
  const delta = change === undefined ? null : formatDelta(change);
  const rising = (change ?? 0) > 0;
  const flat = change === 0;

  return (
    <div className="panel flex h-full flex-col">
      <p className="type-eyebrow text-muted">{label}</p>
      <p className="mt-3 flex flex-wrap items-baseline gap-x-2">
        <span className="font-mono text-2xl font-semibold tabular-nums tracking-tight text-foreground">
          {value}
        </span>
        {unit ? <span className="type-caption text-muted">{unit}</span> : null}
      </p>

      {/* mt-auto pins the footnote to the card's bottom padding, so a row of
          tiles shares a baseline top and bottom however long each hint runs. */}
      {delta !== null ? (
        <p className="type-caption mt-auto flex flex-wrap items-baseline gap-x-2 pt-3">
          <span
            className={flat ? "text-muted" : rising ? "text-success" : "text-danger"}
          >
            <span aria-hidden="true">{flat ? "→" : rising ? "↑" : "↓"}</span> {delta}
          </span>
          {comparisonLabel ? <span className="text-muted">{comparisonLabel}</span> : null}
        </p>
      ) : (
        <p className="type-caption mt-auto pt-3 text-muted">
          {hint ?? "Taqqoslash uchun ma'lumot yo'q"}
        </p>
      )}
    </div>
  );
}
