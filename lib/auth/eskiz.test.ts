import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const post = vi.fn();

vi.mock("axios", () => {
  const isAxiosError = (error: unknown): boolean =>
    Boolean(error && typeof error === "object" && (error as { isAxiosError?: boolean }).isAxiosError);
  return { default: { post, isAxiosError }, isAxiosError };
});

const { isEskizConfigured, resetEskizTokenCache, sendSms } = await import("./eskiz");

const PHONE = "998901234567";
const MESSAGE = "DieselParts: tasdiqlash kodi 1234.";
const LOGIN_OK = { data: { data: { token: "token-1" } } };

/** Shapes a rejection the way axios reports one, so `isAxiosError` sees it. */
function axiosError(status: number, data: unknown) {
  return Object.assign(new Error(`Request failed with status code ${status}`), {
    isAxiosError: true,
    response: { status, data },
  });
}

beforeEach(() => {
  post.mockReset();
  resetEskizTokenCache();
  process.env.ESKIZ_EMAIL = "sender@example.com";
  process.env.ESKIZ_PASSWORD = "api-password";
});

afterEach(() => {
  delete process.env.ESKIZ_EMAIL;
  delete process.env.ESKIZ_PASSWORD;
});

describe("isEskizConfigured", () => {
  it("is false when the password is missing", () => {
    delete process.env.ESKIZ_PASSWORD;
    expect(isEskizConfigured()).toBe(false);
  });
});

describe("sendSms", () => {
  it("reports why Eskiz refused, not just the status code", async () => {
    post.mockResolvedValueOnce(LOGIN_OK);
    post.mockRejectedValueOnce(
      axiosError(400, { status: "error", message: "message text not found in templates" }),
    );

    const result = await sendSms(PHONE, MESSAGE);

    expect(result).toMatchObject({ delivered: false, reason: "failed" });
    expect(result).toHaveProperty("detail", expect.stringContaining("not found in templates"));
    expect(result).toHaveProperty("detail", expect.stringContaining("400"));
  });

  it("treats a 200 response carrying an error payload as a failure", async () => {
    post.mockResolvedValueOnce(LOGIN_OK);
    post.mockResolvedValueOnce({ data: { status: "error", message: "sender name is not approved" } });

    const result = await sendSms(PHONE, MESSAGE);

    expect(result).toMatchObject({ delivered: false, reason: "failed" });
    expect(result).toHaveProperty("detail", expect.stringContaining("sender name is not approved"));
  });

  it("accepts the queued response Eskiz returns on success", async () => {
    post.mockResolvedValueOnce(LOGIN_OK);
    post.mockResolvedValueOnce({ data: { id: "1", status: "waiting", message: "Waiting for SMS provider" } });

    await expect(sendSms(PHONE, MESSAGE)).resolves.toEqual({ delivered: true });
  });

  it("logs in once and reuses the token across sends", async () => {
    post.mockResolvedValueOnce(LOGIN_OK);
    post.mockResolvedValue({ data: { status: "waiting" } });

    await sendSms(PHONE, MESSAGE);
    await sendSms(PHONE, MESSAGE);

    const logins = post.mock.calls.filter(([url]) => String(url).endsWith("/auth/login"));
    expect(logins).toHaveLength(1);
  });

  it("re-logs in and retries once when the cached token is rejected", async () => {
    post.mockResolvedValueOnce(LOGIN_OK);
    post.mockRejectedValueOnce(axiosError(401, { message: "Unauthorized" }));
    post.mockResolvedValueOnce({ data: { data: { token: "token-2" } } });
    post.mockResolvedValueOnce({ data: { status: "waiting" } });

    await expect(sendSms(PHONE, MESSAGE)).resolves.toEqual({ delivered: true });

    const lastSend = post.mock.calls.at(-1);
    expect(lastSend?.[2]).toMatchObject({ headers: { Authorization: "Bearer token-2" } });
  });

  it("explains a login rejection instead of hiding it behind a generic message", async () => {
    post.mockRejectedValueOnce(axiosError(401, { message: "Invalid credentials" }));

    const result = await sendSms(PHONE, MESSAGE);

    expect(result).toHaveProperty("detail", expect.stringContaining("Invalid credentials"));
  });

  it("explains a login response that carries no token", async () => {
    post.mockResolvedValueOnce({ data: { message: "user not found" } });

    const result = await sendSms(PHONE, MESSAGE);

    expect(result).toHaveProperty("detail", expect.stringContaining("user not found"));
  });

  it("reports a network failure that never reached Eskiz", async () => {
    post.mockRejectedValueOnce(
      Object.assign(new Error("getaddrinfo ENOTFOUND"), { isAxiosError: true, code: "ENOTFOUND" }),
    );

    const result = await sendSms(PHONE, MESSAGE);

    expect(result).toHaveProperty("detail", expect.stringContaining("ENOTFOUND"));
  });

  it("does not call Eskiz at all when credentials are missing", async () => {
    delete process.env.ESKIZ_EMAIL;

    await expect(sendSms(PHONE, MESSAGE)).resolves.toEqual({
      delivered: false,
      reason: "not_configured",
    });
    expect(post).not.toHaveBeenCalled();
  });
});
