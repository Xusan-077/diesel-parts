import { describe, expect, it } from "vitest";
import nextConfig from "./next.config";

describe("next.config redirects", () => {
  it("sends /admin, /director, /director/*, and /admin/seller/* to /panel, permanently", async () => {
    const redirects = await nextConfig.redirects!();
    expect(redirects).toEqual(
      expect.arrayContaining([
        {
          source: "/admin/seller/:path*",
          destination: "/panel/seller/:path*",
          permanent: true,
        },
        { source: "/admin/:path*", destination: "/panel/:path*", permanent: true },
        { source: "/admin", destination: "/panel", permanent: true },
        { source: "/director", destination: "/panel", permanent: true },
        {
          source: "/director/:path((?!login).*)",
          destination: "/panel/:path*",
          permanent: true,
        },
      ]),
    );
  });

  it("keeps the /admin/seller/* rule before the general /admin/:path* one, so seller pages aren't flattened", async () => {
    const redirects = await nextConfig.redirects!();
    const sellerIndex = redirects.findIndex((r) => r.source === "/admin/seller/:path*");
    const generalIndex = redirects.findIndex((r) => r.source === "/admin/:path*");
    expect(sellerIndex).toBeGreaterThanOrEqual(0);
    expect(generalIndex).toBeGreaterThan(sellerIndex);
  });

  it("enables authInterrupts, required for next/navigation's forbidden()", () => {
    expect(nextConfig.experimental?.authInterrupts).toBe(true);
  });
});
