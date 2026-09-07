import type { LucideIcon } from "lucide-react";
import { formatDelta } from "@/lib/analytics/format";
import { Card, CardContent } from "@/components/ui/shadcn/card";
import { cn } from "@/lib/utils";

/**
 * Which semantic hue the icon disc wears. Each KPI on the dashboard gets
 * one — revenue reads green, order count blue, average-order-value
 * purple, pipeline amber — drawn from the CATEGORICAL DATA PALETTE in
 * globals.css so a future tile picks the same token rather than a fresh
 * inline colour. `neutral` is the quiet default for the lower queue
 * tiles, which are a count and not a headline figure.
 *
 * `warning` / `danger` are the status pair, for a tile whose figure is a
 * shortage a director acts on — "Kam qoldi", "Tugagan" on the warehouse
 * page — so the same count reads the same colour there as it does in the
 * analytics inventory panel. They resolve to `--warning` / `--danger`,
 * not to a repaintable accent: a critical status may not move with the
 * chrome. Everywhere else the brand red stays off these tiles — it is for
 * the nav, the logo and the primary buttons.
 */
export type StatTone =
  | "revenue"
  | "orders"
  | "average"
  | "pipeline"
  | "neutral"
  | "warning"
  | "danger";

const TONE: Record<StatTone, { disc: string; icon: string }> = {
  revenue: { disc: "bg-data-green-surface", icon: "text-data-green" },
  orders: { disc: "bg-data-blue-surface", icon: "text-data-blue" },
  average: { disc: "bg-data-purple-surface", icon: "text-data-purple" },
  pipeline: { disc: "bg-data-amber-surface", icon: "text-data-amber" },
  neutral: { disc: "bg-surface-muted", icon: "text-muted" },
  warning: { disc: "bg-warning-surface", icon: "text-warning" },
  danger: { disc: "bg-danger-surface", icon: "text-danger" },
};

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
  tone = "neutral",
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
  tone?: StatTone;
  noComparisonLabel?: string;
}) {
  const toneClasses = TONE[tone];
  const delta = change === undefined || change === null ? null : formatDelta(change);
  const rising = (change ?? 0) > 0;
  const flat = change === 0;
  const loud = emphasis === "loud";

  return (
    <Card className="h-full gap-0 py-5">
      <CardContent className="flex h-full flex-col px-5">
        <div className="flex items-start justify-between gap-3">
          {IconCmp ? (
            <span
              className={cn(
                "grid h-10 w-10 shrink-0 place-items-center rounded-full",
                toneClasses.disc,
              )}
            >
              <IconCmp aria-hidden="true" className={cn("size-4", toneClasses.icon)} />
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
