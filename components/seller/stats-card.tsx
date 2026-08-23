import type { LucideIcon } from "lucide-react";
import { formatPercent } from "@/lib/seller/format";
import { cn } from "@/lib/utils";

export function StatsCard({
  icon: Icon,
  label,
  value,
  changePercent,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  changePercent?: number;
}) {
  return (
    <div className="rounded-md border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <p className="seller-eyebrow">{label}</p>
        <Icon className="h-4 w-4 text-muted" />
      </div>
      <p className="mt-2 font-mono text-2xl font-semibold text-foreground">{value}</p>
      {changePercent !== undefined ? (
        <p className={cn("mt-1 text-xs font-medium", changePercent >= 0 ? "text-success" : "text-danger")}>
          {formatPercent(changePercent)} kechagi kunga nisbatan
        </p>
      ) : null}
    </div>
  );
}
