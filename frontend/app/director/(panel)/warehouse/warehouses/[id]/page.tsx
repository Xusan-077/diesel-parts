import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Boxes, PackageSearch, Wallet } from "lucide-react";
import { BackendApiError } from "@/lib/api/backend-client";
import { getWarehouse } from "@/lib/api/warehouse-repository";
import { formatDate } from "@/lib/warehouse/format";
import { PageHeader } from "@/components/admin/page-header";
import { NumberTicker } from "@/components/director/number-ticker";
import { Badge } from "@/components/ui/shadcn/badge";

export default async function WarehouseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let warehouse;
  try {
    warehouse = await getWarehouse(id);
  } catch (error) {
    if (error instanceof BackendApiError && error.status === 404) {
      notFound();
    }
    throw error;
  }

  const summary = [
    { label: "Turdagi mahsulot", value: warehouse.stockSummary.skuCount, format: "integer", icon: PackageSearch },
    { label: "Umumiy qoldiq", value: warehouse.stockSummary.totalQuantity, format: "integer", icon: Boxes },
    { label: "Qoldiq qiymati", value: warehouse.stockSummary.stockValue, format: "sum", icon: Wallet },
  ] as const;

  return (
    <div>
      <Link
        href="/director/warehouse/warehouses"
        className="type-label inline-flex items-center gap-1.5 text-muted transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        Omborlar
      </Link>

      <div className="mt-3">
        <PageHeader
          eyebrow={warehouse.code}
          title={
            <span className="flex flex-wrap items-center gap-3">
              {warehouse.name}
              {warehouse.status === "ACTIVE" ? (
                <Badge variant="success">Faol</Badge>
              ) : (
                <Badge variant="secondary">Faol emas</Badge>
              )}
            </span>
          }
          description={
            [
              warehouse.address || undefined,
              warehouse.managerName ? `Menejer: ${warehouse.managerName}` : undefined,
              `Ochilgan: ${formatDate(warehouse.createdAt)}`,
            ]
              .filter(Boolean)
              .join(" · ")
          }
          actions={
            <Link
              href={`/director/warehouse/products?warehouseId=${warehouse.id}`}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-sm text-foreground transition-colors hover:bg-surface-hover"
            >
              <PackageSearch className="size-3.5" aria-hidden="true" />
              Qoldiqlarni ko&apos;rish
            </Link>
          }
        />
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {summary.map((item) => (
          <div key={item.label} className="panel">
            <div className="flex items-center gap-2 text-muted">
              <item.icon className="size-4" aria-hidden="true" />
              <p className="type-eyebrow">{item.label}</p>
            </div>
            <p className="type-figure-sm mt-2 text-foreground">
              <NumberTicker value={item.value} format={item.format} />
            </p>
          </div>
        ))}
      </div>

      <p className="mt-6 text-sm text-muted">
        Ushbu ombor bo&apos;yicha kirim-chiqimlarni{" "}
        <Link
          href={`/director/warehouse/reports/movements?warehouseId=${warehouse.id}`}
          className="text-accent-strong hover:underline"
        >
          harakatlar hisobotida
        </Link>{" "}
        ko&apos;rish mumkin.
      </p>
    </div>
  );
}
