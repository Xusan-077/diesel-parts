"use client";

import Link from "next/link";
import { useAdminAudit } from "@/hooks/admin/use-admin-audit";
import type { AuditListResult } from "@/lib/api/admin/resources";
import { requestErrorMessage } from "@/lib/api/request-error";
import type { AuditListQuery } from "@/lib/schemas";
import { Button } from "@/components/ui/button";

const ACTION_LABEL: Record<string, string> = {
  CREATE: "yaratdi",
  UPDATE: "o'zgartirdi",
  DELETE: "arxivladi",
  APPROVE: "tasdiqladi",
  REJECT: "rad etdi",
  IMPORT: "import qildi",
  LOGIN: "tizimga kirdi",
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * Only the fields that actually differ.
 *
 * A CSV re-import writes every product whether or not anything changed, and
 * printing the whole snapshot on both sides made those rows read as edits. A
 * diff that lists nothing is the honest way to say nothing changed.
 */
function diff(before: unknown, after: unknown): { before: string | null; after: string | null } {
  const from = asRecord(before);
  const to = asRecord(after);

  if (from === null || to === null) {
    // A create or a delete: one side is the whole story.
    const only = to ?? from;
    if (only === null) {
      return { before: null, after: null };
    }
    const text = Object.entries(only)
      .slice(0, 4)
      .map(([key, value]) => key + ": " + String(value))
      .join(" · ");
    return to === null ? { before: text, after: null } : { before: null, after: text };
  }

  const changed = Object.keys(to).filter((key) => String(from[key]) !== String(to[key]));

  if (changed.length === 0) {
    return { before: null, after: null };
  }

  // A key present on one side only reads as an em dash, not as "undefined".
  const show = (value: unknown) => (value === undefined || value === null ? "—" : String(value));

  const render = (source: Record<string, unknown>) =>
    changed
      .slice(0, 4)
      .map((key) => key + ": " + show(source[key]))
      .join(" · ");

  return { before: render(from), after: render(to) };
}

/**
 * The audit trail: who did what, filtered by kind of record.
 *
 * A client component for one reason — the log is written by everyone else. A
 * director reading it while a colleague edits the catalogue should see that
 * edit arrive, and every panel write invalidates this list to make that happen.
 * Nothing here writes anything: the trail is append-only by design.
 *
 * The filter and the page number stay in the URL, so a trail someone is
 * looking at is a trail they can send to somebody else.
 */
export function AuditLog({
  query,
  initialData,
}: {
  query: AuditListQuery;
  initialData?: AuditListResult;
}) {
  const list = useAdminAudit(query, initialData);
  const type = query.entityType ?? "";

  const href = (next: { page?: number; type?: string }) => {
    const params = new URLSearchParams();
    const nextType = next.type ?? type;
    if (nextType) params.set("type", nextType);
    if (next.page && next.page > 1) params.set("page", String(next.page));
    const search = params.toString();
    return "/director/audit" + (search ? "?" + search : "");
  };

  if (list.isPending) {
    return (
      <div aria-busy="true" className="mt-8">
        <span className="sr-only">Yuklanmoqda...</span>
        <div aria-hidden="true" className="flex flex-col gap-3">
          {Array.from({ length: 8 }, (_, index) => (
            <div key={index} className="h-12 animate-pulse rounded-md bg-surface-muted" />
          ))}
        </div>
      </div>
    );
  }

  if (list.isError) {
    return (
      <div className="mt-8">
        <p className="text-sm text-foreground">
          {requestErrorMessage(list.error, "Tarix yuklanmadi.")}
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

  return (
    <>
      <p className="mt-6 font-mono text-xs tabular-nums text-muted">
        {result.total} ta yozuv &mdash; o&apos;chirib bo&apos;lmaydi.
      </p>

      {/* Same segmented control as the products list - a raised chip on a
          recessed track. The entity names come from the database, so the track
          wraps rather than assuming a fixed number of segments. */}
      <nav
        aria-label="Turi bo'yicha"
        className="mt-4 flex flex-wrap items-center gap-1 rounded-md border border-border bg-surface-muted p-1"
      >
        <Link
          href={href({ type: "", page: 1 })}
          aria-current={type === "" ? "true" : undefined}
          className={
            "inline-flex h-7 items-center rounded-sm px-3 text-xs transition-colors " +
            (type === ""
              ? "border border-border bg-surface font-medium text-foreground shadow-xs"
              : "border border-transparent text-muted hover:bg-surface-hover hover:text-foreground")
          }
        >
          Hammasi
        </Link>
        {result.entityTypes.map((entity) => (
          <Link
            key={entity}
            href={href({ type: entity, page: 1 })}
            aria-current={type === entity ? "true" : undefined}
            className={
              "inline-flex h-7 items-center rounded-sm px-3 font-mono text-xs transition-colors " +
              (type === entity
                ? "border border-border bg-surface font-medium text-foreground shadow-xs"
                : "border border-transparent text-muted hover:bg-surface-hover hover:text-foreground")
            }
          >
            {entity}
          </Link>
        ))}
      </nav>

      {result.items.length === 0 ? (
        <div className="mt-8">
          <p className="text-sm text-foreground">Bu turdagi yozuv hali yo&apos;q.</p>
          <p className="mt-1 text-xs text-muted">
            Panelda bajarilgan har bir amal shu yerga yoziladi.
          </p>
        </div>
      ) : (
        /* A chronological log is a feed, not a card grid: one divided
           column reads faster than 50 bordered boxes, and boxing it would
           also fight `panel`'s own 24px padding at the first and last row. */
        <ul className="mt-8 divide-y divide-border">
          {result.items.map((entry) => {
            const { before, after } = diff(entry.before, entry.after);

            return (
              <li key={entry.id} className="py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                  <p className="text-sm text-foreground">
                    <span className="font-medium">{entry.actorName ?? "O'chirilgan hisob"}</span>{" "}
                    <span className="text-muted">
                      {entry.entityType} {ACTION_LABEL[entry.action] ?? entry.action.toLowerCase()}
                    </span>
                  </p>
                  {/* Parsed here rather than server-side: the timestamp reaches
                      the browser as an ISO string, which is what JSON has. */}
                  <p className="font-mono text-xs text-muted">
                    {new Date(entry.createdAt).toLocaleString("uz-UZ")}
                  </p>
                </div>
                {after || before ? (
                  <p className="mt-1 font-mono text-xs text-muted">
                    {before ? <span className="line-through">{before}</span> : null}
                    {before && after ? " \u2192 " : null}
                    {after}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {result.totalPages > 1 ? (
        <nav aria-label="Sahifalar" className="mt-8 flex items-center gap-3 text-sm">
          {result.page > 1 ? (
            <Link href={href({ page: result.page - 1 })} className="text-muted hover:text-foreground">
              &larr; Oldingi
            </Link>
          ) : null}
          <span className="font-mono text-xs text-muted">
            {result.page} / {result.totalPages}
          </span>
          {result.page < result.totalPages ? (
            <Link href={href({ page: result.page + 1 })} className="text-muted hover:text-foreground">
              Keyingi &rarr;
            </Link>
          ) : null}
        </nav>
      ) : null}
    </>
  );
}
