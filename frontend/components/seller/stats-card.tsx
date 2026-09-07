import type { LucideIcon } from "lucide-react";
import { formatPercent } from "@/lib/seller/format";
import { cn } from "@/lib/utils";

/**
 * Which semantic hue the icon disc wears. Drawn from the categorical data
 * palette in seller-globals.css — the same tokens, in the same roles, as the
 * director dashboard's StatCard: sales green, order count blue, a pending
 * count amber, new customers purple. `neutral` is the quiet default.
 */
export type StatTone = "sales" | "orders" | "pending" | "customers" | "neutral";

const TONE: Record<StatTone, { disc: string; icon: string }> = {
  sales: { disc: "bg-data-green-surface", icon: "text-data-green" },
  orders: { disc: "bg-data-blue-surface", icon: "text-data-blue" },
  pending: { disc: "bg-data-amber-surface", icon: "text-data-amber" },
  customers: { disc: "bg-data-purple-surface", icon: "text-data-purple" },
  neutral: { disc: "bg-surface-muted", icon: "text-muted" },
};

/**
 * The seller dashboard's stat card, on the `panel` recipe. Icon disc, a change
 * pill carrying its own arrow, then the figure and its label — the same
 * reading order and the same `type-figure` step as the director panel.
 */
export function StatsCard({
  icon: Icon,
  label,
  value,
  changePercent,
  tone = "neutral",
  hint,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  changePercent?: number;
  tone?: StatTone;
  hint?: string;
}) {
  const toneClasses = TONE[tone];
  const hasChange = changePercent !== undefined;
  const rising = (changePercent ?? 0) > 0;
  const flat = changePercent === 0;

  return (
    <div className="panel flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <span
          className={cn(
            "grid h-10 w-10 shrink-0 place-items-center rounded-full",
            toneClasses.disc,
          )}
        >
          <Icon aria-hidden="true" className={cn("size-4", toneClasses.icon)} />
        </span>

        {hasChange ? (
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
            {formatPercent(changePercent as number)}
          </span>
        ) : null}
      </div>

      <div>
        <p className="type-figure text-foreground">{value}</p>
        <p className="type-label mt-1 text-foreground">{label}</p>
        <p className="type-caption mt-2 text-muted">
          {hasChange ? "kechagi kunga nisbatan" : (hint ?? "")}
        </p>
      </div>
    </div>
  );
}
