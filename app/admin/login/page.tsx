import type { Metadata } from "next";
import { LoginForm } from "@/components/admin/login-form";
import { ADMIN_ROOT } from "@/lib/auth/roles";

export const metadata: Metadata = {
  title: "Kirish · Boshqaruv paneli",
  robots: { index: false, follow: false },
};

/**
 * Accepts only a path inside the panel. `//evil.example` is a valid relative
 * URL to a browser and would leave the site, so the leading double slash is
 * rejected as well as anything outside /admin.
 */
function safeNext(value: string | string[] | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const isInsidePanel = value.startsWith(`${ADMIN_ROOT}/`) && !value.startsWith("//");
  return isInsidePanel ? value : null;
}

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { next } = await searchParams;

  return (
    <main className="min-h-dvh bg-background px-6 py-16 sm:px-10 lg:px-20">
      <div className="mx-auto flex min-h-[calc(100dvh-8rem)] max-w-6xl items-center">
        <div className="w-full max-w-sm">
          <p className="font-mono text-[0.6875rem] uppercase tracking-[0.2em] text-muted">
            Diesel Parts <span aria-hidden="true">/</span> Boshqaruv paneli
          </p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground">Kirish</h1>
          <p className="mt-2 text-sm text-muted">Hisobingiz direktor tomonidan yaratiladi.</p>
          <LoginForm next={safeNext(next)} />
        </div>
      </div>
    </main>
  );
}
