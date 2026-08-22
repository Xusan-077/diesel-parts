import { listPendingDiscounts } from "@/lib/api/discount-repository";
import { safeRead } from "@/lib/api/safe-read";
import { PageHeader } from "@/components/admin/page-header";
import { DiscountQueue } from "@/components/admin/discount-queue";

export default async function DirectorDiscountsPage() {
  /*
   * Seeds the queue below, which owns it from there: a decision invalidates
   * that cache and the answered card leaves the list.
   */
  const requests = await safeRead("admin discount queue", listPendingDiscounts, undefined);

  return (
    <div>
      <PageHeader
        eyebrow="Direktor paneli"
        title="Chegirma so'rovlari"
        description="Sotuvchining limitidan yuqori chegirmalar shu yerda tasdiqlanadi. Tasdiqlangan foiz buyurtma summasiga darhol qo'llanadi."
      />

      <DiscountQueue
        initialData={requests.data?.map((request) => ({
          ...request,
          createdAt: request.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
