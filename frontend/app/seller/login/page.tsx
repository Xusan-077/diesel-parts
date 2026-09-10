import type { Metadata } from "next";
import { AuthThemeToggle } from "@/components/auth-theme-toggle";
import { LoginForm } from "@/components/login-form";
import { safeSellerNext } from "@/lib/seller/safe-next";

export const metadata: Metadata = {
  title: "Kirish · Sotuvchi paneli",
  robots: { index: false, follow: false },
};

export default async function SellerLoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { next } = await searchParams;

  /*
   * The same centred shadcn card the director screen renders, and now the
   * same behaviour: `auth-scene` is the standalone shadcn token scope
   * (mirrored in app/seller-globals.css) carrying both a light and a dark
   * set, and which one paints follows the `dark` class `ThemeProvider` (added
   * to app/seller/layout.tsx for this page) puts on `<html>` — the same store
   * the corner `AuthThemeToggle` writes to. The authenticated seller panel
   * stays dark-only regardless; see the layout note.
   */
  return (
    <main className="auth-scene relative flex min-h-dvh items-center justify-center bg-background px-4 py-12 text-foreground">
      <div className="absolute right-4 top-4">
        <AuthThemeToggle />
      </div>
      <LoginForm role="seller" next={safeSellerNext(next)} />
    </main>
  );
}
