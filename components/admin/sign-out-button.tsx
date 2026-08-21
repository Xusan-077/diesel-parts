"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    try {
      await axios.post("/api/v1/auth/logout");
    } catch {
      // Swallowed on purpose: the cookie either cleared or it did not, and
      // either way the seller is leaving the panel.
    } finally {
      toast.success("Paneldan chiqdingiz");
      router.replace("/admin/login");
      router.refresh();
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={signOut} disabled={busy}>
      {busy ? "Chiqilmoqda…" : "Chiqish"}
    </Button>
  );
}
