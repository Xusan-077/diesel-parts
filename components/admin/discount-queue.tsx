"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatSum } from "@/lib/analytics/format";

export interface DiscountRequestItem {
  id: string;
  orderNumber: string;
  sellerName: string;
  sellerLimit: number;
  customerName: string;
  requestedPercent: number;
  reason: string | null;
  subtotal: number;
  totalIfApproved: number;
  createdAt: string;
}

function DecisionCard({ request }: { request: DiscountRequestItem }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(approve: boolean) {
    setBusy(approve ? "approve" : "reject");
    setError(null);

    try {
      const response = await fetch("/api/v1/discount-requests/" + request.id, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approve, note: note.trim() || null }),
      });
      const data = (await response.json()) as {
        success: boolean;
        errors?: { _root?: string[] };
      };

      if (!data.success) {
        setError(data.errors?._root?.[0] ?? "Saqlanmadi.");
        setBusy(null);
        return;
      }

      router.refresh();
    } catch {
      setError("Ulanmadi. Qayta urinib ko'ring.");
      setBusy(null);
    }
  }

  const overLimit = request.requestedPercent - request.sellerLimit;
  const discountValue = request.subtotal - request.totalIfApproved;

  return (
    <li className="border-l-2 border-border py-5 pl-5">
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
          <p className="mt-0.5 text-xs text-muted">
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
          <p className="mt-0.5 text-xs text-muted">
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
          className="mt-1.5 min-h-0"
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
        <Button type="button" size="sm" onClick={() => decide(true)} disabled={busy !== null}>
          {busy === "approve" ? "Tasdiqlanmoqda…" : "Tasdiqlash"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => decide(false)}
          disabled={busy !== null}
        >
          {busy === "reject" ? "Rad etilmoqda…" : "Rad etish"}
        </Button>
      </div>
    </li>
  );
}

export function DiscountQueue({ requests }: { requests: DiscountRequestItem[] }) {
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
