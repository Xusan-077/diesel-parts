import type { Metadata } from "next";
import { AuthThemeToggle } from "@/components/auth-theme-toggle";
import { LoginForm } from "@/components/login-form";
import { ADMIN_ROOT, DIRECTOR_ROOT } from "@/lib/auth/roles";

export const metadata: Metadata = {
  title: "Kirish · Direktor paneli",
  robots: { index: false, follow: false },
};

/**
 * Accepts only a path inside one of the two panels this login screen serves —
 * `/admin` for an admin-seller-role visitor, `/director` for a director.
 * `//evil.example` is a valid relative URL to a browser and would leave the
 * site, so the leading double slash is rejected too.
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

export default async function DirectorLoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { next } = await searchParams;

  /*
   * A single centred shadcn card, nothing behind it. `auth-scene` is the
   * standalone shadcn token scope (see app/globals.css) that gives the card
   * its `--background` / `--card` / `--primary` / `--border` / `--input` /
   * `--ring` values, and it now carries both a light and a dark set. Which
   * one paints follows the `dark` class `ThemeProvider` puts on `<html>` —
   * the same store the corner `AuthThemeToggle` writes to — so this screen
   * honours the director's theme choice instead of being pinned dark.
   */
  return (
    <main className="auth-scene relative flex min-h-dvh items-center justify-center bg-background px-4 py-12 text-foreground">
      <div className="absolute right-4 top-4">
        <AuthThemeToggle />
      </div>
      <LoginForm role="director" next={safeNext(next)} />
    </main>
  );
}
