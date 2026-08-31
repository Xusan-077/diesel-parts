import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SmsResult } from "./eskiz";

const sendSms = vi.fn<(phone: string, message: string) => Promise<SmsResult>>();
const isEskizConfigured = vi.fn<() => boolean>();
const buildOtpMessage = vi.fn<(code: string) => string>();

vi.mock("./eskiz", () => ({
  sendSms,
  isEskizConfigured,
  buildOtpMessage,
}));

const { deliverOtp } = await import("./deliver-otp");

const PHONE = "998901234567";
const CODE = "123456";
/** `NODE_ENV` is readonly in the Next.js types; `stubEnv` writes it anyway. */
function setNodeEnv(value: string) {
  vi.stubEnv("NODE_ENV", value as "development" | "production" | "test");
}

beforeEach(() => {
  sendSms.mockReset();
  isEskizConfigured.mockReset();
  buildOtpMessage.mockReset();
  buildOtpMessage.mockImplementation((code) => `code ${code}`);
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("deliverOtp with Eskiz configured", () => {
  beforeEach(() => {
    isEskizConfigured.mockReturnValue(true);
  });

  it("reports the failure detail so the cause reaches the log", async () => {
    setNodeEnv("production");
    sendSms.mockResolvedValue({ delivered: false, reason: "failed", detail: "account is in test mode" });

    await expect(deliverOtp(PHONE, CODE)).resolves.toEqual({ delivered: false });
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("account is in test mode"));
  });

  it("keeps local sign-in working by printing the code when Eskiz refuses", async () => {
    setNodeEnv("development");
    sendSms.mockResolvedValue({ delivered: false, reason: "failed", detail: "not in templates" });

    await expect(deliverOtp(PHONE, CODE)).resolves.toEqual({ delivered: true, devCode: CODE });
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining(CODE));
  });

  it("never prints or returns the code once Eskiz accepts it", async () => {
    setNodeEnv("development");
    sendSms.mockResolvedValue({ delivered: true });

    await expect(deliverOtp(PHONE, CODE)).resolves.toEqual({ delivered: true });
    expect(console.log).not.toHaveBeenCalled();
  });

  it("withholds the code from the response in production", async () => {
    setNodeEnv("production");
    sendSms.mockResolvedValue({ delivered: false, reason: "failed", detail: "test mode" });

    await expect(deliverOtp(PHONE, CODE)).resolves.toEqual({ delivered: false });
  });
});

describe("deliverOtp with a misconfigured template", () => {
  beforeEach(() => {
    isEskizConfigured.mockReturnValue(true);
    buildOtpMessage.mockImplementation(() => {
      throw new Error("ESKIZ_SMS_TEMPLATE has no {code} placeholder");
    });
  });

  it("never calls sendSms, and never leaks the code, in production", async () => {
    setNodeEnv("production");
    await expect(deliverOtp(PHONE, CODE)).resolves.toEqual({ delivered: false });
    expect(sendSms).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("{code}"));
  });

  it("still unblocks local development via the console fallback", async () => {
    setNodeEnv("development");
    await expect(deliverOtp(PHONE, CODE)).resolves.toEqual({ delivered: true, devCode: CODE });
    expect(sendSms).not.toHaveBeenCalled();
  });
});

describe("deliverOtp without credentials", () => {
  beforeEach(() => {
    isEskizConfigured.mockReturnValue(false);
  });

  it("prints the code in development", async () => {
    setNodeEnv("development");
    await expect(deliverOtp(PHONE, CODE)).resolves.toEqual({ delivered: true, devCode: CODE });
    expect(sendSms).not.toHaveBeenCalled();
  });

  it("fails in production rather than pretending to deliver", async () => {
    setNodeEnv("production");
    await expect(deliverOtp(PHONE, CODE)).resolves.toEqual({ delivered: false });
  });
});
