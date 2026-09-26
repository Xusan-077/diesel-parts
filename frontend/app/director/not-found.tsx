import Link from "next/link";
import { PanelMessage } from "@/components/admin/panel-message";
import { buttonVariants } from "@/components/ui/button";
import { PANEL_ROOT } from "@/lib/auth/roles";

/**
 * `/director`'s own 404. Almost everything that used to live under this root
 * moved to `/panel` (see the merge in
 * docs/superpowers/plans/2026-09-26-role-simplification-director-seller.md);
 * only `/director/login` remains, so this boundary now mostly catches a stale
 * bookmark to an old director-only URL that a next.config redirect didn't
 * already carry away (e.g. one with an extra segment after `/login`).
 */
export default function DirectorNotFound() {
  return (
    <PanelMessage
      eyebrow="Boshqaruv paneli"
      title="Sahifa topilmadi"
      description="Havola eskirgan bo'lishi mumkin, yoki yozuv arxivlangan va endi ochilmaydi."
      detail={<p className="type-caption mt-4 font-mono text-muted">404</p>}
      actions={
        <Link href={PANEL_ROOT} className={buttonVariants()}>
          Panelga qaytish
        </Link>
      }
    />
  );
}
