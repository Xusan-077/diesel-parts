/**
 * The customer's own details, and the pure helpers the panel reads them with.
 *
 * These fields have no column anywhere: the public site signs a visitor in by
 * SMS code alone, and `User` in the schema is staff. Until a customer record
 * exists server-side this is client-owned data, stored the same way the cart
 * and the wishlist are — see `useProfileStore` in lib/store/stores.ts. Keeping
 * the shape and the parsing here means the swap to a real endpoint later is a
 * change of transport, not a change of model.
 */

export const GENDERS = ["male", "female"] as const;

export type Gender = (typeof GENDERS)[number];

/** `""` is "not said", which is a different answer from either gender. */
export type GenderValue = Gender | "";

export interface Profile {
  firstName: string;
  lastName: string;
  /** ISO `YYYY-MM-DD`, or `""` when unset — the value an `<input type=date>` takes. */
  birthDate: string;
  gender: GenderValue;
}

export const EMPTY_PROFILE: Profile = {
  firstName: "",
  lastName: "",
  birthDate: "",
  gender: "",
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** True only for a real calendar date — `2026-02-31` is rejected, not clamped. */
export function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function readString(source: Record<string, unknown>, key: string, max: number): string {
  const value = source[key];
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/** Accepts anything read back from localStorage and returns a usable profile. */
export function parseProfile(raw: unknown): Profile {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return EMPTY_PROFILE;
  }

  const source = raw as Record<string, unknown>;
  const gender = source.gender;
  const birthDate = readString(source, "birthDate", 10);

  return {
    firstName: readString(source, "firstName", 40),
    lastName: readString(source, "lastName", 40),
    birthDate: isIsoDate(birthDate) ? birthDate : "",
    gender: GENDERS.includes(gender as Gender) ? (gender as Gender) : "",
  };
}

/** `1990-05-12` → `12.05.1990`, the form written on every Uzbek document. */
export function formatBirthDate(value: string): string {
  if (!isIsoDate(value)) {
    return "";
  }
  const [year, month, day] = value.split("-");
  return `${day}.${month}.${year}`;
}

/**
 * What the sidebar calls this person. Falls back to the phone number, because
 * a visitor who has signed in but filled nothing in still needs a name on the
 * card that is unmistakably theirs.
 */
export function profileDisplayName(profile: Profile, fallback: string): string {
  const name = [profile.firstName, profile.lastName].filter(Boolean).join(" ").trim();
  return name.length > 0 ? name : fallback;
}

/**
 * One or two letters for the avatar. Derived from the name when there is one;
 * otherwise the last two digits of the phone, which is the part of a number a
 * person recognises as their own.
 */
export function profileInitials(profile: Profile, phoneFallback: string): string {
  const letters = [profile.firstName, profile.lastName]
    .map((part) => part.trim().charAt(0))
    .filter(Boolean)
    .join("");

  if (letters.length > 0) {
    return letters.toUpperCase();
  }

  return phoneFallback.replace(/\D/g, "").slice(-2);
}
