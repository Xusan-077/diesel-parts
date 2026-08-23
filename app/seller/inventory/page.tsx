"use client";

import { useState } from "react";
import { Boxes } from "lucide-react";
import { useInventory } from "@/hooks/seller/queries/use-inventory";
import { useWarehouses } from "@/hooks/seller/queries/use-catalog";
import { Select } from "@/components/seller/ui/select";
import { Badge } from "@/components/seller/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/seller/ui/table";
import { TableSkeleton } from "@/components/seller/table-skeleton";
import { EmptyState } from "@/components/seller/empty-state";
import { PaginationBar } from "@/components/seller/pagination-bar";
import { QueryErrorState } from "@/components/seller/query-error-state";
import { STOCK_STATUS_LABEL, STOCK_STATUS_TONE } from "@/lib/seller/stock-status-labels";
import type { StockStatus } from "@/lib/api/seller-panel/types";

const STOCK_OPTIONS: { value: StockStatus; label: string }[] = [
  { value: "IN_STOCK", label: "Mavjud" },
  { value: "LOW_STOCK", label: "Kam qoldi" },
  { value: "OUT_OF_STOCK", label: "Tugagan" },
];

export default function SellerInventoryPage() {
  const [warehouseId, setWarehouseId] = useState("");
  const [status, setStatus] = useState<StockStatus | "">("");
  const [page, setPage] = useState(1);

  const warehouses = useWarehouses();
  const query = { page, limit: 20, warehouseId: warehouseId || undefined, status: status || undefined };
  const { data, isLoading, isError, error, refetch } = useInventory(query);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-foreground">Ombor</h1>

      <div className="flex flex-wrap items-center gap-3">
        <Select
          className="w-auto min-w-48"
          placeholder="Barcha omborlar"
          value={warehouseId}
          onChange={(e) => {
            setWarehouseId(e.target.value);
            setPage(1);
          }}
          options={(warehouses.data ?? []).map((w) => ({ value: w.id, label: w.name }))}
        />
        <Select
          className="w-auto min-w-36"
          placeholder="Barcha holatlar"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as StockStatus | "");
            setPage(1);
          }}
          options={STOCK_OPTIONS}
        />
      </div>

      {isError ? (
        <QueryErrorState error={error} onRetry={() => refetch()} />
      ) : !isLoading && data && data.data.length === 0 ? (
        <EmptyState icon={Boxes} title="Ombor bo'sh" description="Bu filtrlarga mos yozuv topilmadi." />
      ) : (
        <Table footer={data ? <PaginationBar meta={data.meta} onPageChange={setPage} /> : null}>
          <TableHead>
            <TableRow>
              <TableHeaderCell>SKU</TableHeaderCell>
              <TableHeaderCell>Mahsulot</TableHeaderCell>
              <TableHeaderCell>Ombor</TableHeaderCell>
              <TableHeaderCell className="text-right">Jami</TableHeaderCell>
              <TableHeaderCell className="text-right">Band qilingan</TableHeaderCell>
              <TableHeaderCell className="text-right">Mavjud</TableHeaderCell>
              <TableHeaderCell>Holat</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading || !data
              ? <TableSkeleton rows={8} columns={7} />
              : data.data.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono">{row.product.sku}</TableCell>
                    <TableCell>{row.product.name}</TableCell>
                    <TableCell className="text-muted">{row.warehouse.name}</TableCell>
                    <TableCell className="text-right font-mono">{row.quantity}</TableCell>
                    <TableCell className="text-right font-mono">{row.reservedQuantity}</TableCell>
                    <TableCell className="text-right font-mono">{row.availableQuantity}</TableCell>
                    <TableCell>
                      <Badge tone={STOCK_STATUS_TONE[row.status]}>{STOCK_STATUS_LABEL[row.status]}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
