import { afterEach, describe, expect, it, vi } from "vitest";
import { isFrameworkSignal, safeRead } from "./safe-read";

function withDigest(digest: string): Error {
  return Object.assign(new Error("control flow"), { digest });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("safeRead", () => {
  it("returns the value and ok when the read succeeds", async () => {
    await expect(safeRead("products", async () => [1, 2], [])).resolves.toEqual({
      ok: true,
      data: [1, 2],
    });
  });

  it("returns the fallback and not-ok when the read throws", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await safeRead(
      "products",
      async () => {
        throw new Error("Server has closed the connection");
      },
      [] as number[],
    );

    expect(result).toEqual({ ok: false, data: [] });
    expect(logged).toHaveBeenCalledOnce();
  });

  it("names the failing read in the log so the server log points at a section", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    await safeRead("home rows", async () => Promise.reject(new Error("boom")), null);

    expect(logged.mock.calls[0]?.[0]).toContain("home rows");
  });

  it("rethrows notFound(), so a missing row is still a 404 and not an empty page", async () => {
    await expect(
      safeRead("product", async () => Promise.reject(withDigest("NEXT_HTTP_ERROR_FALLBACK;404")), null),
    ).rejects.toThrow("control flow");
  });

  it("rethrows redirect(), so an auth redirect is never swallowed", async () => {
    await expect(
      safeRead("session", async () => Promise.reject(withDigest("NEXT_REDIRECT;replace;/login;307;")), null),
    ).rejects.toThrow("control flow");
  });

  it("rethrows the dynamic-rendering bail-out", async () => {
    await expect(
      safeRead("catalog", async () => Promise.reject(withDigest("DYNAMIC_SERVER_USAGE")), null),
    ).rejects.toThrow("control flow");
  });
});

describe("isFrameworkSignal", () => {
  it("ignores ordinary errors, including ones that merely have a digest-like field", () => {
    expect(isFrameworkSignal(new Error("connect ECONNREFUSED"))).toBe(false);
    expect(isFrameworkSignal(Object.assign(new Error("x"), { digest: "1234567890" }))).toBe(false);
    expect(isFrameworkSignal(null)).toBe(false);
    expect(isFrameworkSignal("NEXT_REDIRECT")).toBe(false);
  });

  it("recognises React's postpone signal", () => {
    expect(isFrameworkSignal({ $$typeof: Symbol.for("react.postpone") })).toBe(true);
  });
});
