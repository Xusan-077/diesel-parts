import Link from "next/link";
import { PanelMessage } from "@/components/admin/panel-message";
import { buttonVariants } from "@/components/ui/button";
import { ADMIN_ROOT } from "@/lib/auth/roles";

/**
 * The panel's 404.
 *
 * Reached from a stale bookmark, and from every `notFound()` in the panel —
 * a product or customer id that no longer resolves. Unlike the error boundary
 * this one may point at `/admin`: a 404 means a query ran and came back empty,
 * so the database is answering and the signpost there will work.
 */
export default function AdminNotFound() {
  return (
    <PanelMessage
      eyebrow="Boshqaruv paneli"
      title="Sahifa topilmadi"
      description="Havola eskirgan bo'lishi mumkin, yoki yozuv arxivlangan va endi ochilmaydi."
      detail={<p className="type-caption mt-4 font-mono text-muted">404</p>}
      actions={
        <Link href={ADMIN_ROOT} className={buttonVariants()}>
          Panelga qaytish
        </Link>
      }
    />
  );
}
