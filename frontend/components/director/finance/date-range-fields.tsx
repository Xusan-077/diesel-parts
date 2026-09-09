"use client";

import { FilterField } from "@/components/director/filter-bar";
import { Input } from "@/components/ui/shadcn/input";

/**
 * The "from / to" day pair the payments and expenses ledgers filter on. Both
 * are `YYYY-MM-DD` (native `<input type="date">`), written straight to the URL
 * on change — a director sending someone "sentyabr xarajatlari" is sending
 * that exact window.
 */
export function DateRangeFields({
  from,
  to,
  onChange,
}: {
  from: string | undefined;
  to: string | undefined;
  onChange: (next: { dateFrom?: string; dateTo?: string }) => void;
}) {
  return (
    <>
      <FilterField label="Sanadan">
        <Input
          type="date"
          value={from ?? ""}
          onChange={(event) => onChange({ dateFrom: event.target.value || undefined })}
          className="h-9 w-40"
          aria-label="Boshlanish sanasi"
        />
      </FilterField>
      <FilterField label="Sanagacha">
        <Input
          type="date"
          value={to ?? ""}
          onChange={(event) => onChange({ dateTo: event.target.value || undefined })}
          className="h-9 w-40"
          aria-label="Tugash sanasi"
        />
      </FilterField>
    </>
  );
}
