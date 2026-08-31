"use client";

import Link from "next/link";
import { useAdminCustomers } from "@/hooks/admin/use-admin-customers";
import type { CustomerListResult } from "@/lib/api/admin/resources";
import { requestErrorMessage } from "@/lib/api/request-error";
import { formatArrival } from "@/lib/admin/inquiry-board-state";
import { formatInteger } from "@/lib/analytics/format";
import type { CustomerListQuery } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { CustomerBookEmpty } from "./customer-book-empty";

export interface CustomerBookProps {
  /** The URL state this list was resolved from; also its cache key. */
  query: CustomerListQuery;
  /** The page as the server read it, or `undefined` when that read failed. */
  initialData?: CustomerListResult;
  /** Directors read this list across the whole team and need the owner column. */
  showOwner: boolean;
}

/**
 * The customer table, its count and its pager.
 *
 * All three are derived from one query, so adding a customer or claiming one
 * out of the pool cannot leave a total that disagrees with the rows under it.
 * The search box and the two tabs above it stay server-rendered URL state — a
 * seller's list is something they send to a colleague.
 */
export function CustomerBook({ query, initialData, showOwner }: CustomerBookProps) {
  const list = useAdminCustomers(query, initialData);

  const href = (page: number) => {
    const params = new URLSearchParams();
    if (query.search) params.set("q", query.search);
    if (query.pool) params.set("pool", "1");
    if (page > 1) params.set("page", String(page));
    const search = params.toString();
    return "/admin/seller/customers" + (search ? "?" + search : "");
  };

  if (list.isPending) {
    return (
      <div aria-busy="true" className="mt-8">
        <span className="sr-only">Yuklanmoqda...</span>
        <div aria-hidden="true" className="flex flex-col gap-2">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="h-11 animate-pulse rounded-md bg-surface-muted" />
          ))}
        </div>
      </div>
    );
  }

  if (list.isError) {
    return (
      <div className="mt-8">
        <p className="text-sm text-foreground">
          {requestErrorMessage(list.error, "Mijozlar ro'yxati yuklanmadi.")}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => void list.refetch()}
        >
          Qayta urinish
        </Button>
      </div>
    );
  }

  const result = list.data;
  /*
   * "Nothing here" and "nothing matched" are different answers and get
   * different screens: the illustrated empty state belongs to a seller whose
   * book has not started, not to one whose search was too narrow.
   */
  const searching = (query.search ?? "") !== "";
  const showIllustration = result.total === 0 && !searching && !query.pool;

  return (
    <>
      <p className="mt-6 font-mono text-xs tabular-nums text-muted">
        {query.pool
          ? formatInteger(result.total) + " ta egasiz mijoz"
          : formatInteger(result.total) + " ta mijoz kitobingizda"}
      </p>

      {showIllustration ? (
        <div className="mt-8">
          <CustomerBookEmpty />
        </div>
      ) : result.items.length === 0 ? (
        <p className="mt-8 text-sm text-muted">
          {searching
            ? "Bu so'rov bo'yicha mijoz topilmadi. Raqamni boshqacha yozib ko'ring."
            : "Hozircha egasiz mijoz yo'q."}
        </p>
      ) : (
        <div className="mt-8 overflow-x-auto">
          <table className="w-full min-w-3xl text-left text-sm">
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className="pb-2 font-medium text-muted">
                  Mijoz
                </th>
                <th scope="col" className="pb-2 font-medium text-muted">
                  Telefon
                </th>
                <th scope="col" className="pb-2 font-medium text-muted">
                  Kompaniya
                </th>
                <th scope="col" className="pb-2 text-right font-medium text-muted">
                  Buyurtma
                </th>
                <th scope="col" className="pb-2 text-right font-medium text-muted">
                  Oxirgi o&apos;zgarish
                </th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((customer) => (
                <tr key={customer.id} className="border-b border-border last:border-0">
                  <td className="py-3 pr-3">
                    <Link
                      href={"/admin/seller/customers/" + customer.id}
                      className="text-foreground transition-colors hover:text-accent-strong"
                    >
                      {customer.name}
                    </Link>
                    {/* A director reads this list across the whole team, so the
                        owner is what tells them whose row they are looking at.
                        A seller's own book is all theirs and needs no column. */}
                    {showOwner && customer.assignedSellerName !== null ? (
                      <span className="ml-2 text-xs text-muted">
                        {customer.assignedSellerName}
                      </span>
                    ) : null}
                  </td>
                  <td className="py-3 pr-3 font-mono text-xs tabular-nums text-muted">
                    {customer.phone}
                  </td>
                  <td className="py-3 pr-3 text-muted">{customer.company ?? "—"}</td>
                  <td className="py-3 pl-3 text-right font-mono tabular-nums text-foreground">
                    {formatInteger(customer.orderCount)}
                  </td>
                  {/* Parsed here: the timestamp reaches the browser as an ISO
                      string, which is what JSON has. */}
                  <td className="py-3 pl-3 text-right font-mono text-xs tabular-nums text-muted">
                    {formatArrival(new Date(customer.updatedAt))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {result.totalPages > 1 ? (
        <nav aria-label="Sahifalar" className="mt-8 flex items-center gap-3 text-sm">
          {result.page > 1 ? (
            <Link
              href={href(result.page - 1)}
              className="text-muted transition-colors hover:text-foreground"
            >
              ← Oldingi
            </Link>
          ) : null}
          <span className="font-mono text-xs tabular-nums text-muted">
            {result.page} / {result.totalPages}
          </span>
          {result.page < result.totalPages ? (
            <Link
              href={href(result.page + 1)}
              className="text-muted transition-colors hover:text-foreground"
            >
              Keyingi →
            </Link>
          ) : null}
        </nav>
      ) : null}
    </>
  );
}
