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
    /*
     * One centred column and nothing else on the page.
     *
     * It used to be a max-w-6xl row with the form as its only child, which left
     * the whole screen weighted to the left edge with a field of empty page
     * beside it. `place-items-center` on a full-height grid is the whole layout.
     *
     * The text inside stays left-aligned against the fields' rails: centring the
     * heading too would give the column two alignment spines and set the label,
     * the input and the title all starting at different x positions.
     */
    <main className="admin-root grid min-h-dvh place-items-center bg-background px-6 py-16">
      <div className="w-full max-w-sm">
        <p className="type-eyebrow text-muted">
          Diesel Parts <span aria-hidden="true">/</span> Boshqaruv paneli
        </p>
        <h1 className="type-page mt-3 text-foreground">Kirish</h1>
        <p className="type-body mt-2 text-muted">Hisobingiz direktor tomonidan yaratiladi.</p>

        <LoginForm next={safeNext(next)} />
      </div>
    </main>
  );
}
