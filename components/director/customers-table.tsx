"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/shadcn/table";
import { Badge } from "@/components/ui/shadcn/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/shadcn/sheet";
import { formatInteger, formatSum } from "@/lib/analytics/format";
import type { CustomerRow } from "@/lib/api/customer-repository";

/**
 * The customer's status, derived from fields that are actually on the row.
 *
 * This app's `Customer` model carries no status column of its own (the brief
 * asked for one; the schema has `assignedSellerId` and an order count
 * instead), so the badge reads those: unclaimed, claimed with no orders yet,
 * or claimed with a sales history.
 */
function statusOf(row: CustomerRow): { label: string; variant: "secondary" | "warning" | "success" } {
  if (row.assignedSellerId === null) {
    return { label: "Egasiz", variant: "secondary" };
  }
  if (row.orderCount === 0) {
    return { label: "Yangi", variant: "warning" };
  }
  return { label: "Faol", variant: "success" };
}

export function CustomersTable({ rows }: { rows: readonly CustomerRow[] }) {
  const [selected, setSelected] = useState<CustomerRow | null>(null);

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Ism</TableHead>
            <TableHead className="text-right">Buyurtmalar</TableHead>
            <TableHead className="text-right">Xarid summasi</TableHead>
            <TableHead className="text-right">Holat</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const status = statusOf(row);
            return (
              <TableRow
                key={row.id}
                className="cursor-pointer"
                onClick={() => setSelected(row)}
              >
                <TableCell>
                  <div className="font-medium text-foreground">{row.name}</div>
                  <div className="font-mono text-xs text-muted">{row.phone}</div>
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums text-foreground">
                  {formatInteger(row.orderCount)}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums text-foreground">
                  {formatSum(row.totalSpent)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end">
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <Sheet open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent>
          {selected ? (
            <>
              <SheetHeader>
                <SheetTitle>{selected.name}</SheetTitle>
                <SheetDescription>{selected.company ?? "Kompaniyasiz mijoz"}</SheetDescription>
              </SheetHeader>
              <div className="flex flex-col gap-4 px-4 pb-4 text-sm">
                <DetailRow label="Telefon" value={selected.phone} mono />
                <DetailRow label="Email" value={selected.email ?? "—"} />
                <DetailRow label="Mas'ul sotuvchi" value={selected.assignedSellerName ?? "Egasiz"} />
                <DetailRow label="Buyurtmalar soni" value={formatInteger(selected.orderCount)} />
                <DetailRow label="Jami xarid" value={formatSum(selected.totalSpent)} />
                {selected.notes ? <DetailRow label="Izoh" value={selected.notes} /> : null}
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}

function DetailRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-1 border-b border-border pb-3 last:border-0">
      <span className="type-eyebrow text-muted">{label}</span>
      <span className={"text-foreground " + (mono ? "font-mono" : "")}>{value}</span>
    </div>
  );
}
