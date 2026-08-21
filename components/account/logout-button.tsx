"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { toast } from "sonner";
import { LogOut } from "lucide-react";
import { Icon } from "@/components/ui/icon";

export function LogoutButton({ label, signedOutLabel }: { label: string; signedOutLabel: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function handleLogout() {
    setSubmitting(true);
    try {
      await axios.post("/api/auth/logout");
    } catch {
      // Swallowed on purpose: the cookie either cleared or it did not, and
      // either way the visitor is leaving this screen.
    } finally {
      toast.success(signedOutLabel);
      router.push("/account/login");
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
