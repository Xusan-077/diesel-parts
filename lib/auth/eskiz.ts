import axios from "axios";

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

  const { data } = await axios.post<{ data?: { token?: unknown } }>(
    `${ESKIZ_BASE_URL}/auth/login`,
    body,
  );

  const token = data?.data?.token;
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

async function postSms(token: string, phone: string, message: string): Promise<void> {
  const body = new FormData();
  body.append("mobile_phone", phone);
  body.append("message", message);
  body.append("from", process.env.ESKIZ_FROM ?? "4546");

  await axios.post(`${ESKIZ_BASE_URL}/message/sms/send`, body, {
    headers: { Authorization: `Bearer ${token}` },
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
    try {
      await postSms(await getToken(), phone, message);
    } catch (error) {
      if (!axios.isAxiosError(error) || error.response?.status !== 401) {
        throw error;
      }
      clearCachedToken();
      await postSms(await getToken(), phone, message);
    }

    return { delivered: true };
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      return {
        delivered: false,
        reason: "failed",
        detail: `Eskiz responded with status ${error.response.status}`,
      };
    }

    return {
      delivered: false,
      reason: "failed",
      detail: error instanceof Error ? error.message : "Unknown Eskiz error",
    };
  }
}
