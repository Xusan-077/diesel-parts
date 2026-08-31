import type { Metadata } from "next";
import { LoginForm } from "@/components/seller/login-form";
import { safeSellerNext } from "@/lib/seller/safe-next";

export const metadata: Metadata = {
  title: "Kirish · Seller Panel",
  robots: { index: false, follow: false },
};

export default async function SellerLoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { next } = await searchParams;

  return (
    <main className="relative isolate flex min-h-dvh items-center justify-center overflow-hidden px-4 py-12">
      {/* A quiet accent bloom behind the card — the one piece of atmosphere
          this always-dark panel gets, radial and low-opacity so it reads as
          light in the room rather than as a shape of its own. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 h-[36rem] w-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent opacity-[0.08] blur-3xl"
      />

      <div className="relative w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="seller-eyebrow text-accent">Diesel Parts</p>
          <h1 className="mt-2 text-2xl font-semibold text-foreground">Seller Panel</h1>
          <p className="mt-1 text-sm text-muted">Hisobingizga kiring</p>
        </div>

        <div className="rounded-lg border border-border-strong bg-surface p-6 shadow-2xl sm:p-8">
          <LoginForm next={safeSellerNext(next)} />
        </div>
      </div>
    </main>
  );
}
