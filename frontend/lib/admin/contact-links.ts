import { toCanonicalPhone } from "@/lib/auth/phone";

/**
 * The three ways a seller reaches a lead from the card.
 *
 * An inquiry's phone is whatever the customer typed into the public form, so
 * none of this can assume a well-formed Uzbek number. `toCanonicalPhone` is
 * tried first because it is the same normaliser the OTP path uses; when it
 * refuses, the digits are handed over as typed rather than dropping the button.
 * A seller with a half-written number still wants to try dialling it.
 */

function digitsOnly(phone: string): string {
  return phone.replace(/\D/g, "");
}

export function telHref(phone: string): string | null {
  const canonical = toCanonicalPhone(phone);
  if (canonical !== null) {
    return `tel:+${canonical}`;
  }

  const digits = digitsOnly(phone);
  return digits.length === 0 ? null : `tel:${phone.startsWith("+") ? "+" : ""}${digits}`;
}

/**
 * wa.me takes digits with a country code and no plus. An incomplete number has
 * no country code to guess, so the button is withheld rather than opening
 * WhatsApp on a number that resolves to nobody.
 */
export function whatsappHref(phone: string): string | null {
  const canonical = toCanonicalPhone(phone);
  return canonical === null ? null : `https://wa.me/${canonical}`;
}

export function mailtoHref(email: string | null, subject: string): string | null {
  if (email === null || email.trim() === "") {
    return null;
  }
  return `mailto:${email}?subject=${encodeURIComponent(subject)}`;
}
