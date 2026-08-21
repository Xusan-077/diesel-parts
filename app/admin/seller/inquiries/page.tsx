import { requireStaff } from "@/lib/auth/dal";
import { listInquiryBoard } from "@/lib/api/inquiry-board-repository";
import { findCustomersByPhone } from "@/lib/api/customer-repository";
import { extractNationalDigits } from "@/lib/auth/phone";
import { INQUIRY_COLUMNS, type InquiryColumn } from "@/lib/api/inquiry-board";
import {
  formatAge,
  formatArrival,
  hoursSince,
  tashkentDayKey,
  type BoardCard,
} from "@/lib/admin/inquiry-board-state";
import { InquiryBoard } from "@/components/admin/inquiry-board";
import { PageHeader } from "@/components/admin/page-header";

/**
 * The seller's board.
 *
 * A server component, and the whole of the page's data loading: the client half
 * re-reads it by calling `router.refresh()` on focus and on a timer, so there is
 * one query path rather than a server render plus a parallel client fetcher that
 * could disagree with it.
 */
export default async function SellerInquiriesPage() {
  const user = await requireStaff();
  const board = await listInquiryBoard(user);
  const now = new Date();

  /*
   * Which of the board's numbers are already in the seller's customer book.
   *
   * One query for the whole board rather than one per card, and resolved here
   * rather than in the browser so a card knows on first paint whether it is
   * offering to save a caller or to open the card that already exists.
   */
  const savedCustomers = await findCustomersByPhone(
    INQUIRY_COLUMNS.flatMap((column) => board[column].items.map((row) => row.phone)),
    user,
  );

  const cards: BoardCard[] = INQUIRY_COLUMNS.flatMap((column) =>
    board[column].items.map((row) => {
      const ageHours = hoursSince(row.createdAt, now);

      return {
        id: row.id,
        customerName: row.customerName,
        phone: row.phone,
        email: row.email,
        message: row.message,
        productId: row.productId,
        productSku: row.productSku,
        quantity: row.quantity,
        column: row.column,
        assignedSellerName: row.assignedSellerName,
        notes: row.notes,
        // Sliced in UTC, which is how the PATCH body's bare `2026-09-01` is
        // parsed on the way back in. Both ends agreeing matters more than the
        // stored instant matching a Tashkent wall clock.
        followUpAt: row.followUpAt === null ? null : row.followUpAt.toISOString().slice(0, 10),
        ageHours,
        ageLabel: formatAge(ageHours),
        createdAtLabel: formatArrival(row.createdAt),
        savedCustomer: savedCustomers.get(extractNationalDigits(row.phone)) ?? null,
      };
    }),
  );

  const totals = Object.fromEntries(
    INQUIRY_COLUMNS.map((column) => [column, board[column].total]),
  ) as Record<InquiryColumn, number>;

  return (
    <div>
      <PageHeader
        eyebrow="Sotuvchi paneli"
        title="So'rovlar"
        description="Saytdan kelgan so'rovlar. Band qilingandan keyin so'rov sizniki bo'ladi va uni boshqa sotuvchi ko'rmaydi."
      />

      <InquiryBoard
        cards={cards}
        totals={totals}
        sellerName={user.name}
        showAssignee={user.role === "DIRECTOR"}
        todayIso={tashkentDayKey(now)}
      />
    </div>
  );
}
