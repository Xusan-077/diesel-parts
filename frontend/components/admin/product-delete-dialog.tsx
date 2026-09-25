"use client";

import { AlertTriangle, Archive, Trash2 } from "lucide-react";
import { useDeleteProduct, useProductDeleteCheck } from "@/hooks/admin/use-admin-products";
import { requestErrorMessage } from "@/lib/api/request-error";
import type { AdminProductRow } from "@/lib/api/product-write-repository";
import { Button } from "@/components/ui/button";
import { FormModalShell } from "@/components/ui/form-modal-shell";
import { Icon } from "@/components/ui/icon";
import { Spinner } from "@/components/ui/spinner";

export interface ProductDeleteDialogProps {
  /** The row being deleted; `null` keeps the dialog closed. */
  row: AdminProductRow | null;
  onClose: () => void;
  /** Hands the row to the catalogue's own archive confirmation. */
  onArchive: (row: AdminProductRow) => void;
}

/**
 * The permanent-delete dialog. It opens on a question, not an answer: the
 * delete-check is fetched as it opens, and only then does it show either the
 * "cannot be undone" confirmation or the reasons it cannot happen — with
 * archiving offered as the way out. The server re-runs the same check under a
 * row lock when the delete is sent, so an order placed between the two is
 * still refused (and that refusal is printed here too).
 */
export function ProductDeleteDialog({ row, onClose, onArchive }: ProductDeleteDialogProps) {
  const check = useProductDeleteCheck(row?.id ?? null);
  const remove = useDeleteProduct(onClose);
  const busy = remove.isPending;

  const subject = row ? row.sku + " · " + row.name : "";
  const canDelete = check.data?.canDelete === true;
  const blocked = check.data !== undefined && !check.data.canDelete;

  const removeError = remove.isError
    ? requestErrorMessage(remove.error, "O'chirilmadi. Qaytadan urinib ko'ring.")
    : null;

  return (
    <FormModalShell
      open={row !== null}
      onOpenChange={(next) => {
        if (!next && !busy) {
          remove.reset();
          onClose();
        }
      }}
      title="Mahsulotni butunlay o'chirish"
      closeLabel="Yopish"
      size="sm"
      tone="danger"
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            Bekor qilish
          </Button>
          {blocked && row?.isActive ? (
            <Button type="button" onClick={() => row && onArchive(row)}>
              <Icon icon={Archive} size="sm" />
              Arxivlash
            </Button>
          ) : null}
          {canDelete ? (
            <Button
              type="button"
              variant="danger"
              disabled={busy}
              onClick={() =>
                row && remove.mutate({ id: row.id }, { onError: () => void check.refetch() })
              }
            >
              {busy ? (
                <>
                  <Spinner />
                  O&apos;chirilmoqda…
                </>
              ) : (
                <>
                  <Icon icon={Trash2} size="sm" />
                  Butunlay o&apos;chirish
                </>
              )}
            </Button>
          ) : null}
        </>
      }
    >
      <div className="space-y-4">
        <p className="rounded-md border border-border bg-surface-muted px-3 py-2 font-mono text-sm text-foreground">
          {subject}
        </p>

        {check.isPending ? (
          <p className="flex items-center gap-2 text-sm text-muted" aria-busy="true">
            <Spinner />
            Tekshirilmoqda…
          </p>
        ) : check.isError ? (
          <p role="alert" className="text-sm font-medium text-danger">
            {requestErrorMessage(check.error, "Tekshirib bo'lmadi. Qaytadan urinib ko'ring.")}
          </p>
        ) : canDelete ? (
          <p className="flex items-start gap-2 text-sm text-muted">
            <Icon icon={AlertTriangle} className="mt-1 shrink-0 text-danger" />
            <span>
              Bu amalni qaytarib bo&apos;lmaydi. Mahsulot, uning rasmi, sharhlari va savatlardagi
              qatorlari butunlay o&apos;chiriladi.
            </span>
          </p>
        ) : (
          <div className="space-y-2 text-sm">
            <p className="flex items-start gap-2 text-muted">
              <Icon icon={AlertTriangle} className="mt-1 shrink-0 text-warning" />
              <span>
                Bu mahsulot bo&apos;yicha savdo/ombor tarixi bor. Hisobotlar buzilmasligi uchun
                o&apos;chirib bo&apos;lmaydi
                {row?.isActive ? ", arxivlang." : " — mahsulot allaqachon arxivda."}
              </span>
            </p>
            <ul className="list-disc space-y-1 pl-8 text-foreground">
              {check.data.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </div>
        )}

        <div aria-live="polite" className="empty:hidden">
          {removeError ? (
            <p role="alert" className="text-sm font-medium text-danger">
              {removeError}
            </p>
          ) : null}
        </div>
      </div>
    </FormModalShell>
  );
}
