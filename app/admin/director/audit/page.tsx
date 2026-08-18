import Link from "next/link";
import { listAudit, listAuditEntityTypes } from "@/lib/api/discount-repository";

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

export default async function DirectorAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[]; type?: string | string[] }>;
}) {
  const params = await searchParams;
  const first = (value: string | string[] | undefined) =>
    (Array.isArray(value) ? value[0] : value) ?? "";

  const page = Math.max(1, Number.parseInt(first(params.page), 10) || 1);
  const type = first(params.type);

  const [result, types] = await Promise.all([
    listAudit(page, type || undefined),
    listAuditEntityTypes(),
  ]);

  const href = (next: { page?: number; type?: string }) => {
    const query = new URLSearchParams();
    const nextType = next.type ?? type;
    if (nextType) query.set("type", nextType);
    if (next.page && next.page > 1) query.set("page", String(next.page));
    const search = query.toString();
    return "/admin/director/audit" + (search ? "?" + search : "");
  };

  return (
    <div>
      <p className="font-mono text-[0.6875rem] uppercase tracking-[0.2em] text-muted">
        Direktor paneli
      </p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
        Amallar tarixi
      </h1>
      <p className="mt-1 max-w-prose text-sm text-muted">
        Kim nima qilgani. {result.total} ta yozuv — o&apos;chirib bo&apos;lmaydi.
      </p>

      <nav aria-label="Turi bo'yicha" className="mt-6 flex flex-wrap items-center gap-1">
        <Link
          href={href({ type: "", page: 1 })}
          aria-current={type === "" ? "true" : undefined}
          className={
            "rounded px-2.5 py-1 text-xs transition-colors " +
            (type === ""
              ? "bg-surface-muted font-medium text-foreground"
              : "text-muted hover:text-foreground")
          }
        >
          Hammasi
        </Link>
        {types.map((entity) => (
          <Link
            key={entity}
            href={href({ type: entity, page: 1 })}
            aria-current={type === entity ? "true" : undefined}
            className={
              "rounded px-2.5 py-1 text-xs transition-colors " +
              (type === entity
                ? "bg-surface-muted font-medium text-foreground"
                : "text-muted hover:text-foreground")
            }
          >
            {entity}
          </Link>
        ))}
      </nav>

      <ul className="mt-8 divide-y divide-border">
        {result.items.map((entry) => {
          const { before, after } = diff(entry.before, entry.after);

          return (
            <li key={entry.id} className="py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                <p className="text-sm text-foreground">
                  <span className="font-medium">{entry.actorName ?? "O'chirilgan hisob"}</span>{" "}
                  <span className="text-muted">
                    {entry.entityType} {ACTION_LABEL[entry.action] ?? entry.action.toLowerCase()}
                  </span>
                </p>
                <p className="font-mono text-xs text-muted">
                  {entry.createdAt.toLocaleString("uz-UZ")}
                </p>
              </div>
              {after || before ? (
                <p className="mt-1 font-mono text-xs text-muted">
                  {before ? <span className="line-through">{before}</span> : null}
                  {before && after ? " → " : null}
                  {after}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>

      {result.totalPages > 1 ? (
        <nav aria-label="Sahifalar" className="mt-8 flex items-center gap-3 text-sm">
          {result.page > 1 ? (
            <Link
              href={href({ page: result.page - 1 })}
              className="text-muted hover:text-foreground"
            >
              ← Oldingi
            </Link>
          ) : null}
          <span className="font-mono text-xs text-muted">
            {result.page} / {result.totalPages}
          </span>
          {result.page < result.totalPages ? (
            <Link
              href={href({ page: result.page + 1 })}
              className="text-muted hover:text-foreground"
            >
              Keyingi →
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
