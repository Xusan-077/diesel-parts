import { listMovementsReport } from "@/lib/api/warehouse-repository";
import { safeRead } from "@/lib/api/safe-read";
import { movementsReportQuerySchema } from "@/lib/schemas";
import { PageHeader } from "@/components/admin/page-header";
import { ReportsTabs } from "@/components/director/warehouse/reports-tabs";
import { MovementsReportView } from "@/components/director/warehouse/movements-report-view";

export default async function MovementsReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const flat = Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]),
  );
  const parsed = movementsReportQuerySchema.safeParse(flat);
  const query = parsed.success ? parsed.data : movementsReportQuerySchema.parse({});

  const page = await safeRead(
    "warehouse movements report",
    () => listMovementsReport(query),
    undefined,
  );

  return (
    <div>
      <PageHeader
        eyebrow="Direktor paneli · Ombor hisobotlari"
        title="Harakatlar"
        description="Omborlar bo'yicha butun kirim-chiqim tarixi. Ombor, tur va sana bo'yicha filtrlash mumkin."
      />

      <div className="mt-6">
        <ReportsTabs />
      </div>

      <div className="mt-6">
        <MovementsReportView query={query} initialData={page.data} />
      </div>
    </div>
  );
}
