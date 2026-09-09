import { listGoodsReceipts } from "@/lib/api/warehouse-repository";
import { safeRead } from "@/lib/api/safe-read";
import { goodsReceiptListQuerySchema } from "@/lib/schemas";
import { PageHeader } from "@/components/admin/page-header";
import { GoodsReceiptsTable } from "@/components/director/warehouse/goods-receipts-table";

export default async function GoodsReceiptsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const flat = Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]),
  );
  const parsed = goodsReceiptListQuerySchema.safeParse(flat);
  const query = parsed.success ? parsed.data : goodsReceiptListQuerySchema.parse({});

  const page = await safeRead(
    "goods receipt list",
    () => listGoodsReceipts(query),
    undefined,
  );

  return (
    <div>
      <PageHeader
        eyebrow="Direktor paneli · Ombor"
        title="Qabullar"
        description="Yetkazib beruvchilardan kelgan mahsulotlarning omborga kirimi. Tasdiqlangan qabul qoldiqni oshiradi."
      />

      <div className="mt-8">
        <GoodsReceiptsTable query={query} initialData={page.data} />
      </div>
    </div>
  );
}
