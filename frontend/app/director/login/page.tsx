import type { Metadata } from "next";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { LoginForm } from "@/components/admin/login-form";
import { ADMIN_ROOT, DIRECTOR_ROOT } from "@/lib/auth/roles";

export const metadata: Metadata = {
  title: "Kirish · Boshqaruv paneli",
  robots: { index: false, follow: false },
};

/**
 * Accepts only a path inside one of the two panels this login screen serves —
 * `/admin` for a seller, `/director` for a director, see `adminHomePath` in
 * lib/auth/roles.ts. `//evil.example` is a valid relative URL to a browser
 * and would leave the site, so the leading double slash is rejected too.
 */
function safeNext(value: string | string[] | undefined): string | null {
  if (typeof value !== "string" || value.startsWith("//")) {
    return null;
  }
  const isInsidePanel =
    value.startsWith(`${ADMIN_ROOT}/`) ||
    value === DIRECTOR_ROOT ||
    value.startsWith(`${DIRECTOR_ROOT}/`);
  return isInsidePanel ? value : null;
}

export default async function StaffLoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { next } = await searchParams;

  return (
    /*
     * The shared front door for both staff roles — a director lands here
     * most often, which is why it lives at `/director/login` rather than
     * `/admin/login`, but an admin-seller-role sign-in still posts to the
     * same form and is still sent to `/admin/seller` afterwards, same as
     * always. Built to the same minimal pattern as the standalone seller
     * panel's — see app/seller/login/page.tsx — so the two read as one
     * product's two doors rather than two different ones: a text
     * eyebrow (no logo mark), a title, a subtitle, one card, and a quiet
     * accent bloom behind it. `.site-root` puts this page in the storefront's
     * own theme (light red / dark orange, `--background`/`--surface` and the
     * rest), which is the one real difference from the seller panel — that
     * one is a separate, always-dark system by design (see the note at the
     * top of app/seller-globals.css) — so this is the one door with a theme
     * toggle, tucked in the corner rather than in a chrome bar, to keep the
     * two doors' silhouettes the same.
     */
    <main className="site-root relative isolate flex min-h-dvh items-center justify-center overflow-hidden bg-background px-4 py-12 text-foreground">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 h-[36rem] w-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent opacity-[0.08] blur-3xl"
      />

      <div className="absolute right-4 top-4">
        <ThemeToggle
          lightLabel="Yorug' rejim"
          darkLabel="Qorong'i rejim"
          className="text-muted hover:bg-surface-hover hover:text-foreground"
        />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="type-eyebrow text-accent">Diesel Parts</p>
          <h1 className="mt-2 text-2xl font-semibold text-foreground">Boshqaruv paneli</h1>
          <p className="mt-1 text-sm text-muted">Hisobingizga kiring</p>
        </div>

        <div className="rounded-lg border border-border-strong bg-surface p-6 shadow-2xl sm:p-8">
          <LoginForm next={safeNext(next)} />
        </div>
      </div>
    </main>
  );
}
