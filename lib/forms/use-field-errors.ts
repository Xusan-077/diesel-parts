"use client";

import * as React from "react";
import type { z } from "zod";

/**
 * Field-level validation from the schema the route already enforces.
 *
 * The panel's forms used to validate in exactly one place — the server, on
 * submit — and report the first refusal as a sentence above the buttons. For a
 * customer's two fields that is fine. For a product's twenty it means scrolling
 * back up to hunt for which one the server meant, and the sentence is written
 * in the API's vocabulary rather than the form's.
 *
 * So the same Zod schema runs in the browser too. It is not a second source of
 * truth: the server still decides, and a rejection that only the server can
 * make (a duplicate SKU, a slug already taken) still comes back the old way.
 * What this adds is the half that can be answered locally, answered while the
 * director is still standing in the field.
 *
 * WHEN IT SPEAKS is the part worth getting right. A field that turns red while
 * you are still typing the first character of a value is not validating, it is
 * heckling. So:
 *
 *   - `touch(field)` on blur — the field has been left, it may now be judged.
 *   - a touched field re-validates on every change, so the error clears the
 *     moment the value becomes good rather than on the next blur.
 *   - an untouched field stays silent until `touchAll()`, which submit calls.
 *
 * That is the "real-time, but on blur first" rule the brief asked for, and it
 * is the one interaction detail that decides whether validation feels like
 * help or like nagging.
 */

/** Field name to the message shown under it. */
export type FieldErrors = Record<string, string>;

/**
 * Zod's own message, rewritten in the panel's language.
 *
 * The schemas in `lib/schemas.ts` are shared with the API routes, where the
 * message is a machine-readable code in a JSON body that no person reads. They
 * are not the place to put Uzbek prose — a `message` added there would ship the
 * panel's wording to every public endpoint's error payload as well.
 *
 * So the translation happens here, on the one path where a person sees it, and
 * it works off the issue's *code* rather than its text. Codes are stable across
 * Zod releases; the English sentences are not.
 *
 * A schema that set its own message (`slug_format`) keeps it — an author who
 * wrote a specific message meant it, and the map below only answers the
 * generic cases.
 */
const CUSTOM_MESSAGES: Record<string, string> = {
  slug_format: "Faqat kichik lotin harflari, raqam va defis: cat-fuel-injector",
  no_fields: "Hech bo'lmasa bitta maydonni to'ldiring",
};

function translateIssue(issue: z.core.$ZodIssue): string {
  const custom = CUSTOM_MESSAGES[issue.message];
  if (custom !== undefined) {
    return custom;
  }

  switch (issue.code) {
    case "invalid_type":
      // A missing value arrives as an `undefined` of the wrong type, which is
      // the overwhelmingly common case and deserves the plain wording.
      return "Bu maydon to'ldirilishi shart";

    case "too_small": {
      const { minimum, origin } = issue;
      if (origin === "string") {
        return minimum === 1
          ? "Bu maydon to'ldirilishi shart"
          : `Kamida ${String(minimum)} ta belgi`;
      }
      if (origin === "array") {
        return `Kamida ${String(minimum)} ta qiymat`;
      }
      return `Eng kichik qiymat — ${String(minimum)}`;
    }

    case "too_big": {
      const { maximum, origin } = issue;
      if (origin === "string") {
        return `Ko'pi bilan ${String(maximum)} ta belgi`;
      }
      if (origin === "array") {
        return `Ko'pi bilan ${String(maximum)} ta qiymat`;
      }
      return `Eng katta qiymat — ${String(maximum)}`;
    }

    case "invalid_format":
      return issue.format === "email"
        ? "To'g'ri e-pochta manzilini kiriting"
        : "Format noto'g'ri";

    case "invalid_value":
      return "Ro'yxatdan bittasini tanlang";

    case "not_multiple_of":
      return "Butun son kiriting";

    default:
      return "Qiymat noto'g'ri";
  }
}

/**
 * Flattens a Zod issue list into one message per field path.
 *
 * The first issue on a path wins: a field with two problems has one line under
 * it, and stacking both would move the layout more than it would inform.
 * Nested paths join with a dot (`name.uz`), which is how the call sites below
 * address a localized group.
 */
export function collectIssues(issues: readonly z.core.$ZodIssue[]): FieldErrors {
  const errors: FieldErrors = {};

  for (const issue of issues) {
    const path = issue.path.join(".");
    // `_root` is the form-level slot, matching what the API's error payload
    // already calls a refusal that belongs to no single field.
    const key = path === "" ? "_root" : path;
    errors[key] ??= translateIssue(issue);
  }

  return errors;
}

export interface FieldErrorState<T> {
  /** The message for a field, or undefined while it is silent. */
  errorFor: (field: string) => string | undefined;
  /** True when every field passes — what the submit button asks. */
  valid: boolean;
  /** Marks a field judgeable. Call from `onBlur`. */
  touch: (field: string) => void;
  /** Marks every field judgeable and reports whether the value is good. */
  touchAll: () => boolean;
  /** The parsed value when valid, else null. */
  parsed: T | null;
  /** Server-side refusals, merged in and cleared on the next edit. */
  setServerErrors: (errors: FieldErrors) => void;
}

/**
 * Runs `schema` against `value` and reports only what the reader has earned.
 *
 * Validation itself is not debounced. It is a synchronous parse of an object
 * that is already in memory, and the panel's largest form is twenty fields —
 * paying a timer to avoid that would add lag to the error *clearing*, which is
 * the half a reader is actually waiting on.
 */
export function useFieldErrors<T>(
  schema: z.ZodType<T>,
  value: unknown,
): FieldErrorState<T> {
  const [touched, setTouched] = React.useState<ReadonlySet<string>>(new Set());
  const [server, setServer] = React.useState<FieldErrors>({});

  const result = React.useMemo(() => schema.safeParse(value), [schema, value]);

  const errors = React.useMemo(
    () => (result.success ? {} : collectIssues(result.error.issues)),
    [result],
  );

  /*
   * A server refusal outranks the local one on the same field. It has to: the
   * local rule says "an SKU is 1 to 64 characters" and the server's says "that
   * SKU is already on another part", and only one of those tells the director
   * what to do next.
   */
  const errorFor = React.useCallback(
    (field: string) => {
      if (server[field] !== undefined) {
        return server[field];
      }
      return touched.has(field) ? errors[field] : undefined;
    },
    [errors, server, touched],
  );

  const touch = React.useCallback((field: string) => {
    setTouched((current) => {
      if (current.has(field)) {
        return current;
      }
      const next = new Set(current);
      next.add(field);
      return next;
    });
  }, []);

  const touchAll = React.useCallback(() => {
    setTouched(new Set(Object.keys(errors)));
    return result.success;
  }, [errors, result.success]);

  /*
   * Any edit retires every server error, not just the one on the field that
   * changed. A server refusal was a verdict on the whole payload; once the
   * payload has moved, the verdict is stale, and leaving a red line under a
   * field the director has since fixed is the worst of the options.
   */
  const firstEdit = React.useRef(value);
  React.useEffect(() => {
    if (firstEdit.current !== value) {
      firstEdit.current = value;
      setServer((current) => (Object.keys(current).length === 0 ? current : {}));
    }
  }, [value]);

  return {
    errorFor,
    valid: result.success,
    touch,
    touchAll,
    parsed: result.success ? result.data : null,
    setServerErrors: setServer,
  };
}
