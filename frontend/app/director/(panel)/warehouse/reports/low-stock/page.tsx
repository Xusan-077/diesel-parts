import { getLowStockReport } from "@/lib/api/warehouse-repository";
import { safeRead } from "@/lib/api/safe-read";
import { PageHeader } from "@/components/admin/page-header";
import { ReportsTabs } from "@/components/director/warehouse/reports-tabs";
import { LowStockReportView } from "@/components/director/warehouse/low-stock-report-view";

export default async function LowStockReportPage() {
  const report = await safeRead("warehouse low-stock report", () => getLowStockReport(), []);

  return (
    <div>
      <PageHeader
        eyebrow="Direktor paneli · Ombor hisobotlari"
        title="Kam qolganlar"
        description="Mavjud miqdori minimal qoldiqqa yetgan yoki undan past bo'lgan mahsulotlar, eng tanqisligi tepada."
      />

      <div className="mt-6">
        <ReportsTabs />
      </div>

      <div className="mt-6">
        <LowStockReportView rows={report.data} />
      </div>
    </div>
  );
}
