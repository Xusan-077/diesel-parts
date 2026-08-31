import axios, { AxiosError } from "axios";

/**
 * Browser-side HTTP client. Server code must not use this — it calls the
 * repository directly instead of round-tripping through our own API.
 */
export const apiClient = axios.create({
  baseURL: "/api",
  timeout: 15_000,
  headers: { "Content-Type": "application/json" },
});

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

function toApiError(error: unknown): ApiError {
  if (error instanceof AxiosError) {
    const status = error.response?.status ?? 0;
    const payload = error.response?.data as { error?: unknown } | undefined;
    const code =
      typeof payload?.error === "string"
        ? payload.error
        : status === 0
          ? "network_error"
          : "request_failed";
    return new ApiError(error.message, status, code);
  }

  return new ApiError(
    error instanceof Error ? error.message : "Unknown error",
    0,
    "unknown_error"
  );
}

// Normalises every failure into ApiError so callers never branch on axios internals.
apiClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => Promise.reject(toApiError(error))
);
