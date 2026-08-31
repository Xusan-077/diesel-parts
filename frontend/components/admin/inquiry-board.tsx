"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import {
  useInquiryBoard,
  useInquiryBoardRefresh,
} from "@/hooks/admin/use-admin-inquiries";
import { claimInquiry, updateInquiry } from "@/lib/api/admin/resources";
import type { InquiryBoardView } from "@/lib/api/inquiry-board-view";
import { isRefusal, requestErrorMessage } from "@/lib/api/request-error";
import type { InquiryUpdateInput } from "@/lib/schemas";
import { INQUIRY_COLUMNS, type InquiryColumn } from "@/lib/api/inquiry-board";
import { cn } from "@/lib/utils";
import {
  COLUMN_EMPTY_TEXT,
  COLUMN_LABELS,
  EMPTY_OVERLAY,
  applyOverlay,
  dropPatch,
  groupByColumn,
  patchCard,
  pruneSettled,
  type BoardCard,
  type BoardMove,
  type BoardOverlay,
  type CardPatch,
} from "@/lib/admin/inquiry-board-state";
import { InquiryCard } from "./inquiry-card";

/*
 * Stable references for the frames before the first answer arrives, so an
 * unseeded board does not rebuild its groupings on every render.
 */
const EMPTY_CARDS: BoardCard[] = [];
const EMPTY_TOTALS = Object.fromEntries(
  INQUIRY_COLUMNS.map((column) => [column, 0]),
) as Record<InquiryColumn, number>;

export interface InquiryBoardProps {
  /**
   * The board as the page read it. `undefined` when that read failed, which
   * leaves the board to fetch and show its own loading and error states.
   */
  initialData?: InquiryBoardView;
}

/**
 * The seller's board.
 *
 * The data belongs to React Query now: the page seeds it, the hook polls it
 * while the tab is open, and every write below rereads it. What stays here is
 * the part a cache cannot do — the optimistic overlay that moves a card under
 * the pointer and rolls it back if the server refuses.
 */
export function InquiryBoard({ initialData }: InquiryBoardProps) {
  const board = useInquiryBoard(initialData);
  const refresh = useInquiryBoardRefresh();

  const cards = board.data?.cards ?? EMPTY_CARDS;
  const totals = board.data?.totals ?? EMPTY_TOTALS;
  const sellerName = board.data?.sellerName ?? "";
  const showAssignee = board.data?.showAssignee ?? false;
  const todayIso = board.data?.todayIso ?? "";

  const [overlay, setOverlay] = useState<BoardOverlay>(EMPTY_OVERLAY);
  const [busyIds, setBusyIds] = useState<readonly string[]>([]);
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});
  const [activeColumn, setActiveColumn] = useState<InquiryColumn>("new");

  /*
   * A move the server has since confirmed must stop being an overlay, or a lead
   * another seller claimed first would keep showing this seller's optimism.
   *
   * Adjusted during render against the last props seen rather than in an effect:
   * the pruning has to happen before the board is drawn, and an effect would
   * paint one frame of stale optimism first and then correct it.
   */
  const [prunedAgainst, setPrunedAgainst] = useState(cards);
  if (prunedAgainst !== cards) {
    setPrunedAgainst(cards);
    setOverlay((current) => pruneSettled(current, cards));
  }

  /**
   * Moves the card first and asks the server second.
   *
   * On a refusal the patch is dropped, which snaps the card back to whatever the
   * server last said, and the reason is printed on the card itself — a lead lost
   * to a faster colleague is the one failure a seller must not miss. A refusal
   * still refreshes: the board's picture of that card is now known to be stale.
   */
  const send = useCallback(
    async (id: string, patch: CardPatch, request: () => Promise<unknown>) => {
      setOverlay((current) => patchCard(current, id, patch));
      setBusyIds((current) => [...current, id]);
      setErrors((current) => {
        if (!(id in current)) {
          return current;
        }
        const next: Record<string, string> = { ...current };
        delete next[id];
        return next;
      });

      try {
        await request();
        refresh();
      } catch (error) {
        const message = requestErrorMessage(error, "Saqlanmadi.");
        setOverlay((current) => dropPatch(current, id));
        setErrors((current) => ({ ...current, [id]: message }));
        // The card snaps back on its own, which is easy to miss on a long
        // board; the toast is what makes the reversal noticed.
        toast.error(message);

        if (isRefusal(error)) {
          refresh();
        }
      } finally {
        setBusyIds((current) => current.filter((busy) => busy !== id));
      }
    },
    [refresh],
  );

  const patchInquiry = useCallback(
    (id: string, body: InquiryUpdateInput, patch: CardPatch) =>
      send(id, patch, () => updateInquiry(id, body)),
    [send],
  );

  const onClaim = useCallback(
    (id: string) => {
      void send(id, { column: "claimed", assignedSellerName: sellerName }, async () => {
        await claimInquiry(id);
        toast.success("So'rov sizga biriktirildi");
      });
    },
    [send, sellerName],
  );

  const onMove = useCallback(
    (id: string, move: BoardMove) => {
      // Goes through `send` rather than `patchInquiry` so the toast fires on
      // the write itself: `send` swallows failures to roll the card back, so a
      // `.then` on it would confirm a move that never happened.
      void send(id, { column: move.column }, async () => {
        await updateInquiry(id, { status: move.status });
        toast.success(`Ko'chirildi: ${COLUMN_LABELS[move.column]}`);
      });
    },
    [send],
  );

  const onSaveNotes = useCallback(
    (id: string, notes: string) => {
      const trimmed = notes.trim();
      const value = trimmed === "" ? null : trimmed;
      void patchInquiry(id, { notes: value }, { notes: value });
    },
    [patchInquiry],
  );

  const onSaveFollowUp = useCallback(
    (id: string, followUpAt: string | null) => {
      void patchInquiry(id, { followUpAt }, { followUpAt });
    },
    [patchInquiry],
  );

  const columns = groupByColumn(applyOverlay(cards, overlay));
  /*
   * How many rows the server holds beyond the page it sent. Measured against the
   * un-overlaid grouping on purpose: a card the seller has just claimed leaves
   * "Yangi" on the board but not in `totals`, and subtracting the moved card
   * would invent a hidden row that does not exist.
   */
  const loaded = groupByColumn(cards);
  const hiddenFor = (column: InquiryColumn) =>
    Math.max(0, totals[column] - loaded[column].length);

  return (
    <div className="mt-8">
      {/*
        On a phone the five columns become five chips over a single list. A
        horizontal strip of columns would work, but it hides four fifths of the
        pipeline behind a sideways scroll; the chips carry their counts, so the
        shape of the whole board is readable without moving anything.
      */}
      <div
        role="group"
        aria-label="Taxta ustunlari"
        className="-mx-6 flex gap-1 overflow-x-auto px-6 pb-1 lg:hidden"
      >
        {INQUIRY_COLUMNS.map((column) => {
          const selected = column === activeColumn;
          const count = columns[column].length + hiddenFor(column);

          return (
            <button
              key={column}
              type="button"
              aria-pressed={selected}
              onClick={() => setActiveColumn(column)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-2 text-xs transition-colors",
                selected
                  ? "border-foreground bg-surface-hover font-medium text-foreground"
                  : "border-border text-muted hover:text-foreground",
              )}
            >
              {COLUMN_LABELS[column]}
              <span className="ml-2 font-mono tabular-nums">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 lg:mt-0 lg:flex lg:gap-3 lg:overflow-x-auto lg:pb-4">
        {INQUIRY_COLUMNS.map((column) => {
          const items = columns[column];
          const hidden = hiddenFor(column);

          return (
            <section
              key={column}
              aria-label={COLUMN_LABELS[column]}
              className={cn(
                "lg:block lg:min-w-[15rem] lg:flex-1",
                column === activeColumn ? "block" : "hidden",
              )}
            >
              <div className="hidden items-baseline justify-between border-b border-border pb-2 lg:flex">
                <h2 className="type-eyebrow text-muted">
                  {COLUMN_LABELS[column]}
                </h2>
                <span className="font-mono text-xs tabular-nums text-foreground">
                  {items.length + hidden}
                </span>
              </div>

              {items.length === 0 ? (
                <p className="py-4 text-xs text-muted">{COLUMN_EMPTY_TEXT[column]}</p>
              ) : (
                <ul className="divide-y divide-border">
                  {items.map((card) => (
                    <InquiryCard
                      key={card.id}
                      card={card}
                      showAssignee={showAssignee}
                      todayIso={todayIso}
                      busy={busyIds.includes(card.id)}
                      error={errors[card.id] ?? null}
                      onClaim={onClaim}
                      onMove={onMove}
                      onSaveNotes={onSaveNotes}
                      onSaveFollowUp={onSaveFollowUp}
                    />
                  ))}
                </ul>
              )}

              {/* Each column loads one page. Saying so beats a column that
                  quietly stops at twenty and looks complete. Which rows were
                  left out differs by column — the live ones lead with the
                  longest wait, the closed ones with the most recent — so the
                  wording stays neutral rather than claiming a direction. */}
              {hidden > 0 ? (
                <p className="border-t border-border pt-2 text-xs text-muted">
                  Yana {hidden} ta so&apos;rov bor — bu yerda ko&apos;rsatilmadi.
                </p>
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}
