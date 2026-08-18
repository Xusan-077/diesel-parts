/**
 * Brute-force brake for the staff password login.
 *
 * Process-local, exactly like `otp-store.ts`. Good enough for a single Node
 * server; on serverless or multi-instance hosting this must move to Redis
 * behind the same function signatures, or each instance will count separately.
 */

export const MAX_LOGIN_ATTEMPTS = 5;
export const LOGIN_WINDOW_MS = 15 * 60_000;

interface Attempts {
  count: number;
  windowStartedAt: number;
}

const store = new Map<string, Attempts>();

function toSeconds(ms: number): number {
  return Math.max(1, Math.ceil(ms / 1000));
}

/** Drops entries whose window has elapsed, so the map cannot grow forever. */
function prune(now: number): void {
  for (const [key, entry] of store) {
    if (now - entry.windowStartedAt >= LOGIN_WINDOW_MS) {
      store.delete(key);
    }
  }
}

export type LoginAllowed = { ok: true } | { ok: false; retryAfterSeconds: number };

export function checkLoginAllowed(key: string, now: number = Date.now()): LoginAllowed {
  prune(now);
  const entry = store.get(key);

  if (!entry || entry.count < MAX_LOGIN_ATTEMPTS) {
    return { ok: true };
  }

  return {
    ok: false,
    retryAfterSeconds: toSeconds(entry.windowStartedAt + LOGIN_WINDOW_MS - now),
  };
}

export function recordLoginFailure(key: string, now: number = Date.now()): void {
  const entry = store.get(key);
  const windowIsOpen = entry !== undefined && now - entry.windowStartedAt < LOGIN_WINDOW_MS;

  store.set(key, {
    count: windowIsOpen ? entry.count + 1 : 1,
    windowStartedAt: windowIsOpen ? entry.windowStartedAt : now,
  });
}

/** A successful sign-in clears the count, so one typo costs nothing later. */
export function clearLoginFailures(key: string): void {
  store.delete(key);
}

/** Test-only hook; production code never needs to clear the whole store. */
export function resetLoginThrottle(): void {
  store.clear();
}
