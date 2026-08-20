import { listPendingDiscounts } from "@/lib/api/discount-repository";
import { DiscountQueue } from "@/components/admin/discount-queue";

export default async function DirectorDiscountsPage() {
  const requests = await listPendingDiscounts();

  return (
    <div>
      <p className="type-eyebrow text-muted">
        Direktor paneli
      </p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
        Chegirma so&apos;rovlari
      </h1>
      <p className="mt-1 max-w-prose text-sm text-muted">
        Sotuvchining limitidan yuqori chegirmalar shu yerda tasdiqlanadi. Tasdiqlangan
        foiz buyurtma summasiga darhol qo&apos;llanadi.
      </p>

      <DiscountQueue
        requests={requests.map((request) => ({
          ...request,
          createdAt: request.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
