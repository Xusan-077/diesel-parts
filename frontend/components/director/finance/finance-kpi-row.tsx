import { ArrowDownCircle, ArrowUpCircle, Scale, Wallet } from "lucide-react";
import type { FinanceSummary } from "@/lib/api/finance-repository";
import { formatInteger } from "@/lib/analytics/format";
import { StatCard } from "@/components/director/stat-card";
import { NumberTicker } from "@/components/director/number-ticker";

/**
 * The four figures every finance tab is read against: money in, money out, the
 * difference, and what the shop is still owed.
 *
 * Colour follows the brief and the panel's status tokens — income `success`,
 * expense `danger`, debt `warning`. Net profit flips between `success` and
 * `danger` on its sign, because a loss is the one number here a director needs
 * to see is red without reading it.
 */
export function FinanceKpiRow({ summary }: { summary: FinanceSummary }) {
  const inProfit = summary.netProfit >= 0;

  return (
    <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="Jami tushum"
        value={<NumberTicker value={summary.totalIncome} format="sum" />}
        icon={ArrowUpCircle}
        tone="success"
        hint="Tugallangan to'lovlar"
      />
      <StatCard
        label="Jami xarajat"
        value={<NumberTicker value={summary.totalExpense} format="sum" />}
        icon={ArrowDownCircle}
        tone="danger"
        hint="Kiritilgan xarajatlar"
      />
      <StatCard
        label="Sof foyda"
        value={<NumberTicker value={summary.netProfit} format="sum" />}
        icon={Scale}
        tone={inProfit ? "success" : "danger"}
        hint="Tushum − xarajat"
      />
      <StatCard
        label="Jami qarzdorlik"
        value={<NumberTicker value={summary.totalDebt} format="sum" />}
        icon={Wallet}
        tone={summary.totalDebt > 0 ? "warning" : "neutral"}
        hint={`${formatInteger(summary.debtorCount)} ta qarzdor`}
      />
    </div>
  );
}
