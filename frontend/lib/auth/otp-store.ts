import { createHash, randomInt, timingSafeEqual } from "node:crypto";

export const OTP_LENGTH = 6;
export const OTP_TTL_MS = 5 * 60_000;
export const RESEND_COOLDOWN_MS = 60_000;
export const MAX_VERIFY_ATTEMPTS = 5;
export const MAX_SENDS_PER_WINDOW = 5;
export const SEND_WINDOW_MS = 60 * 60_000;

interface OtpEntry {
  codeHash: string;
  expiresAt: number;
  attempts: number;
  lastSentAt: number;
  sendCount: number;
  windowStartedAt: number;
}

/**
 * Process-local OTP store. Good enough for a single Node server; on serverless
 * or multi-instance hosting this must move to Redis (same function signatures).
 */
const store = new Map<string, OtpEntry>();

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

function hashesEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, "hex");
  const bufferB = Buffer.from(b, "hex");
  return bufferA.length === bufferB.length && timingSafeEqual(bufferA, bufferB);
}

function generateCode(): string {
  return randomInt(0, 10 ** OTP_LENGTH)
    .toString()
    .padStart(OTP_LENGTH, "0");
}

function toSeconds(ms: number): number {
  return Math.max(1, Math.ceil(ms / 1000));
}

/** Drops entries whose code expired *and* whose rate-limit window has elapsed. */
function prune(now: number): void {
  for (const [key, entry] of store) {
    if (now > entry.expiresAt && now - entry.windowStartedAt >= SEND_WINDOW_MS) {
      store.delete(key);
    }
  }
}

export type RequestCodeResult =
  | { ok: true; code: string; expiresInSeconds: number; resendAfterSeconds: number }
  | { ok: false; reason: "cooldown" | "rate_limited"; retryAfterSeconds: number };

export function requestCode(phone: string, now: number = Date.now()): RequestCodeResult {
  prune(now);
  const existing = store.get(phone);

  if (existing) {
    const windowActive = now - existing.windowStartedAt < SEND_WINDOW_MS;

    if (windowActive && existing.sendCount >= MAX_SENDS_PER_WINDOW) {
      return {
        ok: false,
        reason: "rate_limited",
        retryAfterSeconds: toSeconds(existing.windowStartedAt + SEND_WINDOW_MS - now),
      };
    }

    const sinceLastSend = now - existing.lastSentAt;
    if (sinceLastSend < RESEND_COOLDOWN_MS) {
      return {
        ok: false,
        reason: "cooldown",
        retryAfterSeconds: toSeconds(RESEND_COOLDOWN_MS - sinceLastSend),
      };
    }
  }

  const windowIsOpen = existing !== undefined && now - existing.windowStartedAt < SEND_WINDOW_MS;
  const code = generateCode();

  store.set(phone, {
    codeHash: hashCode(code),
    expiresAt: now + OTP_TTL_MS,
    attempts: 0,
    lastSentAt: now,
    sendCount: windowIsOpen ? existing.sendCount + 1 : 1,
    windowStartedAt: windowIsOpen ? existing.windowStartedAt : now,
  });

  return {
    ok: true,
    code,
    expiresInSeconds: OTP_TTL_MS / 1000,
    resendAfterSeconds: RESEND_COOLDOWN_MS / 1000,
  };
}

export type VerifyCodeResult =
  | { ok: true }
  | { ok: false; reason: "not_found" | "expired" | "too_many_attempts" }
  | { ok: false; reason: "invalid"; attemptsLeft: number };

export function verifyCode(
  phone: string,
  code: string,
  now: number = Date.now()
): VerifyCodeResult {
  const entry = store.get(phone);

  if (!entry) {
    return { ok: false, reason: "not_found" };
  }

  if (now > entry.expiresAt) {
    store.delete(phone);
    return { ok: false, reason: "expired" };
  }

  if (entry.attempts >= MAX_VERIFY_ATTEMPTS) {
    store.delete(phone);
    return { ok: false, reason: "too_many_attempts" };
  }

  entry.attempts += 1;

  if (!hashesEqual(entry.codeHash, hashCode(code))) {
    const attemptsLeft = MAX_VERIFY_ATTEMPTS - entry.attempts;
    if (attemptsLeft <= 0) {
      store.delete(phone);
      return { ok: false, reason: "too_many_attempts" };
    }
    return { ok: false, reason: "invalid", attemptsLeft };
  }

  // Codes are single-use.
  store.delete(phone);
  return { ok: true };
}

/** Test-only hook; production code never needs to clear the whole store. */
export function resetOtpStore(): void {
  store.clear();
}
