"use client";

import { useEffect } from "react";
import Link from "next/link";
import { PanelMessage } from "@/components/admin/panel-message";
import { Button, buttonVariants } from "@/components/ui/button";
import { STAFF_LOGIN_PATH } from "@/lib/auth/roles";

/**
 * `/director`'s own error boundary. Almost everything that used to live under
 * this root moved to `/panel` (see the merge in
 * docs/superpowers/plans/2026-09-26-role-simplification-director-seller.md);
 * only `/director/login` remains, which touches no database, so this mostly
 * exists for symmetry with `not-found.tsx` and Next's requirement that a root
 * layout carry its own boundaries.
 */
export default function DirectorError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <PanelMessage
      eyebrow="Direktor paneli"
      title="Sahifa ochilmadi"
      description="Ma'lumotlarni o'qib bo'lmadi. Odatda bu vaqtinchalik — qayta urinib ko'ring. Takrorlansa, xato kodini administratorga ayting."
      detail={
        process.env.NODE_ENV === "development" ? (
          <pre className="mt-4 max-h-32 overflow-y-auto rounded-md bg-surface-muted p-3 font-mono text-xs break-words whitespace-pre-wrap text-muted">
            {error.message}
          </pre>
        ) : error.digest ? (
          <p className="type-caption mt-4 font-mono text-muted">Xato kodi: {error.digest}</p>
        ) : null
      }
      actions={
        <>
          <Button type="button" onClick={reset}>
            Qayta urinish
          </Button>
          <Link href={STAFF_LOGIN_PATH} className={buttonVariants({ variant: "outline" })}>
            Kirish sahifasi
          </Link>
        </>
      }
    />
  );
}
