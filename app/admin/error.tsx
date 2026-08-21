"use client";

import { useEffect } from "react";
import Link from "next/link";
import { PanelMessage } from "@/components/admin/panel-message";
import { Button, buttonVariants } from "@/components/ui/button";
import { ADMIN_LOGIN_PATH } from "@/lib/auth/roles";

/**
 * What a staff member sees when a panel page throws.
 *
 * Without this the panel answered an unreachable database with Next's raw
 * "This page couldn't load" screen: no theme, no wording, and no way to tell
 * whether you had been signed out, whether the tool was broken, or whether it
 * was worth trying again in a minute.
 *
 * The escape hatch is the login screen, not `/admin`. `/admin` calls
 * `requireStaff()`, which reads the user row — so on the failure this boundary
 * exists for it would throw straight back into here. The login page touches no
 * database at all and is the one panel route that always renders.
 */
export default function AdminError({
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
      eyebrow="Boshqaruv paneli"
      title="Sahifa ochilmadi"
      description="Ma'lumotlarni o'qib bo'lmadi. Odatda bu vaqtinchalik — qayta urinib ko'ring. Takrorlansa, xato kodini administratorga ayting."
      detail={
        /*
         * Two different readers.
         *
         * In production Next replaces the message with an opaque digest, and
         * that digest is the only thing tying this screen to a server log line,
         * so it is shown rather than swallowed — one quiet caption.
         *
         * In development the real message is here, and Prisma's runs to a dozen
         * lines of mangled Turbopack module path with the one sentence that
         * matters ("Server has closed the connection") at the very bottom.
         * Printed as body copy it buried the two buttons. It goes in a scrolling
         * well instead: nothing is hidden, but it reads as a debug panel and
         * cannot push the page around.
         */
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
          <Link href={ADMIN_LOGIN_PATH} className={buttonVariants({ variant: "outline" })}>
            Kirish sahifasi
          </Link>
        </>
      }
    />
  );
}
