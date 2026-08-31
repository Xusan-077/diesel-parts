import { Progress } from "@/components/ui/shadcn/progress";

export interface RankRow {
  id: string;
  label: string;
  value: number;
  meta: string;
}

/** A `RankBar` (components/admin/rank-bar.tsx) equivalent, on shadcn `Progress`. */
export function SellerRankList({
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
          <Progress value={(row.value / max) * 100} className="h-1.5" />
          <span className="type-caption text-muted">{row.meta}</span>
        </li>
      ))}
    </ul>
  );
}
