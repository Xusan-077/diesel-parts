import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { BackendApiError } from "@/lib/api/backend-client";
import { getGoodsReceipt } from "@/lib/api/warehouse-repository";
import { GoodsReceiptDetail } from "@/components/director/warehouse/goods-receipt-detail";

export default async function GoodsReceiptDetailPage({
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

  return (
    <div>
      <Link
        href="/director/warehouse/incomes"
        className="type-label inline-flex items-center gap-1.5 text-muted transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        Qabullar
      </Link>

      <div className="mt-4">
        <GoodsReceiptDetail id={id} initialData={receipt} />
      </div>
    </div>
  );
}
