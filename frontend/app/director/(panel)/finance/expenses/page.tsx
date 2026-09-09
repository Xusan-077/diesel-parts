import { listFinanceExpenses } from "@/lib/api/finance-repository";
import { safeRead } from "@/lib/api/safe-read";
import { financeExpenseListQuerySchema } from "@/lib/schemas";
import { ExpensesTable } from "@/components/director/finance/expenses-table";

export default async function FinanceExpensesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const flat = Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]),
  );
  const parsed = financeExpenseListQuerySchema.safeParse(flat);
  const query = parsed.success ? parsed.data : financeExpenseListQuerySchema.parse({});

  const page = await safeRead("finance expenses", () => listFinanceExpenses(query), undefined);

  return (
    <div>
      <h2 className="type-title text-foreground">Xarajatlar</h2>
      <p className="type-body mt-1 max-w-prose text-muted">
        Ijara, oylik, kommunal va boshqa chiqimlar — qo&apos;lda yuritiladi.
      </p>
      <div className="mt-6">
        <ExpensesTable query={query} initialData={page.data} />
      </div>
    </div>
  );
}
