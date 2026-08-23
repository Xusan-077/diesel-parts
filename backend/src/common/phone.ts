/**
 * Uzbek phone number canonicalization, shared across every module that has to
 * compare a number typed by a seller against one typed by a customer.
 *
 * Ported from the root Next.js app's `lib/auth/phone.ts`. Pure functions only
 * — no `server-only`, no framework imports — so it can be imported from a
 * service, a DTO validator, or a unit test without dragging Nest along.
 */

const COUNTRY_CODE = '998';
const NATIONAL_LENGTH = 9;

/**
 * Digits after the country code, e.g. "901234567". Accepts anything the user
 * may type: spaces, dashes, a leading +, or the bare national number.
 */
export function extractNationalDigits(input: string): string {
  const digits = input.replace(/\D/g, '');
  const withoutCountry = digits.startsWith(COUNTRY_CODE)
    ? digits.slice(COUNTRY_CODE.length)
    : digits;
  return withoutCountry.slice(0, NATIONAL_LENGTH);
}

export function isValidPhone(input: string): boolean {
  return extractNationalDigits(input).length === NATIONAL_LENGTH;
}

/**
 * Canonical form used as the OTP store key and sent to Eskiz: "998901234567".
 * Returns null when the number is incomplete.
 */
export function toCanonicalPhone(input: string): string | null {
  const national = extractNationalDigits(input);
  return national.length === NATIONAL_LENGTH ? COUNTRY_CODE + national : null;
}

/**
 * Display form "+998 90 123-45-67". Partial input formats progressively so
 * the value can drive a controlled input as the user types.
 */
export function formatPhone(input: string): string {
  const digits = extractNationalDigits(input);
  if (digits.length === 0) {
    return `+${COUNTRY_CODE} `;
  }

  let output = `+${COUNTRY_CODE} ${digits.slice(0, 2)}`;
  if (digits.length > 2) {
    output += ` ${digits.slice(2, 5)}`;
  }
  if (digits.length > 5) {
    output += `-${digits.slice(5, 7)}`;
  }
  if (digits.length > 7) {
    output += `-${digits.slice(7, 9)}`;
  }
  return output;
}

/**
 * Display form without the country code: "90 123 45 67". Used where the
 * `+998` prefix is rendered as a separate, non-editable addon.
 */
export function formatNationalDigits(input: string): string {
  const digits = extractNationalDigits(input);
  const groups = [
    digits.slice(0, 2),
    digits.slice(2, 5),
    digits.slice(5, 7),
    digits.slice(7, 9),
  ];
  return groups.filter((group) => group.length > 0).join(' ');
}

/**
 * The last two digits, as a substring any written form of the number
 * contains.
 *
 * `Customer.phone` and `Inquiry.phone` are free text — one typed by a seller,
 * one by a visitor — so "+998 90 123-45-67" and "998901234567" are the same
 * number and no SQL `equals` sees it. Matching therefore happens in JS on
 * canonical digits, and this is the prefilter that keeps the scan small: the
 * final pair is written together in every form this app produces and in
 * every form a person types by hand. Anything looser scans the table;
 * anything tighter starts missing real matches.
 */
export function phoneTail(input: string): string {
  return extractNationalDigits(input).slice(7);
}

/** Masks all but the last two digits, for display on the code-entry screen. */
export function maskPhone(canonical: string): string {
  const national = extractNationalDigits(canonical);
  if (national.length !== NATIONAL_LENGTH) {
    return '';
  }
  return `+${COUNTRY_CODE} ${national.slice(0, 2)} ***-**-${national.slice(7, 9)}`;
}
