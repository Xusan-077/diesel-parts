import { INQUIRY_COLUMNS, type InquiryColumn } from "@/lib/api/inquiry-board";
import { MONTHS_SHORT } from "@/lib/analytics/format";
import type { InquiryStatus } from "@/prisma/generated/prisma/enums";

/**
 * The board's client-side state, as pure functions.
 *
 * The board shows a server-rendered list and lets a seller move cards before the
 * server has agreed. That optimism is the only stateful thing on the page, so it
 * lives here rather than inside the component: the interesting cases — a claim
 * lost to another seller, a refresh landing while a move is still in flight — are
 * all reachable from a plain function call, and none of them need a browser.
 */

/** One card, already serialised for the client. Dates arrive as strings. */
export interface BoardCard {
  id: string;
  customerName: string;
  phone: string;
  email: string | null;
  message: string;
  productId: string | null;
  productSku: string | null;
  quantity: number | null;
  column: InquiryColumn;
  assignedSellerName: string | null;
  notes: string | null;
  /** `YYYY-MM-DD`, the form a date input reads and writes. Null when unset. */
  followUpAt: string | null;
  /**
   * Hours since the lead arrived, measured on the server.
   *
   * The card renders its age from this rather than from `Date.now()` in the
   * browser: a clock read during hydration disagrees with the one the server
   * rendered with, and React reports that as an error. Polling re-renders the
   * page anyway, so the number stays honest.
   */
  ageHours: number;
  /** "4 soat", "2 kun" — formatted on the server, for the same reason. */
  ageLabel: string;
  /** The absolute arrival date, for the cases where "2 kun" is not enough. */
  createdAtLabel: string;
  /**
   * The customer card this number already has, if any.
   *
   * Resolved on the server by matching the phone, because `Inquiry` holds no
   * customer foreign key — a lead arrives before anybody knows whose account it
   * belongs to. Null means the number is new to the seller's book, which is the
   * only state where saving it is offered.
   */
  savedCustomer: { id: string; name: string } | null;
}

/** The fields a seller can move without a reload. */
export type CardPatch = Partial<
  Pick<BoardCard, "column" | "assignedSellerName" | "notes" | "followUpAt">
>;

/**
 * Pending moves, keyed by card id.
 *
 * A patch, not a replacement card: two edits to the same lead — dropping a note
 * and setting a callback date — must not overwrite each other, and a refresh
 * that settles one has to leave the other standing.
 */
export type BoardOverlay = Readonly<Record<string, CardPatch>>;

export const EMPTY_OVERLAY: BoardOverlay = {};

export function patchCard(overlay: BoardOverlay, id: string, patch: CardPatch): BoardOverlay {
  return { ...overlay, [id]: { ...overlay[id], ...patch } };
}

/** Rolls a card back to whatever the server last said — the failure path. */
export function dropPatch(overlay: BoardOverlay, id: string): BoardOverlay {
  if (!(id in overlay)) {
    return overlay;
  }
  const next = { ...overlay };
  delete next[id];
  return next;
}

export function applyOverlay(cards: readonly BoardCard[], overlay: BoardOverlay): BoardCard[] {
  return cards.map((card) => (card.id in overlay ? { ...card, ...overlay[card.id] } : card));
}

/**
 * Forgets the patches the server has caught up with.
 *
 * Without this the overlay would win forever, and a card another seller stole
 * would keep showing this seller's optimistic claim through every refresh. A
 * patch survives only while it still says something the server has not: a card
 * that vanished from the listing entirely is settled too, since there is nothing
 * left to overlay.
 *
 * Returns the same object when nothing was dropped, so a caller can hand the
 * result straight to `setState` without scheduling a re-render for a no-op.
 */
export function pruneSettled(overlay: BoardOverlay, cards: readonly BoardCard[]): BoardOverlay {
  const byId = new Map(cards.map((card) => [card.id, card]));
  const next: Record<string, CardPatch> = {};
  let dropped = false;

  for (const [id, patch] of Object.entries(overlay)) {
    const card = byId.get(id);
    const settled =
      card === undefined ||
      (Object.entries(patch) as [keyof CardPatch, CardPatch[keyof CardPatch]][]).every(
        ([field, value]) => card[field] === value,
      );

    if (settled) {
      dropped = true;
    } else {
      next[id] = patch;
    }
  }

  return dropped ? next : overlay;
}

export type BoardColumns = Record<InquiryColumn, BoardCard[]>;

export function groupByColumn(cards: readonly BoardCard[]): BoardColumns {
  const columns = Object.fromEntries(
    INQUIRY_COLUMNS.map((column) => [column, [] as BoardCard[]]),
  ) as BoardColumns;

  for (const card of cards) {
    columns[card.column].push(card);
  }

  return columns;
}

export const COLUMN_LABELS: Record<InquiryColumn, string> = {
  new: "Yangi",
  claimed: "Band qilingan",
  in_progress: "Jarayonda",
  won: "Yutildi",
  lost: "Yo'qotildi",
};

/** What an empty column should say. Never "0 ta" — a count is not an answer. */
export const COLUMN_EMPTY_TEXT: Record<InquiryColumn, string> = {
  new: "Yangi so'rov yo'q. Saytdan so'rov kelganda shu yerda paydo bo'ladi.",
  claimed: "Band qilingan so'rov yo'q.",
  in_progress: "Jarayondagi so'rov yo'q.",
  won: "Hali yutilgan so'rov yo'q.",
  lost: "Yo'qotilgan so'rov yo'q.",
};

/**
 * One stage's ink as a badge.
 *
 * Only the two stages that are a *verdict* take a status colour. "Yangi",
 * "Band qilingan" and "Jarayonda" are places in a pipeline, not judgements, and
 * inking them would leave a list where every row shouts. What a live lead needs
 * said about it — how long it has waited — is said by the rail down its left
 * edge and by the words printed beside it.
 */
export const STAGE_TONE: Record<InquiryColumn, "default" | "success" | "danger"> = {
  new: "default",
  claimed: "default",
  in_progress: "default",
  won: "success",
  lost: "danger",
};

/** The three stages where the lead is still somebody's job. */
export const OPEN_COLUMNS: readonly InquiryColumn[] = ["new", "claimed", "in_progress"];

/**
 * What the list can be narrowed to.
 *
 * "Ochiq" is not a sixth stage — it is the three live ones together, and it is
 * where the screen opens. Two reasons. It is the only view that answers "what
 * is on my plate", which is the question the screen exists for; and it is the
 * one view where claiming a lead does not make it vanish, because the row stays
 * on screen and only its badge changes.
 */
export type InquiryFilter = "open" | InquiryColumn;

export const INQUIRY_FILTERS: readonly InquiryFilter[] = ["open", ...INQUIRY_COLUMNS];

export const FILTER_LABELS: Record<InquiryFilter, string> = {
  open: "Ochiq",
  ...COLUMN_LABELS,
};

export const FILTER_EMPTY_TEXT: Record<InquiryFilter, string> = {
  open: "Ochiq so'rov yo'q. Saytdan so'rov kelganda shu yerda paydo bo'ladi.",
  ...COLUMN_EMPTY_TEXT,
};

/** Which stages a filter draws from. One each, except "Ochiq". */
export function filterColumns(filter: InquiryFilter): readonly InquiryColumn[] {
  return filter === "open" ? OPEN_COLUMNS : [filter];
}

const COLUMN_RANK = Object.fromEntries(
  INQUIRY_COLUMNS.map((column, index) => [column, index]),
) as Record<InquiryColumn, number>;

/**
 * The order the list is worked in.
 *
 * Stage first, so a mixed view reads top to bottom the way the pipeline runs:
 * nobody's leads, then the ones in hand, then what is already decided. Within a
 * live stage the longest wait leads — that is the only ordering that puts the
 * lead most at risk of being lost where the eye starts. Closed stages invert
 * it, because a deal won in March is not more interesting than one won
 * yesterday.
 *
 * Ties break on id so the order is total: two leads that arrived in the same
 * millisecond must not swap places between two renders of the same data.
 */
export function compareCards(a: BoardCard, b: BoardCard): number {
  const stage = COLUMN_RANK[a.column] - COLUMN_RANK[b.column];
  if (stage !== 0) {
    return stage;
  }

  const closed = a.column === "won" || a.column === "lost";
  const age = closed ? a.ageHours - b.ageHours : b.ageHours - a.ageHours;
  return age !== 0 ? age : a.id.localeCompare(b.id);
}

export interface BoardMove {
  status: InquiryStatus;
  /** Where the card lands. Derived here so the optimistic patch is one value. */
  column: InquiryColumn;
  label: string;
  /** The one move worth leading with; the rest are quieter. */
  primary: boolean;
}

const TO_IN_PROGRESS = { status: "IN_PROGRESS", column: "in_progress" } as const;
const TO_WON = { status: "WON", column: "won" } as const;
const TO_LOST = { status: "LOST", column: "lost" } as const;

/**
 * The moves offered on a card, per column.
 *
 * "Yangi" offers none: an unclaimed lead is nobody's to move, and the write
 * scope refuses a seller who tries. Claiming is the only way out of that column
 * and it has its own button and its own endpoint.
 */
export function movesFor(column: InquiryColumn): BoardMove[] {
  switch (column) {
    case "new":
      return [];
    case "claimed":
      return [
        { ...TO_IN_PROGRESS, label: "Jarayonga o'tkazish", primary: true },
        { ...TO_WON, label: "Yutildi", primary: false },
        { ...TO_LOST, label: "Yo'qotildi", primary: false },
      ];
    case "in_progress":
      return [
        { ...TO_WON, label: "Yutildi", primary: true },
        { ...TO_LOST, label: "Yo'qotildi", primary: false },
      ];
    case "won":
      return [{ ...TO_IN_PROGRESS, label: "Jarayonga qaytarish", primary: false }];
    case "lost":
      return [{ ...TO_IN_PROGRESS, label: "Qayta ochish", primary: false }];
  }
}

/**
 * How overdue a lead is, as a step on the card's left rule.
 *
 * Only the two columns where nobody has picked the lead up yet carry the
 * warning: once a seller is working it, elapsed time is the job rather than a
 * failure, and once it is won or lost the clock means nothing at all. A device
 * that kept colouring closed cards would be decoration.
 */
export type AgeStep = "fresh" | "waiting" | "stale" | "cold" | "quiet";

export function ageStep(ageHours: number, column: InquiryColumn): AgeStep {
  if (column === "won" || column === "lost" || column === "in_progress") {
    return "quiet";
  }
  if (ageHours < 4) {
    return "fresh";
  }
  if (ageHours < 24) {
    return "waiting";
  }
  if (ageHours < 72) {
    return "stale";
  }
  return "cold";
}

/** Said out loud, because the rule's colour must not be the only carrier. */
export const AGE_STEP_TEXT: Record<AgeStep, string | null> = {
  fresh: null,
  waiting: null,
  stale: "kutmoqda",
  cold: "javobsiz",
  quiet: null,
};

const HOUR_MS = 60 * 60 * 1000;

export function hoursSince(createdAt: Date, now: Date): number {
  return Math.max(0, (now.getTime() - createdAt.getTime()) / HOUR_MS);
}

/**
 * How long the lead has waited, in the coarsest unit that still says something.
 *
 * A seller scanning a column needs "kecha" or "3 kun", not "71 soat 12 daqiqa";
 * the exact arrival date is on the card as well for the rare case that matters.
 */
export function formatAge(ageHours: number): string {
  if (ageHours < 1) {
    const minutes = Math.floor(ageHours * 60);
    return minutes < 1 ? "hozir" : `${minutes} daqiqa`;
  }
  if (ageHours < 24) {
    return `${Math.floor(ageHours)} soat`;
  }

  const days = Math.floor(ageHours / 24);
  if (days < 30) {
    return `${days} kun`;
  }
  return `${Math.floor(days / 30)} oy`;
}

/**
 * Uzbekistan is UTC+5 all year, so a fixed offset is exact rather than an
 * approximation — the country has kept no daylight saving since 1995.
 */
const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;

function toTashkent(date: Date): Date {
  return new Date(date.getTime() + TASHKENT_OFFSET_MS);
}

/** `18 avg, 14:30` — the arrival stamp, on the seller's own clock. */
export function formatArrival(date: Date): string {
  const local = toTashkent(date);
  const hours = String(local.getUTCHours()).padStart(2, "0");
  const minutes = String(local.getUTCMinutes()).padStart(2, "0");
  return `${local.getUTCDate()} ${MONTHS_SHORT[local.getUTCMonth()]}, ${hours}:${minutes}`;
}

/**
 * Today as `YYYY-MM-DD` in Tashkent, for deciding whether a callback date has
 * already passed. `dayKey` in the analytics module answers in UTC, which turns
 * a callback due today into an overdue one for the last five hours of a
 * seller's evening.
 */
export function tashkentDayKey(now: Date): string {
  return toTashkent(now).toISOString().slice(0, 10);
}
