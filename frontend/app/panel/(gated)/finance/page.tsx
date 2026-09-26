import { listFinancePayments } from "@/lib/api/finance-repository";
import { safeRead } from "@/lib/api/safe-read";
import { financePaymentListQuerySchema } from "@/lib/schemas";
import { PaymentsTable } from "@/components/director/finance/payments-table";

export default async function FinancePaymentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const flat = Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]),
  );
  const parsed = financePaymentListQuerySchema.safeParse(flat);
  const query = parsed.success ? parsed.data : financePaymentListQuerySchema.parse({});

  const page = await safeRead("finance payments", () => listFinancePayments(query), undefined);

  return (
    <div>
      <h2 className="type-title text-foreground">To&apos;lovlar</h2>
      <p className="type-body mt-1 max-w-prose text-muted">
        Mijozlardan kelib tushgan tugallangan to&apos;lovlar — kirim.
      </p>
      <div className="mt-6">
        <PaymentsTable query={query} initialData={page.data} />
      </div>
    </div>
  );
}
