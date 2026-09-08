import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { BackendApiError } from "@/lib/api/backend-client";
import { getGoodsReceipt, listWarehouses } from "@/lib/api/warehouse-repository";
import { safeRead } from "@/lib/api/safe-read";
import { PageHeader } from "@/components/admin/page-header";
import { GoodsReceiptForm } from "@/components/director/warehouse/goods-receipt-form";

export default async function EditGoodsReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let receipt;
  try {
    receipt = await getGoodsReceipt(id);
  } catch (error) {
    if (error instanceof BackendApiError && error.status === 404) {
      notFound();
    }
    throw error;
  }

  // Only a draft is editable — the backend enforces this too. Bounce an
  // approved or cancelled receipt back to its read-only page.
  if (receipt.status !== "DRAFT") {
    redirect(`/director/warehouse/incomes/${id}`);
  }

  const warehouses = await safeRead("warehouse list", () => listWarehouses(), []);

  return (
    <div>
      <Link
        href={`/director/warehouse/incomes/${id}`}
        className="type-label inline-flex items-center gap-1.5 text-muted transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        {receipt.receiptNumber}
      </Link>

      <div className="mt-3">
        <PageHeader
          eyebrow="Direktor paneli · Ombor"
          title={`${receipt.receiptNumber} — tahrirlash`}
          description="O'zgarishlar qoralamaga saqlanadi. Tasdiqlash alohida amal."
        />
      </div>

      <div className="mt-8">
        <GoodsReceiptForm warehouses={warehouses.data} receipt={receipt} />
      </div>
    </div>
  );
}
