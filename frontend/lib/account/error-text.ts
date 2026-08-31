import type { Dictionary } from "@/lib/i18n/dictionaries";

type Panel = Dictionary["account"]["profilePanel"];

/**
 * The schemas in lib/schemas.ts fail with a code — `tooShort`, `futureDate` —
 * rather than a sentence, because the panel is rendered in three languages and
 * a Zod schema has no dictionary. This is the other half of that split.
 */
const MESSAGE_KEY = {
  required: "errorRequired",
  tooShort: "errorTooShort",
  tooLong: "errorTooLong",
  invalidDate: "errorInvalidDate",
  futureDate: "errorFutureDate",
} as const satisfies Record<string, keyof Panel>;

export type AccountErrorCode = keyof typeof MESSAGE_KEY;

/**
 * `null` when the field is fine. An unrecognised code falls back to the
 * generic "required" wording rather than leaking `tooShort` onto the screen —
 * a validator added later is a bug to fix, not a reason to show English.
 */
export function accountFieldError(panel: Panel, code: string | undefined): string | null {
  if (code === undefined || code.length === 0) {
    return null;
  }
  const key = MESSAGE_KEY[code as AccountErrorCode] ?? "errorRequired";
  return panel[key];
}
