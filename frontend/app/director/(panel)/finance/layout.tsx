import { getFinanceSummary, EMPTY_SUMMARY } from "@/lib/api/finance-repository";
import { safeRead } from "@/lib/api/safe-read";
import { PageHeader } from "@/components/admin/page-header";
import { FinanceKpiRow } from "@/components/director/finance/finance-kpi-row";
import { FinanceSubnav } from "@/components/director/finance/finance-subnav";
import { FinancePageTransition } from "@/components/director/finance/finance-page-transition";

/**
 * The finance module's frame: one shared page header, the always-visible KPI
 * row, then the tab strip and the tab's own content.
 *
 * The KPI read lives here rather than on each page so switching tabs does not
 * refetch it — a layout is not re-rendered on a child navigation. It is
 * all-time (no date window); each tab carries its own date filter for the
 * ledger below.
 *
 * The route guard is the panel layout above this one (`requireDirector`).
 * `backend/`'s finance endpoints are `DIRECTOR_UP`, which a director clears.
 */
export default async function FinanceLayout({ children }: { children: React.ReactNode }) {
  const summary = await safeRead("finance summary", () => getFinanceSummary({}), EMPTY_SUMMARY);

  return (
    <div>
      <PageHeader
        eyebrow="Direktor paneli"
        title="Moliya"
        description="To'lovlar, xarajatlar va qarzdorlik — bitta oynada."
      />

      {!summary.ok ? (
        <p className="mt-6 rounded-lg border border-border bg-warning-surface px-4 py-3 text-sm text-foreground">
          Moliya ma&apos;lumotlarini hozircha yuklab bo&apos;lmadi. Sahifani yangilab ko&apos;ring.
        </p>
      ) : null}

      <FinanceKpiRow summary={summary.data} />

      <div className="mt-8">
        <FinanceSubnav />
        <div className="mt-8">
          <FinancePageTransition>{children}</FinancePageTransition>
        </div>
      </div>
    </div>
  );
}
