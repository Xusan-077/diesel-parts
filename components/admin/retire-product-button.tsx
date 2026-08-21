"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/**
 * Retires a product. Two clicks, not a confirm() — a browser dialog blocks the
 * page and reads as a system error rather than a decision.
 */
export function RetireProductButton({ productId }: { productId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function retire() {
    setBusy(true);
    try {
      await axios.delete("/api/v1/products/" + productId);
      toast.success("Mahsulot arxivga olindi");
    } catch {
      // The list this navigates to is still the honest answer to whether it
      // retired; the toast only says the request itself did not land.
      toast.error("Arxivga olinmadi. Ro'yxatni tekshiring.");
    }
    router.push("/admin/director/products");
    router.refresh();
  }

  if (!confirming) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setConfirming(true)}>
        Arxivga olish
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <p className="text-xs text-muted">Katalogdan olib tashlansinmi?</p>
      <Button type="button" size="sm" onClick={retire} disabled={busy}>
        {busy ? "…" : "Ha, arxivga"}
      </Button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="text-xs text-muted transition-colors hover:text-foreground"
      >
        Bekor qilish
      </button>
    </div>
  );
}
