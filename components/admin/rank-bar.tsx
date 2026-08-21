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
 * Every bar is directly labelled, which is also the relief the contrast rule
 * asks for on a light surface.
 */
export function RankBar({ rows, emptyMessage }: { rows: RankRow[]; emptyMessage: string }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted">{emptyMessage}</p>;
  }

  const max = Math.max(...rows.map((row) => row.value), 1);

  return (
    <ul className="flex flex-col gap-3">
      {rows.map((row) => (
        <li key={row.id}>
          <div className="flex items-baseline justify-between gap-4">
            <span className="truncate text-sm text-foreground">
              {row.label}
              {row.meta ? <span className="ml-2 text-xs text-muted">{row.meta}</span> : null}
            </span>
            <span
              className="shrink-0 font-mono text-xs tabular-nums text-foreground"
              title={formatSum(row.value)}
            >
              {formatCompact(row.value)}
            </span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-sm bg-surface-muted">
            <div
              className="h-full rounded-sm bg-chart-series"
              style={{ width: Math.max(2, (row.value / max) * 100) + "%" }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
