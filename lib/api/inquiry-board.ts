import type { InquiryStatus } from "@/prisma/generated/prisma/enums";

/**
 * The board's five columns, from four enum values.
 *
 * "Band qilingan" is not a fifth status: it is `NEW` with an assignee, and
 * "Yangi" is `NEW` without one. Claiming *is* the transition between the first
 * two columns, so the assignment field already carries the distinction; a
 * `CLAIMED` enum value would store the same fact twice and would admit the
 * illegal state "claimed by nobody".
 */
export type InquiryColumn = "new" | "claimed" | "in_progress" | "won" | "lost";

export const INQUIRY_COLUMNS: readonly InquiryColumn[] = [
  "new",
  "claimed",
  "in_progress",
  "won",
  "lost",
];

export function inquiryColumn(
  status: InquiryStatus,
  assignedSellerId: string | null,
): InquiryColumn {
  switch (status) {
    case "NEW":
      return assignedSellerId === null ? "new" : "claimed";
    case "IN_PROGRESS":
      return "in_progress";
    case "WON":
      return "won";
    case "LOST":
      return "lost";
  }
}

/**
 * The `where` fragment a column filter adds to a listing.
 *
 * Returned rather than applied so the caller composes it with the row-level
 * scope from `seller-scope.ts`; the two rules are independent and stay so.
 */
export function inquiryColumnFilter(column: InquiryColumn): {
  status: InquiryStatus;
  assignedSellerId?: null | { not: null };
} {
  switch (column) {
    case "new":
      return { status: "NEW", assignedSellerId: null };
    case "claimed":
      return { status: "NEW", assignedSellerId: { not: null } };
    case "in_progress":
      return { status: "IN_PROGRESS" };
    case "won":
      return { status: "WON" };
    case "lost":
      return { status: "LOST" };
  }
}
