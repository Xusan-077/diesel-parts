import type { Dictionary } from "@/lib/i18n/dictionaries";

type CheckoutDict = Dictionary["checkout"];

/**
 * checkoutRequestSchema (lib/schemas.ts) fails with a code, not a sentence —
 * same split as lib/account/error-text.ts's accountFieldError, for the same
 * reason: this form renders in three languages and Zod has no dictionary.
 */
const MESSAGE_KEY = {
  required: "errorRequired",
  tooLong: "errorTooLong",
  invalidEmail: "errorInvalidEmail",
  termsRequired: "errorTermsRequired",
} as const satisfies Record<string, keyof CheckoutDict>;

export type CheckoutErrorCode = keyof typeof MESSAGE_KEY;

/**
 * `null` when the field is fine. An unrecognised code falls back to the
 * generic "required" wording rather than leaking a raw code onto the screen.
 */
export function checkoutFieldError(dict: CheckoutDict, code: string | undefined): string | null {
  if (code === undefined || code.length === 0) {
    return null;
  }
  const key = MESSAGE_KEY[code as CheckoutErrorCode] ?? "errorRequired";
  return dict[key];
}
