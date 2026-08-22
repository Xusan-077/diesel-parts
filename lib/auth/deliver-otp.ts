import { buildOtpMessage, isEskizConfigured, sendSms } from "./eskiz";

export interface OtpDelivery {
  delivered: boolean;
  /**
   * Set only outside production, and only when no SMS actually left the
   * server. It lets the caller say so instead of claiming a delivery that
   * never happened; production never fills it, so the code cannot leak.
   */
  devCode?: string;
}

/**
 * Sends the OTP, or — when Eskiz cannot deliver it — hands the code back for
 * development to display, and prints it to the server console. The code is
 * never returned in production, and never once Eskiz accepts the message.
 */
export async function deliverOtp(phone: string, code: string): Promise<OtpDelivery> {
  const isProduction = process.env.NODE_ENV === "production";

  if (!isEskizConfigured()) {
    if (isProduction) {
      console.error("[auth] ESKIZ_EMAIL/ESKIZ_PASSWORD are missing; no SMS was sent.");
      return { delivered: false };
    }

    console.log(`[auth] SMS disabled (no Eskiz credentials). Code for ${phone}: ${code}`);
    return { delivered: true, devCode: code };
  }

  const result = await sendSms(phone, buildOtpMessage(code));
  if (result.delivered) {
    return { delivered: true };
  }

  console.error(`[auth] Eskiz delivery failed for ${phone}: ${result.detail ?? result.reason}`);

  if (isProduction) {
    return { delivered: false };
  }

  // An Eskiz account still in test mode refuses every text outside its own
  // whitelist, which would otherwise make signing in locally impossible. The
  // refusal is already logged above; this only keeps development unblocked.
  console.log(`[auth] Falling back to the console. Code for ${phone}: ${code}`);
  return { delivered: true, devCode: code };
}
