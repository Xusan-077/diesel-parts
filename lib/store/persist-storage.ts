export interface PersistedEnvelope {
  state: Record<string, unknown>;
  version?: number;
}

/**
 * Normalises a raw localStorage string into the envelope `zustand/persist`
 * expects, tolerating the format this app used before zustand.
 *
 * Two shapes are accepted:
 *  - `{"state":{"items":[...]},"version":0}` — what persist writes
 *  - `[...]`                                 — the bare array written before
 *
 * Corrupt JSON yields `null`, which persist treats as "nothing stored".
 * This must happen at the storage layer: persist unwraps `.state` before
 * calling `merge`, so a bare array would never reach `merge`.
 */
export function normalizePersistedValue(
  raw: string | null,
  sliceKey: string
): PersistedEnvelope | null {
  if (raw === null) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (Array.isArray(parsed)) {
    return { state: { [sliceKey]: parsed } };
  }

  if (parsed !== null && typeof parsed === "object") {
    const envelope = parsed as { state?: unknown };
    if (envelope.state !== null && typeof envelope.state === "object") {
      return { state: envelope.state as Record<string, unknown> };
    }
  }

  return null;
}
