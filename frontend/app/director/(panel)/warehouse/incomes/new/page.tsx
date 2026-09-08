import Link from "next/link";
import { ArrowLeft, Warehouse } from "lucide-react";
import { listWarehouses } from "@/lib/api/warehouse-repository";
import { safeRead } from "@/lib/api/safe-read";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/director/empty-state";
import { Button } from "@/components/ui/shadcn/button";
import { GoodsReceiptForm } from "@/components/director/warehouse/goods-receipt-form";

export default async function NewGoodsReceiptPage() {
  const warehouses = await safeRead("warehouse list", () => listWarehouses(), []);
  const active = warehouses.data.filter((w) => w.status === "ACTIVE");

  return (
    <div>
      <Link
        href="/director/warehouse/incomes"
        className="type-label inline-flex items-center gap-1.5 text-muted transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        Qabullar
      </Link>

      <div className="mt-3">
        <PageHeader
          eyebrow="Direktor paneli · Ombor"
          title="Yangi qabul"
          description="Yetkazib beruvchidan kelgan mahsulotlarni omborga kiriting. Avval qoralama saqlanadi, keyin tasdiqlanadi."
        />
      </div>

      <div className="mt-8">
        {active.length === 0 ? (
          <div className="panel">
            <EmptyState
              icon={Warehouse}
              title="Avval ombor kerak"
              message="Qabul biror omborga bog'lanadi. Kamida bitta faol ombor qo'shing."
              action={
                <Button asChild>
                  <Link href="/director/warehouse/warehouses">Omborlar</Link>
                </Button>
              }
            />
          </div>
        ) : (
          <GoodsReceiptForm warehouses={warehouses.data} />
        )}
      </div>
    </div>
  );
}
