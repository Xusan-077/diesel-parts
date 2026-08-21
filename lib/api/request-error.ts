import axios, { type AxiosError } from "axios";

/** Printed when the request never reached the server. */
export const OFFLINE_MESSAGE = "Ulanmadi. Qayta urinib ko'ring.";

interface RefusalBody {
  errors?: Record<string, string[] | undefined>;
}

/**
 * True when the server answered and refused, false when the request never
 * landed. axios rejects on both, and the panel has to tell them apart: a
 * refusal means the screen's picture of the row is now known to be stale, while
 * a dropped request changed nothing and must not trigger a refresh.
 */
export function isRefusal(error: unknown): error is AxiosError {
  return axios.isAxiosError(error) && error.response !== undefined;
}

/** The refused response's body, typed by the caller; absent when none arrived. */
export function refusalPayload<T>(error: unknown): T | undefined {
  return isRefusal(error) ? (error.response?.data as T) : undefined;
}

/**
 * The message for a rejected request. Every refusal the API sends carries
 * `{ success: false, errors: { _root: [...] } }` under a non-2xx status, which
 * is exactly what axios hands back as `error.response.data`.
 */
export function requestErrorMessage(
  error: unknown,
  refused: string,
  offline: string = OFFLINE_MESSAGE,
): string {
  if (!isRefusal(error)) {
    return offline;
  }

  const body = error.response?.data as RefusalBody | undefined;
  return body?.errors?._root?.[0] ?? refused;
}
