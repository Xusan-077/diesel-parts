import type { Dictionary } from "@/lib/i18n/dictionaries";

export interface AuthErrorPayload {
  error?: string;
  retryAfterSeconds?: number;
  attemptsLeft?: number;
}

/** Maps an auth API error payload to a localized message. */
export function authErrorMessage(
  dict: Dictionary["account"],
  payload: AuthErrorPayload
): string {
  switch (payload.error) {
    case "invalid_phone":
      return dict.errorInvalidPhone;
    case "invalid_code":
      return dict.errorCodeFormat;
    case "invalid":
      return dict.errorInvalidCode.replace("{attempts}", String(payload.attemptsLeft ?? 0));
    case "expired":
      return dict.errorExpired;
    case "too_many_attempts":
      return dict.errorTooManyAttempts;
    case "cooldown":
      return dict.errorCooldown.replace("{seconds}", String(payload.retryAfterSeconds ?? 60));
    case "rate_limited":
      return dict.errorRateLimited;
    case "delivery_failed":
      return dict.errorDelivery;
    case "no_pending_request":
      return dict.errorNoPending;
    default:
      return dict.errorGeneric;
  }
}
