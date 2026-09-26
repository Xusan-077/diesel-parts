import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for next/navigation's forbidden()/forbidden.tsx, used by
  // lib/auth/dal.ts's requirePermission() for panel pages a SELLER lacks the
  // permission for.
  experimental: {
    authInterrupts: true,
  },
  async redirects() {
    return [
      // `/admin/seller/*` kept the `seller/` segment when it moved — the
      // pages live at `/panel/seller/*`, not flattened into `/panel/*` (see
      // app/panel/seller). This specific rule must come before the general
      // `/admin/:path*` one below, since both would otherwise match and
      // Next takes the first.
      { source: "/admin/seller/:path*", destination: "/panel/seller/:path*", permanent: true },
      // Catches `/admin` itself and any other stray `/admin/*` address —
      // `app/admin` no longer exists at all, so nothing is left to fall
      // through to if this doesn't cover a path.
      { source: "/admin/:path*", destination: "/panel/:path*", permanent: true },
      { source: "/admin", destination: "/panel", permanent: true },
      { source: "/director", destination: "/panel", permanent: true },
      // `((?!login).*)` excludes `/director/login` from this rule — it's the
      // one page still served directly under `/director`, not moved to
      // `/panel` (see app/director/login).
      {
        source: "/director/:path((?!login).*)",
        destination: "/panel/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
