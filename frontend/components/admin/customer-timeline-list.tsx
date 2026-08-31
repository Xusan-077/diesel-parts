import { formatSum } from "@/lib/analytics/format";
import { COLUMN_LABELS } from "@/lib/admin/inquiry-board-state";
import { ORDER_STATUS_LABEL, type TimelineEntry } from "@/lib/admin/customer-timeline";

/**
 * The account's history, newest first.
 *
 * One column carrying two kinds of row, distinguished by a mono eyebrow rather
 * than by colour or an icon set: the seller reads this to answer "what has
 * happened here", and an inquiry and an order are the same kind of answer at
 * different stages. Each entry keeps a left rule, the device the board uses on
 * its cards, so the two seller screens read as one tool.
 *
 * A server component — nothing here is interactive.
 */
export function CustomerTimelineList({ entries }: { entries: readonly TimelineEntry[] }) {
  return (
    <ol className="mt-4 space-y-4">
      {entries.map((entry) => (
        <li key={`${entry.kind}-${entry.id}`} className="border-l-2 border-border pl-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <p className="type-eyebrow text-muted">
              {entry.kind === "order" ? entry.orderNumber : "So'rov"}
              <span className="ml-2 normal-case tracking-normal">
                {entry.kind === "order"
                  ? ORDER_STATUS_LABEL[entry.status]
                  : COLUMN_LABELS[entry.column]}
              </span>
            </p>
            <p className="shrink-0 font-mono text-xs tabular-nums text-muted">
              {entry.dateLabel}
            </p>
          </div>

          {entry.kind === "order" ? (
            <p className="mt-1 text-sm text-foreground">
              <span className="font-mono tabular-nums">{formatSum(entry.totalAmount)}</span>
              <span className="ml-2 text-muted">{entry.itemCount} ta pozitsiya</span>
              {entry.discountPercent > 0 ? (
                <span className="ml-2 font-mono tabular-nums text-muted">
                  −{entry.discountPercent}%
                </span>
              ) : null}
            </p>
          ) : (
            <>
              <p className="mt-1 text-sm text-foreground">{entry.message}</p>
              {entry.productSku === null ? null : (
                <p className="mt-1 type-eyebrow text-muted">
                  {entry.productSku}
                  {entry.quantity === null ? null : <span className="ml-2">× {entry.quantity}</span>}
                </p>
              )}
            </>
          )}

          {/* The notes left on the lead or the order. This is the closest thing
              the data has to a note history — neither table keeps versions — so
              it is shown where it happened rather than pooled into one list
              that would lose what each note was about. */}
          {entry.notes === null ? null : (
            <p className="mt-2 whitespace-pre-wrap text-sm text-muted">{entry.notes}</p>
          )}

          {entry.sellerName === null ? null : (
            <p className="mt-1 text-xs text-muted">{entry.sellerName}</p>
          )}
        </li>
      ))}
    </ol>
  );
}
