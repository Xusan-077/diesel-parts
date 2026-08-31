import { listAudit, listAuditEntityTypes } from "@/lib/api/discount-repository";
import { safeRead } from "@/lib/api/safe-read";
import type { AuditListQuery } from "@/lib/schemas";
import { AuditLog } from "@/components/admin/audit-log";
import { PageHeader } from "@/components/admin/page-header";

export default async function DirectorAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[]; type?: string | string[] }>;
}) {
  const params = await searchParams;
  const first = (value: string | string[] | undefined) =>
    (Array.isArray(value) ? value[0] : value) ?? "";

  const page = Math.max(1, Number.parseInt(first(params.page), 10) || 1);
  const type = first(params.type);

  /*
   * The URL, parsed once, then used twice: as the argument to the read below
   * and as the trail's React Query key, so what was rendered and what is
   * cached cannot describe two different filters.
   */
  const query: AuditListQuery = { page, entityType: type || undefined };

  /*
   * Seeds the trail, which owns it from there. Every write elsewhere in the
   * panel invalidates this key, so a director reading the log sees a
   * colleague's edit land without reloading.
   */
  const result = await safeRead(
    "admin audit trail",
    async () => {
      const [audit, entityTypes] = await Promise.all([
        listAudit(page, type || undefined),
        listAuditEntityTypes(),
      ]);
      return {
        ...audit,
        // The wire form: JSON has no Date, so the seed has to be what a
        // refetch would return, not what the repository handed back.
        items: audit.items.map((entry) => ({
          ...entry,
          createdAt: entry.createdAt.toISOString(),
        })),
        entityTypes,
      };
    },
    undefined,
  );

  return (
    <div>
      <PageHeader
        eyebrow="Direktor paneli"
        title="Amallar tarixi"
        description="Kim nima qilgani."
      />

      <AuditLog query={query} initialData={result.data} />
    </div>
  );
}
