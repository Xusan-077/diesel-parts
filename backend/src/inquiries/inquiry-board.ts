import { InquiryStatus } from '../../generated/prisma/client';

/**
 * The board's five columns, from four enum values.
 *
 * "Band qilingan" is not a fifth status: it is `NEW` with an assignee, and
 * "Yangi" is `NEW` without one. Claiming *is* the transition between the
 * first two columns, so the assignment field already carries the
 * distinction; a `CLAIMED` enum value would store the same fact twice and
 * would admit the illegal state "claimed by nobody".
 *
 * Ported verbatim from the root Next.js app's `lib/api/inquiry-board.ts`.
 */
export type InquiryColumn = 'new' | 'claimed' | 'in_progress' | 'won' | 'lost';

export const INQUIRY_COLUMNS: readonly InquiryColumn[] = [
  'new',
  'claimed',
  'in_progress',
  'won',
  'lost',
];

export function inquiryColumn(
  status: InquiryStatus,
  assignedSellerId: string | null,
): InquiryColumn {
  switch (status) {
    case InquiryStatus.NEW:
      return assignedSellerId === null ? 'new' : 'claimed';
    case InquiryStatus.IN_PROGRESS:
      return 'in_progress';
    case InquiryStatus.WON:
      return 'won';
    case InquiryStatus.LOST:
      return 'lost';
  }
}

/**
 * The `where` fragment a column filter adds to a listing.
 *
 * Returned rather than applied so the caller composes it with the row-level
 * scope from `common/scope.ts`; the two rules are independent and stay so.
 */
export function inquiryColumnFilter(column: InquiryColumn): {
  status: InquiryStatus;
  assignedSellerId?: null | { not: null };
} {
  switch (column) {
    case 'new':
      return { status: InquiryStatus.NEW, assignedSellerId: null };
    case 'claimed':
      return { status: InquiryStatus.NEW, assignedSellerId: { not: null } };
    case 'in_progress':
      return { status: InquiryStatus.IN_PROGRESS };
    case 'won':
      return { status: InquiryStatus.WON };
    case 'lost':
      return { status: InquiryStatus.LOST };
  }
}
