export interface RankRow {
  id: string;
  label: string;
  value: number;
  meta: string;
}

/**
 * A ranked list with a proportional bar per row — the seller panel's take on
 * the director dashboard's SellerRankList. Plain `<div>` track rather than
 * shadcn Progress, which the seller panel does not ship. The bar carries the
 * data-green hue, the same "this is a quantity" colour used across both panels.
 */
export function RankList({
  rows,
  formatValue,
}: {
  rows: readonly RankRow[];
  formatValue: (value: number) => string;
}) {
  const max = Math.max(...rows.map((row) => row.value), 1);

  return (
    <ul className="flex flex-col gap-4">
      {rows.map((row, index) => (
        <li key={row.id} className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2 text-foreground">
              <span className="font-mono text-xs text-muted">{index + 1}</span>
              <span className="truncate">{row.label}</span>
            </span>
            <span className="shrink-0 font-mono tabular-nums text-foreground">
              {formatValue(row.value)}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-data-green-surface">
            <div
              className="h-full rounded-full bg-data-green"
              style={{ width: `${Math.max((row.value / max) * 100, 2)}%` }}
            />
          </div>
          <span className="type-caption text-muted">{row.meta}</span>
        </li>
      ))}
    </ul>
  );
}
