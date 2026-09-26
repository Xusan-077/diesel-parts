import Link from "next/link";
import { PanelMessage } from "@/components/admin/panel-message";
import { buttonVariants } from "@/components/ui/button";
import { PANEL_ROOT } from "@/lib/auth/roles";

/**
 * Rendered by Next's `forbidden()` (see `next.config.ts`'s `experimental.authInterrupts`)
 * whenever `requirePermission()` in lib/auth/dal.ts denies a signed-in user —
 * a SELLER hitting finance, analytics, users, audit, or any other
 * director-only page by URL. They are signed in and the page is real, so a
 * 403 reads truer here than either a login bounce or a silent redirect.
 */
export default function PanelForbidden() {
  return (
    <PanelMessage
      eyebrow="Boshqaruv paneli"
      title="Ruxsat yo'q"
      description="Ushbu bo'limga kirish huquqingiz yo'q. Kerak bo'lsa, direktordan so'rang."
      actions={
        <Link href={PANEL_ROOT} className={buttonVariants()}>
          Panelga qaytish
        </Link>
      }
    />
  );
}
