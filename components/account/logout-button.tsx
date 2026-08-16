"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import type { Locale } from "@/lib/i18n/locales";
import { Icon } from "@/components/ui/icon";

export function LogoutButton({ lang, label }: { lang: Locale; label: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function handleLogout() {
    setSubmitting(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push(`/${lang}/account/login`);
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={submitting}
      className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm text-foreground transition-colors hover:border-accent/60 hover:text-accent-strong disabled:opacity-50"
    >
      <Icon icon={LogOut} />
      {label}
    </button>
  );
}
