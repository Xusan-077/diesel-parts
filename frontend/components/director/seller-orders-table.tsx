import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/shadcn/table";
import { OrderStatusBadge } from "./order-status-badge";
import { formatSum } from "@/lib/analytics/format";
import type { OrderStatus } from "@/lib/api/backend-enums";

export interface SellerOrderRow {
  id: string;
  orderNumber: string;
  customerName: string;
  sellerName: string;
  itemCount: number;
  total: number;
  date: string;
  status: OrderStatus;
  statusLabel: string;
}

/**
 * The order list on `/admin/seller/orders`, drawn on the shared shadcn `Table`
 * so it reads the same as the director panel's other list screens (stock,
 * customers). Static on purpose: `listOrders` returns a row summary with no
 * line items, and `/admin/seller` has no order-detail route to link a row to —
 * the itemCount in the first cell is as deep as this view goes.
 *
 * `showSeller` is the one thing that differs by who is looking. A SELLER sees
 * only their own orders, so their own name on every row is noise; a director
 * sees the whole floor and needs to know whose order each one is.
 */
export function SellerOrdersTable({
  rows,
  showSeller,
}: {
  rows: readonly SellerOrderRow[];
  showSeller: boolean;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Buyurtma</TableHead>
          <TableHead>Mijoz</TableHead>
          {showSeller ? <TableHead>Sotuvchi</TableHead> : null}
          <TableHead className="text-right">Sana</TableHead>
          <TableHead className="text-right">Summa</TableHead>
          <TableHead className="text-right">Holat</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell>
              <div className="font-mono text-sm text-foreground">{row.orderNumber}</div>
              <div className="text-xs text-muted">{row.itemCount} qator</div>
            </TableCell>
            <TableCell className="text-foreground">{row.customerName}</TableCell>
            {showSeller ? (
              <TableCell className="text-muted">{row.sellerName}</TableCell>
            ) : null}
            <TableCell className="text-right text-muted">{row.date}</TableCell>
            <TableCell className="text-right font-mono tabular-nums text-foreground">
              {formatSum(row.total)}
            </TableCell>
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

/**
 * Page links for the order list. A hand copy of `StockPager`
 * (components/director/stock-table.tsx) rather than a shared import: the two
 * list screens keep their own table file, and 15 lines of `<Link>` is a
 * smaller cost than a `Pager` module that both have to agree on.
 */
export function SellerOrdersPager({
  page,
  totalPages,
  hrefFor,
}: {
  page: number;
  totalPages: number;
  hrefFor: (page: number) => string;
}) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <nav aria-label="Sahifalar" className="mt-6 flex items-center gap-3 text-sm">
      {page > 1 ? (
        <Link
          href={hrefFor(page - 1)}
          className="text-muted transition-colors hover:text-foreground"
        >
          ← Oldingi
        </Link>
      ) : null}
      <span className="font-mono text-xs text-muted">
        {page} / {totalPages}
      </span>
      {page < totalPages ? (
        <Link
          href={hrefFor(page + 1)}
          className="text-muted transition-colors hover:text-foreground"
        >
          Keyingi →
        </Link>
      ) : null}
    </nav>
  );
}
