import { listWarehouses } from "@/lib/api/warehouse-repository";
import { safeRead } from "@/lib/api/safe-read";
import { PageHeader } from "@/components/admin/page-header";
import { WarehousesTable } from "@/components/director/warehouse/warehouses-table";

export default async function WarehousesPage() {
  const warehouses = await safeRead("warehouse list", () => listWarehouses(), []);

  return (
    <div>
      <PageHeader
        eyebrow="Direktor paneli · Ombor"
        title="Omborlar"
        description="Kompaniyaning barcha omborlari. Qabullar va qoldiqlar shu ro'yxatga bog'lanadi."
      />

      <div className="mt-8">
        <WarehousesTable initialData={warehouses.ok ? warehouses.data : undefined} />
      </div>
    </div>
  );
}
