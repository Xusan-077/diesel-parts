import Link from "next/link";
import { ArrowLeft, Warehouse } from "lucide-react";
import { listWarehouses } from "@/lib/api/warehouse-repository";
import { safeRead } from "@/lib/api/safe-read";
import { requirePermission } from "@/lib/auth/dal";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/director/empty-state";
import { Button } from "@/components/ui/shadcn/button";
import { GoodsReceiptForm } from "@/components/director/warehouse/goods-receipt-form";

export default async function NewGoodsReceiptPage() {
  // Not just warehouse:read — this is the create form itself, and creating
  // a goods receipt is director-only (warehouse:update) even though reading
  // the list is both-roles. The listing page hides the link that gets here
  // for a SELLER; this is the hard gate behind it.
  await requirePermission("warehouse:update");
  const warehouses = await safeRead("warehouse list", () => listWarehouses(), []);
  const active = warehouses.data.filter((w) => w.status === "ACTIVE");

  return (
    <div>
      <Link
        href="/panel/warehouse/incomes"
        className="type-label inline-flex items-center gap-1 text-muted transition-colors hover:text-foreground"
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
                  <Link href="/panel/warehouse/warehouses">Omborlar</Link>
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
