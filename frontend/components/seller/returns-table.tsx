"use client";
import Link from "next/link";
import { Undo2 } from "lucide-react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/seller/ui/table";
import { Badge } from "@/components/seller/ui/badge";
import { TableSkeleton } from "@/components/seller/table-skeleton";
import { EmptyState } from "@/components/seller/empty-state";
import { PaginationBar } from "@/components/seller/pagination-bar";
import { QueryErrorState } from "@/components/seller/query-error-state";
import { formatDate, formatMoney } from "@/lib/seller/format";
import {
  RETURN_STATUS_LABEL,
  RETURN_STATUS_TONE,
} from "@/lib/seller/return-labels";
import type { PaginationMeta, Return } from "@/lib/api/seller-panel/types";
const columns: ColumnDef<Return>[] = [
  {
    accessorKey: "returnNumber",
    header: "Qaytarish ID",
    cell: ({ row }) => (
      <Link
        href={"/seller/returns/" + row.original.id}
        className="font-mono text-accent-strong hover:underline"
      >
        {row.original.returnNumber}
      </Link>
    ),
  },
  {
    accessorKey: "order.orderNumber",
    header: "Sotuv",
    cell: ({ row }) => (
      <Link
        href={"/seller/orders/" + row.original.order.id}
        className="font-mono hover:underline"
      >
        {row.original.order.orderNumber}
      </Link>
    ),
  },
  { accessorKey: "order.customer.name", header: "Mijoz" },
  { id: "items", header: "Mahsulotlar", accessorFn: (row) => row.items.length },
  {
    accessorKey: "refundAmount",
    header: "Qaytarish summasi",
    cell: ({ row }) => (
      <span className="font-mono whitespace-nowrap">
        {formatMoney(row.original.refundAmount)}
      </span>
    ),
  },
  {
    accessorKey: "status",
    header: "Holat",
    cell: ({ row }) => (
      <Badge tone={RETURN_STATUS_TONE[row.original.status]}>
        {RETURN_STATUS_LABEL[row.original.status]}
      </Badge>
    ),
  },
  {
    accessorKey: "createdAt",
    header: "Sana",
    cell: ({ row }) => formatDate(row.original.createdAt),
  },
];
const empty: Return[] = [];
export function ReturnsTable({
  returns,
  meta,
  isLoading,
  isError,
  error,
  onRetry,
  onPageChange,
}: {
  returns: Return[] | undefined;
  meta: PaginationMeta | undefined;
  isLoading: boolean;
  isError: boolean;
  error?: unknown;
  onRetry: () => void;
  onPageChange: (page: number) => void;
}) {
  "use no memo";
  // TanStack v8 manages its own row model; keep this boundary outside React Compiler.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: returns ?? empty,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: meta?.totalPages ?? 0,
  });
  if (isError) return <QueryErrorState error={error} onRetry={onRetry} />;
  if (!isLoading && returns?.length === 0)
    return (
      <EmptyState
        icon={Undo2}
        title="Qaytarishlar yo‘q"
        description="Qidiruv yoki filtrlarni o‘zgartiring, yoki yangi qaytarish yarating."
      />
    );
  return (
    <Table
      footer={
        meta ? <PaginationBar meta={meta} onPageChange={onPageChange} /> : null
      }
    >
      <TableHead>
        {table.getHeaderGroups().map((group) => (
          <TableRow key={group.id}>
            {group.headers.map((header) => (
              <TableHeaderCell key={header.id}>
                {flexRender(
                  header.column.columnDef.header,
                  header.getContext(),
                )}
              </TableHeaderCell>
            ))}
          </TableRow>
        ))}
      </TableHead>
      <TableBody>
        {isLoading || !returns ? (
          <TableSkeleton rows={8} columns={7} />
        ) : (
          table.getRowModel().rows.map((row) => (
            <TableRow key={row.original.id}>
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
