const ESKIZ_BASE_URL = "https://notify.eskiz.uz/api";
/** Eskiz tokens last ~30 days; refresh early so a request never races expiry. */
const TOKEN_TTL_MS = 25 * 24 * 60 * 60 * 1000;

let cachedToken: { value: string; expiresAt: number } | null = null;

export function isEskizConfigured(): boolean {
  return Boolean(process.env.ESKIZ_EMAIL && process.env.ESKIZ_PASSWORD);
}

export function buildOtpMessage(code: string): string {
  const template =
    process.env.ESKIZ_SMS_TEMPLATE ??
    "DieselParts: tasdiqlash kodi {code}. Kod 5 daqiqa amal qiladi.";
  return template.replace("{code}", code);
}

async function fetchToken(): Promise<string> {
  const body = new FormData();
  body.append("email", process.env.ESKIZ_EMAIL ?? "");
  body.append("password", process.env.ESKIZ_PASSWORD ?? "");

  const response = await fetch(`${ESKIZ_BASE_URL}/auth/login`, { method: "POST", body });
  if (!response.ok) {
    throw new Error(`Eskiz auth failed with status ${response.status}`);
  }

  const json: unknown = await response.json();
  const token = (json as { data?: { token?: unknown } })?.data?.token;
  if (typeof token !== "string" || token.length === 0) {
    throw new Error("Eskiz auth response did not contain a token");
  }
  return token;
}

async function getToken(now: number = Date.now()): Promise<string> {
  if (cachedToken && now < cachedToken.expiresAt) {
    return cachedToken.value;
  }
  const value = await fetchToken();
  cachedToken = { value, expiresAt: now + TOKEN_TTL_MS };
  return value;
}

function clearCachedToken(): void {
  cachedToken = null;
}

async function postSms(token: string, phone: string, message: string): Promise<Response> {
  const body = new FormData();
  body.append("mobile_phone", phone);
  body.append("message", message);
  body.append("from", process.env.ESKIZ_FROM ?? "4546");

  return fetch(`${ESKIZ_BASE_URL}/message/sms/send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body,
  });
}

export type SmsResult =
  | { delivered: true }
  | { delivered: false; reason: "not_configured" | "failed"; detail?: string };

/**
 * Sends one SMS through Eskiz. A 401 clears the cached token and retries once,
 * which covers a token revoked or expired ahead of our local TTL.
 */
export async function sendSms(phone: string, message: string): Promise<SmsResult> {
  if (!isEskizConfigured()) {
    return { delivered: false, reason: "not_configured" };
  }

  try {
    let response = await postSms(await getToken(), phone, message);

    if (response.status === 401) {
      clearCachedToken();
      response = await postSms(await getToken(), phone, message);
    }

    if (!response.ok) {
      return {
        delivered: false,
        reason: "failed",
        detail: `Eskiz responded with status ${response.status}`,
      };
    }

    return { delivered: true };
  } catch (error) {
    return {
      delivered: false,
      reason: "failed",
      detail: error instanceof Error ? error.message : "Unknown Eskiz error",
    };
  }
}
