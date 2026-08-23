"use client";

import Link from "next/link";
import { Users } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/seller/ui/table";
import { TableSkeleton } from "@/components/seller/table-skeleton";
import { EmptyState } from "@/components/seller/empty-state";
import { PaginationBar } from "@/components/seller/pagination-bar";
import { QueryErrorState } from "@/components/seller/query-error-state";
import { formatMoney } from "@/lib/seller/format";
import type { Customer, PaginationMeta } from "@/lib/api/seller-panel/types";

const COLUMN_COUNT = 4;

export function CustomerTable({
  customers,
  meta,
  isLoading,
  isError,
  error,
  onRetry,
  onPageChange,
}: {
  customers: Customer[] | undefined;
  meta: PaginationMeta | undefined;
  isLoading: boolean;
  isError: boolean;
  error?: unknown;
  onRetry: () => void;
  onPageChange: (page: number) => void;
}) {
  if (isError) {
    return <QueryErrorState error={error} onRetry={onRetry} />;
  }

  if (!isLoading && customers && customers.length === 0) {
    return <EmptyState icon={Users} title="Mijozlar topilmadi" description="Qidiruvni o'zgartirib ko'ring." />;
  }

  return (
    <Table footer={meta ? <PaginationBar meta={meta} onPageChange={onPageChange} /> : null}>
      <TableHead>
        <TableRow>
          <TableHeaderCell>Ism</TableHeaderCell>
          <TableHeaderCell>Telefon</TableHeaderCell>
          <TableHeaderCell className="text-right">Qarzdorlik</TableHeaderCell>
          <TableHeaderCell />
        </TableRow>
      </TableHead>
      <TableBody>
        {isLoading || !customers
          ? <TableSkeleton rows={8} columns={COLUMN_COUNT} />
          : customers.map((customer) => (
              <TableRow key={customer.id}>
                <TableCell>{customer.name}</TableCell>
                <TableCell className="font-mono text-muted">{customer.phone}</TableCell>
                <TableCell className="text-right font-mono">{formatMoney(customer.debt)}</TableCell>
                <TableCell className="text-right">
                  <Link href={`/seller/customers/${customer.id}`} className="text-xs font-medium text-accent hover:underline">
                    Ko&apos;rish
                  </Link>
                </TableCell>
              </TableRow>
            ))}
      </TableBody>
    </Table>
  );
}
