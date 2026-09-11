"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/seller/page-header";
import { QueryErrorState } from "@/components/seller/query-error-state";
import { Button } from "@/components/seller/ui/button";
import { Badge } from "@/components/seller/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/shadcn/card";
import { Skeleton } from "@/components/ui/shadcn/skeleton";
import {
  Table,
  TableHead,
  TableHeaderCell,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/seller/ui/table";
import { OpenShiftDialog } from "@/components/seller/cashier/open-shift-dialog";
import { useCurrentShift } from "@/hooks/seller/queries/use-current-shift";
import { useShiftHistory } from "@/hooks/seller/queries/use-shift-history";
import { formatDateTime, formatMoney } from "@/lib/seller/format";

export default function CashierPage() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const current = useCurrentShift();
  const history = useShiftHistory(10);
  const shift = current.data;
  return (
    <div className="space-y-6">
      <PageHeader title="Kassa" description="Joriy smena va naqd pul hisobi." />
      {current.isError ? (
        <QueryErrorState
          error={current.error}
          onRetry={() => void current.refetch()}
        />
      ) : current.isLoading ? (
        <Skeleton className="h-48 bg-surface-muted" />
      ) : (
        <Card className="border-border bg-surface text-foreground shadow-none">
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center justify-between gap-3">
              Joriy smena{" "}
              <Badge tone={shift ? "success" : "neutral"}>
                {shift ? "Ochiq" : "Yopiq"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {shift ? (
              <>
                <p className="text-sm text-muted">
                  Ochilgan: {formatDateTime(shift.openedAt)}
                </p>
                <dl className="grid grid-cols-2 gap-6 lg:grid-cols-4">
                  {[
                    ["Boshlang‘ich qoldiq", shift.openingBalance],
                    ["Naqd sotuvlar", shift.cashSales],
                    ["Naqd qaytarishlar", shift.cashRefunds],
                    ["Kutilgan qoldiq", shift.expectedBalance],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-xs text-muted">{label}</dt>
                      <dd className="mt-2 font-mono text-lg font-semibold break-words">
                        {formatMoney(value)}
                      </dd>
                    </div>
                  ))}
                </dl>
                <Button onClick={() => router.push("/seller/cashier/shift")}>
                  Smenani yopish
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm text-muted">
                  Ochiq smena yo‘q. Ishni boshlash uchun kassadagi naqd pulni
                  kiriting.
                </p>
                <Button onClick={() => setOpen(true)}>Smenani ochish</Button>
              </>
            )}
          </CardContent>
        </Card>
      )}
      <section className="space-y-3">
        <h2 className="type-title">Oxirgi 10 ta smena</h2>
        {history.isError ? (
          <QueryErrorState
            error={history.error}
            onRetry={() => void history.refetch()}
          />
        ) : history.isLoading ? (
          <Skeleton className="h-48 bg-surface-muted" />
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                {["Sana", "Boshlang‘ich", "Yakuniy", "Farq"].map((label) => (
                  <TableHeaderCell key={label}>{label}</TableHeaderCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {!history.data?.length ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="py-10 text-center text-muted"
                  >
                    Yopilgan smenalar yo‘q.
                  </TableCell>
                </TableRow>
              ) : (
                history.data.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      {formatDateTime(row.closedAt ?? row.openedAt)}
                    </TableCell>
                    <TableCell className="font-mono">
                      {formatMoney(row.openingBalance)}
                    </TableCell>
                    <TableCell className="font-mono">
                      {formatMoney(row.closingBalanceActual ?? 0)}
                    </TableCell>
                    <TableCell
                      className={
                        Number(row.difference) < 0
                          ? "font-mono text-danger"
                          : "font-mono text-success"
                      }
                    >
                      {formatMoney(row.difference ?? 0)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </section>
      <OpenShiftDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}
