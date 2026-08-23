import type { Metadata } from "next";
import { LoginForm } from "@/components/seller/login-form";

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
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-md border border-border bg-surface p-6 shadow-2xl">
        <div className="mb-6">
          <p className="seller-eyebrow text-accent">Diesel Parts</p>
          <h1 className="mt-1 text-xl font-semibold text-foreground">Seller Panel</h1>
        </div>
        <LoginForm next={typeof next === "string" ? next : null} />
      </div>
    </main>
  );
}
