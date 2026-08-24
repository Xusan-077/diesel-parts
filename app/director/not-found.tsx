import Link from "next/link";
import { PanelMessage } from "@/components/admin/panel-message";
import { buttonVariants } from "@/components/ui/button";
import { DIRECTOR_ROOT } from "@/lib/auth/roles";

/**
 * The director panel's 404. Copied from app/admin/not-found.tsx — a root
 * layout needs its own not-found boundary, and "back to the panel" here means
 * `/director`, this root's own home, rather than `/admin`.
 */
export default function DirectorNotFound() {
  return (
    <PanelMessage
      eyebrow="Direktor paneli"
      title="Sahifa topilmadi"
      description="Havola eskirgan bo'lishi mumkin, yoki yozuv arxivlangan va endi ochilmaydi."
      detail={<p className="type-caption mt-4 font-mono text-muted">404</p>}
      actions={
        <Link href={DIRECTOR_ROOT} className={buttonVariants()}>
          Panelga qaytish
        </Link>
      }
    />
  );
}
