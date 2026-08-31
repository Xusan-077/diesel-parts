import { findCustomersByPhone } from "@/lib/api/customer-repository";
import { INQUIRY_COLUMNS, type InquiryColumn } from "@/lib/api/inquiry-board";
import { listInquiryBoard } from "@/lib/api/inquiry-board-repository";
import type { ScopeActor } from "@/lib/api/seller-scope";
import { extractNationalDigits } from "@/lib/auth/phone";
import {
  formatAge,
  formatArrival,
  hoursSince,
  tashkentDayKey,
  type BoardCard,
} from "@/lib/admin/inquiry-board-state";

/**
 * The board, exactly as the screen draws it.
 *
 * Everything the columns need in one shape: the cards with their derived age
 * labels, the per-column totals, and the two facts about the reader that change
 * what a card offers — their name, for the assignee line a claim writes
 * optimistically, and whether they see other sellers' leads at all.
 */
export interface InquiryBoardView {
  cards: BoardCard[];
  totals: Record<InquiryColumn, number>;
  sellerName: string;
  showAssignee: boolean;
  /** Today in Tashkent, for deciding which follow-up dates read as overdue. */
  todayIso: string;
}

/**
 * Reads and assembles the board.
 *
 * Called twice per session and from two places: the page runs it during its
 * server render to seed the screen, and `/api/v1/inquiries/board` runs it for
 * every refetch after that — the poll while the tab is open, and the reread
 * that follows every claim and move. Sharing it is what stops the two from
 * drifting: a derived field added for the seeded render but missing from the
 * refetch would show up as a card that loses its age label a minute later.
 *
 * The scope lives in the repository, never here, so neither caller can forget
 * it: a seller sees their own leads and the unclaimed pool, a director sees all.
 */
export async function readInquiryBoardView(
  user: ScopeActor & { name: string; role: string },
  now: Date = new Date(),
): Promise<InquiryBoardView> {
  const board = await listInquiryBoard(user);

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

  return {
    cards,
    totals,
    sellerName: user.name,
    showAssignee: user.role === "DIRECTOR",
    todayIso: tashkentDayKey(now),
  };
}
