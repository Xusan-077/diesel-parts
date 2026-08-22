"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { signOutOfPanel } from "@/lib/admin/sign-out";
import { Button } from "@/components/ui/button";

/**
 * Sign-out as a standalone control.
 *
 * The panel's own sign-out now lives at the foot of the profile menu, where it
 * sits with the rest of "who is looking at this". This stays for the surfaces
 * that have no chrome to hang a menu on — the seller's profile screen is the
 * one `SELLER_BOTTOM_NAV` already points at — and it shares the action rather
 * than the code, so the two cannot end up handling a failed request
 * differently.
 */
export function SignOutButton({ label, busyLabel }: { label: string; busyLabel: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    toast.success(label);
    await signOutOfPanel(router);
  }

  return (
    <Button variant="outline" size="sm" onClick={signOut} disabled={busy}>
      {busy ? busyLabel : label}
    </Button>
  );
}
