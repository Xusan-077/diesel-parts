import axios from "axios";

const ESKIZ_BASE_URL = "https://notify.eskiz.uz/api";
/** Eskiz tokens last ~30 days; refresh early so a request never races expiry. */
const TOKEN_TTL_MS = 25 * 24 * 60 * 60 * 1000;
/** Enough of a response body to name the cause without flooding the log. */
const DETAIL_LIMIT = 300;

let cachedToken: { value: string; expiresAt: number } | null = null;

export function isEskizConfigured(): boolean {
  return Boolean(process.env.ESKIZ_EMAIL && process.env.ESKIZ_PASSWORD);
}

const DEFAULT_TEMPLATE =
  "DieselParts.uz saytiga kirish uchun tasdiqlash kodi: {code}. Kodni hech kimga bermang!";

/**
 * `{code}` is a literal substring match, not a regex group — so a template
 * that doesn't contain it (Eskiz's dashboard shows its own approved wording
 * with a sample digit sequence, e.g. "kodi: 0000", which reads as a value to
 * paste back rather than a placeholder to keep) silently sends that sample
 * unchanged instead of the real one-time code. That shipped a real OTP SMS
 * with a static, never-changing "0000" once already — see the 2026-08-24
 * incident note in docs/deploy-checklist.md. Failing loudly here means a
 * misconfigured template blocks the send (`deliverOtp` logs and reports
 * non-delivery) instead of quietly handing every user the same code.
 */
export function buildOtpMessage(code: string): string {
  const template = process.env.ESKIZ_SMS_TEMPLATE ?? DEFAULT_TEMPLATE;
  if (!template.includes("{code}")) {
    throw new Error(
      "ESKIZ_SMS_TEMPLATE has no {code} placeholder — refusing to send a static, non-OTP message. " +
        "Keep Eskiz's approved wording but replace its sample digits with the literal text \"{code}\".",
    );
  }
  return template.replace("{code}", code);
}

/** Drops the cached token, so a test starts from a cold login. */
export function resetEskizTokenCache(): void {
  cachedToken = null;
}

function truncate(text: string): string {
  return text.length > DETAIL_LIMIT ? `${text.slice(0, DETAIL_LIMIT)}…` : text;
}

/**
 * Every Eskiz rejection is explained in the response body and nowhere else: an
 * unapproved message text, a sender id that is not ours, a number the operator
 * refused, an account still in test mode. The status code names none of those,
 * so the body is what gets carried out to the log.
 */
function summarize(data: unknown): string {
  if (data === null || data === undefined || data === "") {
    return "<empty body>";
  }
  if (typeof data === "string") {
    return truncate(data);
  }
  if (typeof data === "object") {
    const { message } = data as { message?: unknown };
    if (typeof message === "string" && message.length > 0) {
      return truncate(message);
    }
  }
  try {
    return truncate(JSON.stringify(data));
  } catch {
    return "<unserializable body>";
  }
}

function describeError(error: unknown, stage: "login" | "send"): string {
  if (axios.isAxiosError(error)) {
    if (error.response) {
      return `Eskiz ${stage} failed with status ${error.response.status}: ${summarize(error.response.data)}`;
    }
    return `Eskiz ${stage} request never completed: ${error.code ?? error.message}`;
  }
  return error instanceof Error ? error.message : `Unknown Eskiz ${stage} error`;
}

async function fetchToken(): Promise<string> {
  const body = new FormData();
  body.append("email", process.env.ESKIZ_EMAIL ?? "");
  body.append("password", process.env.ESKIZ_PASSWORD ?? "");

  let data: { data?: { token?: unknown } } | undefined;
  try {
    ({ data } = await axios.post<{ data?: { token?: unknown } }>(
      `${ESKIZ_BASE_URL}/auth/login`,
      body,
    ));
  } catch (error) {
    throw new Error(describeError(error, "login"));
  }

  const token = data?.data?.token;
  if (typeof token !== "string" || token.length === 0) {
    throw new Error(`Eskiz login returned no token: ${summarize(data)}`);
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

  const { data } = await axios.post<unknown>(`${ESKIZ_BASE_URL}/message/sms/send`, body, {
    headers: { Authorization: `Bearer ${token}` },
  });

  // A refused message comes back as HTTP 200 with an error payload just as
  // often as it comes back as a 4xx, so the body decides, not the status.
  if (data && typeof data === "object" && (data as { status?: unknown }).status === "error") {
    throw new Error(`Eskiz rejected the message: ${summarize(data)}`);
  }
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
    return { delivered: false, reason: "failed", detail: describeError(error, "send") };
  }
}
