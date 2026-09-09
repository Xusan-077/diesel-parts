import { listFinanceDebts } from "@/lib/api/finance-repository";
import { safeRead } from "@/lib/api/safe-read";
import { financeDebtListQuerySchema } from "@/lib/schemas";
import { DebtsTable } from "@/components/director/finance/debts-table";

export default async function FinanceDebtsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const flat = Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]),
  );
  const parsed = financeDebtListQuerySchema.safeParse(flat);
  const query = parsed.success ? parsed.data : financeDebtListQuerySchema.parse({});

  const page = await safeRead("finance debts", () => listFinanceDebts(query), undefined);

  return (
    <div>
      <h2 className="type-title text-foreground">Qarzdorlik</h2>
      <p className="type-body mt-1 max-w-prose text-muted">
        Nasiyaga mahsulot olgan mijozlar — jami, to&apos;langan va qoldiq bo&apos;yicha.
      </p>
      <div className="mt-6">
        <DebtsTable query={query} initialData={page.data} />
      </div>
    </div>
  );
}
