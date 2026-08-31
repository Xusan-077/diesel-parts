import type { LucideIcon } from "lucide-react";
import { formatDelta } from "@/lib/analytics/format";
import { Card, CardContent } from "@/components/ui/shadcn/card";
import { cn } from "@/lib/utils";

/**
 * The Dashboard's stat card: shadcn `Card` body, plus the change pill the
 * brief asks for as a `Badge` in spirit (its own pill classes rather than the
 * shadcn `Badge` component, since the up/down arrow has to live inside the
 * same coloured chip as the number — splitting them into an icon plus a
 * `Badge` reads as two controls instead of one reading).
 *
 * A trimmed `StatTile` (components/admin/stat-tile.tsx): same icon-disc /
 * change-pill / figure / label layout, minus the peak-hold gauge bar, which
 * the brief's "Stat cards: Card + Badge" does not ask for.
 */
export function StatCard({
  label,
  value,
  unit,
  change,
  comparisonLabel,
  hint,
  icon: IconCmp,
  emphasis = "loud",
  noComparisonLabel,
}: {
  label: string;
  value: string;
  unit?: string;
  change?: number | null;
  comparisonLabel?: string;
  hint?: string;
  icon?: LucideIcon;
  emphasis?: "loud" | "quiet";
  noComparisonLabel?: string;
}) {
  const delta = change === undefined || change === null ? null : formatDelta(change);
  const rising = (change ?? 0) > 0;
  const flat = change === 0;
  const loud = emphasis === "loud";

  return (
    <Card className="h-full gap-0 py-5">
      <CardContent className="flex h-full flex-col px-5">
        <div className="flex items-start justify-between gap-3">
          {IconCmp ? (
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-accent-edge bg-accent-subtle">
              <IconCmp aria-hidden="true" className="size-4 text-accent-strong" />
            </span>
          ) : (
            <span aria-hidden="true" />
          )}

          {delta !== null ? (
            <span
              className={cn(
                "inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2 font-mono text-xs font-medium tabular-nums",
                flat
                  ? "bg-surface-muted text-muted"
                  : rising
                    ? "bg-success-surface text-success"
                    : "bg-danger-surface text-danger",
              )}
            >
              <span aria-hidden="true">{flat ? "→" : rising ? "↑" : "↓"}</span>
              {delta}
            </span>
          ) : null}
        </div>

        <p className="mt-4 flex flex-wrap items-baseline gap-x-2">
          <span className={(loud ? "type-figure" : "type-figure-sm") + " text-foreground"}>
            {value}
          </span>
          {unit ? <span className="type-caption text-muted">{unit}</span> : null}
        </p>

        <p className="type-label mt-1 text-foreground">{label}</p>

        <p className="type-caption mt-auto pt-2 text-muted">
          {delta !== null && comparisonLabel ? comparisonLabel : (hint ?? noComparisonLabel ?? "")}
        </p>
      </CardContent>
    </Card>
  );
}
