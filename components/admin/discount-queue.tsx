"use client";

import { useState } from "react";
import { useAdminDiscounts, useDecideDiscount } from "@/hooks/admin/use-admin-discounts";
import type { DiscountListRow } from "@/lib/api/admin/resources";
import { requestErrorMessage } from "@/lib/api/request-error";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatSum } from "@/lib/analytics/format";

/**
 * One request as this screen sees it — the row the API sends, not the row the
 * repository reads: the timestamp has been through JSON.
 */
export type DiscountRequestItem = DiscountListRow;

function DecisionCard({ request }: { request: DiscountRequestItem }) {
  const [note, setNote] = useState("");
  /*
   * Which button was pressed, kept beside the mutation rather than derived from
   * it: `isPending` says a decision is in flight, not which one, and the two
   * buttons label themselves differently while they wait.
   */
  const [pressed, setPressed] = useState<"approve" | "reject" | null>(null);

  const decide = useDecideDiscount();
  const busy = decide.isPending ? pressed : null;
  const error = decide.isError ? requestErrorMessage(decide.error, "Saqlanmadi.") : null;

  function send(approve: boolean) {
    setPressed(approve ? "approve" : "reject");
    decide.mutate({ id: request.id, approve, note: note.trim() || null });
  }

  const overLimit = request.requestedPercent - request.sellerLimit;
  const discountValue = request.subtotal - request.totalIfApproved;

  return (
    <li className="border-l-2 border-border py-4 pl-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <p className="text-sm text-foreground">
          {request.sellerName}
          <span className="ml-2 text-muted">
            {request.customerName} uchun · {request.orderNumber}
          </span>
        </p>
        <p className="font-mono text-xs text-muted">
          {new Date(request.createdAt).toLocaleDateString("uz-UZ")}
        </p>
      </div>

      <div className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-3">
        <div>
          <p className="type-eyebrow text-muted">
            So&apos;ralgan chegirma
          </p>
          <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-foreground">
            {request.requestedPercent}%
          </p>
          <p className="mt-1 text-xs text-muted">
            Limiti {request.sellerLimit}% — {overLimit > 0 ? overLimit + "% ortiq" : "limit ichida"}
          </p>
        </div>
        <div>
          <p className="type-eyebrow text-muted">
            Buyurtma summasi
          </p>
          <p className="mt-1 font-mono text-sm tabular-nums text-foreground">
            {formatSum(request.subtotal)}
          </p>
          <p className="mt-1 text-xs text-muted">
            Tasdiqlansa: {formatSum(request.totalIfApproved)}
          </p>
        </div>
        <div>
          <p className="type-eyebrow text-muted">
            Chegirma qiymati
          </p>
          <p className="mt-1 font-mono text-sm tabular-nums text-danger">
            −{formatSum(discountValue)}
          </p>
        </div>
      </div>

      {request.reason ? (
        <p className="mt-4 max-w-prose text-sm text-muted">
          <span className="text-foreground">Sababi:</span> {request.reason}
        </p>
      ) : null}

      <div className="mt-4 max-w-xl">
        <label htmlFor={"note-" + request.id} className="text-xs text-muted">
          Izoh (ixtiyoriy — sotuvchiga ko&apos;rinadi)
        </label>
        <Textarea
          id={"note-" + request.id}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={2}
          className="mt-2 min-h-0"
        />
      </div>

      <div aria-live="polite" className="min-h-5">
        {error ? (
          <p role="alert" className="mt-2 text-sm text-danger">
            {error}
          </p>
        ) : null}
      </div>

      <div className="mt-3 flex items-center gap-3">
        <Button type="button" size="sm" onClick={() => send(true)} disabled={decide.isPending}>
          {busy === "approve" ? "Tasdiqlanmoqda…" : "Tasdiqlash"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => send(false)}
          disabled={decide.isPending}
        >
          {busy === "reject" ? "Rad etilmoqda…" : "Rad etish"}
        </Button>
      </div>
    </li>
  );
}

export function DiscountQueue({ initialData }: { initialData?: DiscountRequestItem[] }) {
  const list = useAdminDiscounts(initialData);

  if (list.isPending) {
    return (
      <div aria-busy="true" className="mt-8">
        <span className="sr-only">Yuklanmoqda...</span>
        <div aria-hidden="true" className="flex flex-col gap-4">
          {Array.from({ length: 2 }, (_, index) => (
            <div key={index} className="h-40 animate-pulse rounded-md bg-surface-muted" />
          ))}
        </div>
      </div>
    );
  }

  if (list.isError) {
    return (
      <div className="mt-8">
        <p className="text-sm text-foreground">
          {requestErrorMessage(list.error, "So'rovlar yuklanmadi.")}
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

  const requests = list.data;

  if (requests.length === 0) {
    return (
      <div className="mt-8">
        <p className="text-sm text-foreground">Tasdiqlash kutayotgan so&apos;rov yo&apos;q.</p>
        <p className="mt-1 text-xs text-muted">
          Sotuvchi o&apos;z limitidan yuqori chegirma so&apos;raganda so&apos;rov shu yerga tushadi.
        </p>
      </div>
    );
  }

  return (
    <ul className="mt-8 divide-y divide-border">
      {requests.map((request) => (
        <DecisionCard key={request.id} request={request} />
      ))}
    </ul>
  );
}
