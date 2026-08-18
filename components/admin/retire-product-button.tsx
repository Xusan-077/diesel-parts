"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
    await fetch("/api/v1/products/" + productId, { method: "DELETE" });
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
