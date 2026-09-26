import { getStockReport } from "@/lib/api/warehouse-repository";
import { safeRead } from "@/lib/api/safe-read";
import { PageHeader } from "@/components/admin/page-header";
import { ReportsTabs } from "@/components/director/warehouse/reports-tabs";
import { StockReportView } from "@/components/director/warehouse/stock-report-view";

const EMPTY = { rows: [], totals: { skuCount: 0, onHand: 0, reserved: 0, stockValue: 0 } };

export default async function StockReportPage() {
  const report = await safeRead("warehouse stock report", () => getStockReport(), EMPTY);

  return (
    <div>
      <PageHeader
        eyebrow="Direktor paneli · Ombor hisobotlari"
        title="Qoldiqlar"
        description="Har bir ombordagi turdagi mahsulot soni, umumiy qoldiq va uning qiymati."
      />

      <div className="mt-6">
        <ReportsTabs />
      </div>

      <div className="mt-6">
        <StockReportView report={report.data} />
      </div>
    </div>
  );
}
