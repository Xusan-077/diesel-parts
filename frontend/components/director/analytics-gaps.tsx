import type { ReactNode } from "react";
import { Info } from "lucide-react";
import { formatCompact } from "@/lib/analytics/format";
import { Icon } from "@/components/ui/icon";

/**
 * The honest footer of the analytics screen.
 *
 * Four sections were asked for that this screen does not draw, and saying so
 * here is the difference between a panel that is incomplete and one that looks
 * finished while quietly omitting the margin a director came to check. Each line
 * names what is missing and what it needs — the same list, in more detail, sits
 * at the foot of `analytics-detail-repository.ts`.
 *
 * Deliberately the quietest block on the page: no card, a recessed ground,
 * caption-sized type. It is a disclosure, not a section.
 */

const GAPS: readonly { title: string; need: ReactNode }[] = [
  {
    title: "Mahsulot rentabelligi (margin %)",
    need: (
      <>
        <code className="font-mono">Product.purchasePrice</code> va sotuv paytidagi{" "}
        <code className="font-mono">OrderItem.unitCost</code> kerak.
      </>
    ),
  },
  {
    title: "Yetkazib beruvchilar tahlili",
    need: (
      <>
        <code className="font-mono">Supplier</code> modeli,{" "}
        <code className="font-mono">Product.supplierId</code> va{" "}
        <code className="font-mono">SupplierPrice</code> narx tarixi kerak.
      </>
    ),
  },
  {
    title: "Qarzdorlik trendi",
    need: (
      <>
        To&apos;lovlar hisobi kerak —{" "}
        <code className="font-mono">Payment&#123; orderId, amount, paidAt &#125;</code>. Hozir har
        bir yopilgan buyurtma to&apos;liq to&apos;langan deb hisoblanadi.
      </>
    ),
  },
  {
    title: "Ombor qiymati trendi",
    need: (
      <>
        Davriy snapshot kerak —{" "}
        <code className="font-mono">InventorySnapshot&#123; takenAt, totalValue &#125;</code>.
        Tarixni keyin tiklab bo&apos;lmaydi, yozib borish kerak.
      </>
    ),
  },
];

export function AnalyticsGaps({ totalValue }: { totalValue: number }) {
  return (
    <section className="rounded-lg border border-border-subtle bg-background-subtle px-5 py-4">
      <div className="flex items-start gap-3">
        <Icon icon={Info} size="sm" className="mt-1 text-muted" />
        <div className="min-w-0 space-y-3">
          <div>
            <h2 className="type-label text-secondary">Hozircha hisoblab bo&apos;lmaydi</h2>
            <p className="type-caption text-muted">
              Quyidagilar uchun bazada ustun yetishmaydi — so&apos;rov emas.
            </p>
          </div>

          <ul className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
            {GAPS.map((gap) => (
              <li key={gap.title} className="type-caption text-muted">
                <span className="text-secondary">{gap.title}.</span> {gap.need}
              </li>
            ))}
          </ul>

          <p className="type-caption text-muted">
            Ombor qiymati katalog narxida hisoblangan:{" "}
            <span className="font-mono tabular-nums">
              {formatCompact(totalValue)} so&apos;m
            </span>
            . Tannarx saqlanmagani uchun bu chakana baho, aktiv qiymati emas.
          </p>
        </div>
      </div>
    </section>
  );
}
