import { formatCompact, formatSum } from "@/lib/analytics/format";

export interface RankRow {
  id: string;
  label: string;
  value: number;
  /** Small second figure shown beside the label, e.g. an order count. */
  meta?: string;
}

/**
 * Magnitude, low to high — a bar chart in one hue, not a categorical palette.
 * Colour here carries no identity: the rows are already named, so a second hue
 * would only add noise.
 *
 * The position numerals are the one place in the panel where numbering is
 * honest. A rank *is* an order, and "who is second" is a question this block
 * exists to answer; the same numerals down the side of a list of settings or a
 * set of cards would be decoration wearing a structure's clothes.
 *
 * Every bar is directly labelled, which is also the relief the contrast rule
 * asks for on a light surface.
 */
export function RankBar({ rows, emptyMessage }: { rows: RankRow[]; emptyMessage: string }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted">{emptyMessage}</p>;
  }

  const max = Math.max(...rows.map((row) => row.value), 1);

  return (
    <ol className="flex flex-col gap-4">
      {rows.map((row, index) => (
        <li key={row.id} className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="mt-1 w-4 shrink-0 text-right font-mono text-xs tabular-nums text-muted opacity-60"
          >
            {index + 1}
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-4">
              <span className="truncate text-sm text-foreground">
                {row.label}
                {row.meta ? <span className="ml-2 text-xs text-muted">{row.meta}</span> : null}
              </span>
              <span
                className="shrink-0 font-mono text-xs font-medium tabular-nums text-foreground"
                title={formatSum(row.value)}
              >
                {formatCompact(row.value)}
              </span>
            </div>

            {/* 6px, not 8: the track is a mark beside a name, and at the old
                height it was competing with the name for the row. */}
            <div
              className="mt-2 h-1.5 w-full overflow-hidden rounded-xs"
              style={{ backgroundColor: "var(--gauge-track)" }}
            >
              <div
                className="h-full rounded-xs bg-chart-series"
                style={{ width: Math.max(2, (row.value / max) * 100) + "%" }}
              />
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
