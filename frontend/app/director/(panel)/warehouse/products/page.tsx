import { listWarehouseProducts, listWarehouses } from "@/lib/api/warehouse-repository";
import { safeRead } from "@/lib/api/safe-read";
import { warehouseProductListQuerySchema } from "@/lib/schemas";
import { PageHeader } from "@/components/admin/page-header";
import { WarehouseProductsFilter } from "@/components/director/warehouse/warehouse-products-filter";
import { WarehouseProductsTable } from "@/components/director/warehouse/warehouse-products-table";

export default async function WarehouseProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const flat = Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]),
  );
  const parsed = warehouseProductListQuerySchema.safeParse(flat);
  const query = parsed.success
    ? parsed.data
    : warehouseProductListQuerySchema.parse({});

  const [page, warehouses] = await Promise.all([
    safeRead("warehouse product list", () => listWarehouseProducts(query), undefined),
    safeRead("warehouse list", () => listWarehouses(), []),
  ]);

  const scoped = query.warehouseId
    ? (warehouses.data.find((w) => w.id === query.warehouseId) ?? null)
    : null;

  return (
    <div>
      <PageHeader
        eyebrow="Direktor paneli · Ombor"
        title="Mahsulotlar"
        description="Katalogdagi har bir mahsulot, qoldig'i va tannarxi bilan. Tahrirlash — Mahsulotlar bo'limida."
      />

      <div className="mt-8">
        <WarehouseProductsFilter query={query} />
      </div>

      <div className="mt-4">
        <WarehouseProductsTable
          query={query}
          initialData={page.data}
          scopedLabel={scoped ? `${scoped.code} · ${scoped.name}` : null}
        />
      </div>
    </div>
  );
}
