import { listPendingDiscounts } from "@/lib/api/discount-repository";
import { PageHeader } from "@/components/admin/page-header";
import { DiscountQueue } from "@/components/admin/discount-queue";

export default async function DirectorDiscountsPage() {
  const requests = await listPendingDiscounts();

  return (
    <div>
      <PageHeader
        eyebrow="Direktor paneli"
        title="Chegirma so'rovlari"
        description="Sotuvchining limitidan yuqori chegirmalar shu yerda tasdiqlanadi. Tasdiqlangan foiz buyurtma summasiga darhol qo'llanadi."
      />

      <DiscountQueue
        requests={requests.map((request) => ({
          ...request,
          createdAt: request.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
