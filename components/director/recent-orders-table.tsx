import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/shadcn/table";
import { OrderStatusBadge } from "./order-status-badge";
import type { OrderStatus } from "@/prisma/generated/prisma/enums";

export interface RecentOrderRow {
  id: string;
  customerName: string;
  orderNumber: string;
  sellerName: string;
  total: string;
  date: string;
  status: OrderStatus;
  statusLabel: string;
}

export function RecentOrdersTable({
  rows,
  columns,
}: {
  rows: readonly RecentOrderRow[];
  columns: { customer: string; total: string; date: string; status: string };
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{columns.customer}</TableHead>
          <TableHead className="text-right">{columns.total}</TableHead>
          <TableHead className="text-right">{columns.date}</TableHead>
          <TableHead className="text-right">{columns.status}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell>
              <div className="font-medium text-foreground">{row.customerName}</div>
              <div className="font-mono text-xs text-muted">
                {row.orderNumber} · {row.sellerName}
              </div>
            </TableCell>
            <TableCell className="text-right font-mono tabular-nums text-foreground">
              {row.total}
            </TableCell>
            <TableCell className="text-right text-muted">{row.date}</TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end">
                <OrderStatusBadge status={row.status} label={row.statusLabel} />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
