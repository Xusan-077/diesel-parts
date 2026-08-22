"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { Button } from "@/components/ui/button";
import { FormModalShell } from "@/components/ui/form-modal-shell";
import { Icon } from "@/components/ui/icon";
import { useCart, useCompare, useProfile, useWishlist } from "@/hooks/use-store";

type Panel = Dictionary["account"]["profilePanel"];

/**
 * Closing the account.
 *
 * Everything this account actually consists of is the session cookie and the
 * browser-side stores behind it, so this really does delete all of it: the
 * profile, the cart, the wishlist, the compare list, and then the session. It
 * is not a request queued for someone to action later.
 */
export function AccountDeleteModal({
  panel,
  open,
  onOpenChange,
}: {
  panel: Panel;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const profile = useProfile();
  const cart = useCart();
  const wishlist = useWishlist();
  const compare = useCompare();

  async function handleDelete() {
    setSubmitting(true);

    profile.clear();
    cart.clear();
    wishlist.clear();
    compare.clear();

    try {
      await axios.post("/api/auth/logout");
    } catch {
      // Swallowed for the same reason the sign-out button swallows it: the
      // cookie either cleared or it did not, and this visitor is leaving.
    }

    toast.success(panel.deleted);
    onOpenChange(false);
    router.push("/");
    router.refresh();
  }

  return (
    <FormModalShell
      open={open}
      onOpenChange={onOpenChange}
      title={panel.deleteModalTitle}
      closeLabel={panel.close}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            {panel.cancel}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleDelete}
            disabled={submitting}
            className="border-danger text-danger hover:bg-danger-surface"
          >
            {panel.deleteConfirm}
          </Button>
        </>
      }
    >
      <p className="flex gap-3 type-body text-muted">
        <Icon icon={AlertTriangle} size="md" className="mt-0.5 shrink-0 text-danger" />
        <span>{panel.deleteModalBody}</span>
      </p>
    </FormModalShell>
  );
}
