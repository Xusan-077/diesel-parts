import { requireStaff } from "@/lib/auth/dal";
import { readInquiryBoardView } from "@/lib/api/inquiry-board-view";
import { safeRead } from "@/lib/api/safe-read";
import { InquiryBoard } from "@/components/admin/inquiry-board";
import { PageHeader } from "@/components/admin/page-header";

/**
 * The seller's board.
 *
 * This read seeds the screen; the board owns it from there. Both this and the
 * board's own polling go through `readInquiryBoardView`, so the first paint and
 * every reread after it are assembled by the same code — one query path rather
 * than a server render plus a parallel client fetcher that could disagree.
 */
export default async function SellerInquiriesPage() {
  const user = await requireStaff();
  const board = await safeRead("seller inquiry board", () => readInquiryBoardView(user), undefined);

  return (
    <div>
      <PageHeader
        eyebrow="Sotuvchi paneli"
        title="So'rovlar"
        description="Saytdan kelgan so'rovlar. Band qilingandan keyin so'rov sizniki bo'ladi va uni boshqa sotuvchi ko'rmaydi."
      />

      <InquiryBoard initialData={board.data} />
    </div>
  );
}
