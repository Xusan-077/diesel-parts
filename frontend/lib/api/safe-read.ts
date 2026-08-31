/**
 * Reads a page can survive losing.
 *
 * Every catalog read goes through Prisma, and a Prisma call that cannot reach
 * Postgres rejects. Inside a server component that rejection propagates all the
 * way out and Next answers the whole request with a 500 — the header, the
 * footer and the eight sections that need no database at all disappear along
 * with the one product row that failed.
 *
 * `safeRead` draws the line: the caller says what this read is worth on its own
 * (`fallback`), and gets back whether it worked. Supplementary content — a
 * product row, a brand grid, the filter reference data — degrades to a short
 * notice. Content the page *is* (a product looked up by slug) is deliberately
 * left un-wrapped, so it still reaches `error.tsx` and the visitor is told the
 * page is broken rather than shown a convincing empty one.
 */

/**
 * Digest prefixes the framework uses to move control around by throwing.
 *
 * `notFound()`, `redirect()`, a dynamic API called during a static render and
 * `next/dynamic`'s client-side bail-out are all delivered as exceptions. They
 * are not failures and must never be caught here — swallowing a `redirect()`
 * would render the page it was redirecting away from.
 */
const FRAMEWORK_SIGNAL_DIGESTS = [
  "NEXT_REDIRECT",
  "NEXT_HTTP_ERROR_FALLBACK",
  // Pre-15 spelling of notFound(); harmless to keep, cheap to check.
  "NEXT_NOT_FOUND",
  "DYNAMIC_SERVER_USAGE",
  "BAILOUT_TO_CLIENT_SIDE_RENDERING",
];

/** React's PPR postpone signal, which is a tagged object rather than an Error. */
const REACT_POSTPONE = Symbol.for("react.postpone");

export function isFrameworkSignal(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  if ((error as { $$typeof?: unknown }).$$typeof === REACT_POSTPONE) {
    return true;
  }

  const { digest } = error as { digest?: unknown };
  return (
    typeof digest === "string" &&
    FRAMEWORK_SIGNAL_DIGESTS.some((code) => digest === code || digest.startsWith(`${code};`))
  );
}

export interface ReadResult<T> {
  /** False when the read threw and `data` is the caller's fallback. */
  ok: boolean;
  data: T;
}

/**
 * Runs `read`, and on failure logs it and answers with `fallback` instead.
 *
 * `label` names the read in the server log — the stack of a rejected Prisma
 * promise inside a server component says very little about which section of
 * which page went dark.
 */
export async function safeRead<T>(
  label: string,
  read: () => Promise<T>,
  fallback: T,
): Promise<ReadResult<T>> {
  try {
    return { ok: true, data: await read() };
  } catch (error) {
    if (isFrameworkSignal(error)) {
      throw error;
    }

    console.error(`[safe-read] ${label} failed:`, error);
    return { ok: false, data: fallback };
  }
}
