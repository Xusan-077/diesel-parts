import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { BackendApiError } from "@/lib/api/backend-client";
import { getWarehouseProduct, listProductMovements } from "@/lib/api/warehouse-repository";
import { safeRead } from "@/lib/api/safe-read";
import { formatSum } from "@/lib/analytics/format";
import { PageHeader } from "@/components/admin/page-header";
import { PanelCard } from "@/components/director/panel-card";
import { StockStatusBadge } from "@/components/director/stock-status-badge";
import { NumberTicker } from "@/components/director/number-ticker";
import { WarehouseBreakdownTable } from "@/components/director/warehouse/warehouse-breakdown-table";
import { ProductMovementHistory } from "@/components/director/warehouse/product-movement-history";

export default async function WarehouseProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let product;
  try {
    product = await getWarehouseProduct(id);
  } catch (error) {
    if (error instanceof BackendApiError && error.status === 404) {
      notFound();
    }
    throw error;
  }

  const movements = await safeRead(
    "warehouse product movements",
    () => listProductMovements(id, { page: 1 }),
    { items: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 1 } },
  );

  const summary = [
    { label: "Qoldiq", value: product.onHand },
    { label: "Zaxirada", value: product.reserved },
    { label: "Mavjud", value: product.available },
  ];

  return (
    <div>
      <Link
        href="/director/warehouse/products"
        className="type-label inline-flex items-center gap-1.5 text-muted transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        Mahsulotlar
      </Link>

      <div className="mt-3">
        <PageHeader
          eyebrow={product.sku}
          title={
            <span className="flex flex-wrap items-center gap-3">
              {product.name}
              <StockStatusBadge status={product.status} />
            </span>
          }
          description={
            [product.categoryName, product.brandName, product.barcode ?? undefined]
              .filter(Boolean)
              .join(" · ") || undefined
          }
          actions={
            <Link
              href={`/director/products?q=${encodeURIComponent(product.sku)}`}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-sm text-foreground transition-colors hover:bg-surface-hover"
            >
              <Pencil className="size-3.5" aria-hidden="true" />
              Katalogda tahrirlash
            </Link>
          }
        />
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summary.map((item) => (
          <div key={item.label} className="panel">
            <p className="type-eyebrow text-muted">{item.label}</p>
            <p className="type-figure-sm mt-1 text-foreground">
              <NumberTicker value={item.value} format="integer" />
              <span className="ml-1 type-caption text-muted">{product.unit}</span>
            </p>
          </div>
        ))}
        <div className="panel">
          <p className="type-eyebrow text-muted">Qoldiq qiymati</p>
          <p className="type-figure-sm mt-1 text-foreground">
            <NumberTicker value={product.stockValue} format="sum" />
          </p>
          <p className="type-caption mt-1 text-muted">
            {product.unitCost === null
              ? "Tannarx noma'lum"
              : `${formatSum(product.unitCost)} / ${product.unit}`}
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-6">
        <PanelCard
          title="Omborlar bo'yicha"
          description="Ushbu mahsulot qaysi omborlarda va qancha turibdi."
          bodyClassName="overflow-x-auto"
        >
          <WarehouseBreakdownTable rows={product.byWarehouse} />
        </PanelCard>

        <PanelCard
          title="Harakatlar tarixi"
          description="Ushbu mahsulotning barcha kirim-chiqimlari, eng yangisi tepada."
        >
          <ProductMovementHistory productId={id} initialData={movements.data} />
        </PanelCard>
      </div>
    </div>
  );
}
