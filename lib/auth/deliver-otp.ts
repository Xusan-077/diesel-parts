import { buildOtpMessage, isEskizConfigured, sendSms } from "./eskiz";

/**
 * Sends the OTP, or — when Eskiz credentials are not configured yet — prints it
 * to the server console so local development works end to end. The code is
 * never returned to the client and never logged once Eskiz is configured.
 */
export async function deliverOtp(phone: string, code: string): Promise<{ delivered: boolean }> {
  if (!isEskizConfigured()) {
    if (process.env.NODE_ENV === "production") {
      console.error("[auth] ESKIZ_EMAIL/ESKIZ_PASSWORD are missing; no SMS was sent.");
      return { delivered: false };
    }

    console.log(`[auth] SMS disabled (no Eskiz credentials). Code for ${phone}: ${code}`);
    return { delivered: true };
  }

  const result = await sendSms(phone, buildOtpMessage(code));

  if (!result.delivered) {
    console.error(`[auth] Eskiz delivery failed for ${phone}: ${result.detail ?? result.reason}`);
  }

  return { delivered: result.delivered };
}
