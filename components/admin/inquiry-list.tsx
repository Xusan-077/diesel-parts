"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { toast } from "sonner";
import { isRefusal, requestErrorMessage } from "@/lib/api/request-error";
import { type InquiryColumn } from "@/lib/api/inquiry-board";
import { cn } from "@/lib/utils";
import {
  COLUMN_LABELS,
  EMPTY_OVERLAY,
  FILTER_EMPTY_TEXT,
  FILTER_LABELS,
  INQUIRY_FILTERS,
  applyOverlay,
  compareCards,
  dropPatch,
  filterColumns,
  groupByColumn,
  patchCard,
  pruneSettled,
  type BoardCard,
  type BoardMove,
  type BoardOverlay,
  type CardPatch,
  type InquiryFilter,
} from "@/lib/admin/inquiry-board-state";
import { INQUIRY_GRID, InquiryRow } from "./inquiry-row";

/**
 * How often the list re-reads itself while it is on screen.
 *
 * Nothing here needs to be live to the second — a lead that arrived thirty
 * seconds ago is not more claimable than one that arrived a minute ago — so the
 * list leans on the two moments that actually matter: the seller coming back to
 * the tab, and a slow tick behind that as a backstop. Polling stops entirely
 * when the tab is hidden, because a phone in a pocket must not hold a request
 * loop open.
 */
const POLL_MS = 90_000;

/** The six-column header, in the order a row reads. */
const HEADINGS = [
  "Kutmoqda",
  "Mijoz",
  "So'rov",
  "Holat",
  "Qayta aloqa",
  "Amal",
] as const;

export interface InquiryListProps {
  cards: BoardCard[];
  totals: Record<InquiryColumn, number>;
  /** Shown on a row the moment it is claimed, before the server confirms. */
  sellerName: string;
  showAssignee: boolean;
  todayIso: string;
}

/**
 * The seller's leads, as one list.
 *
 * This was a five-column kanban board, and the board was the problem. The panel
 * keeps a 264px rail, so five columns had about 190px each on a laptop — and a
 * lead is a name, a number, a question, a part, a stage, a callback date and
 * three moves. None of that fits in 190px, and none of it lined up between one
 * card and the next, so the screen could be looked at but not read down.
 *
 * A list gives every lead the full width and puts the same fact in the same
 * place on every row, which is what makes a column scannable. What the board
 * was genuinely good at — showing the shape of the pipeline — is kept by the
 * filter strip above, where the five stages carry their counts.
 */
export function InquiryList({
  cards,
  totals,
  sellerName,
  showAssignee,
  todayIso,
}: InquiryListProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [overlay, setOverlay] = useState<BoardOverlay>(EMPTY_OVERLAY);
  const [busyIds, setBusyIds] = useState<readonly string[]>([]);
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});
  const [filter, setFilter] = useState<InquiryFilter>("open");

  const refresh = useCallback(() => {
    startTransition(() => router.refresh());
  }, [router]);

  /*
   * A move the server has since confirmed must stop being an overlay, or a lead
   * another seller claimed first would keep showing this seller's optimism.
   *
   * Adjusted during render against the last props seen rather than in an effect:
   * the pruning has to happen before the list is drawn, and an effect would
   * paint one frame of stale optimism first and then correct it.
   */
  const [prunedAgainst, setPrunedAgainst] = useState(cards);
  if (prunedAgainst !== cards) {
    setPrunedAgainst(cards);
    setOverlay((current) => pruneSettled(current, cards));
  }

  useEffect(() => {
    const refreshIfVisible = () => {
      if (document.visibilityState === "visible") {
        refresh();
      }
    };

    window.addEventListener("focus", refreshIfVisible);
    document.addEventListener("visibilitychange", refreshIfVisible);
    const timer = window.setInterval(refreshIfVisible, POLL_MS);

    return () => {
      window.removeEventListener("focus", refreshIfVisible);
      document.removeEventListener("visibilitychange", refreshIfVisible);
      window.clearInterval(timer);
    };
  }, [refresh]);

  /**
   * Moves the row first and asks the server second.
   *
   * On a refusal the patch is dropped, which snaps the row back to whatever the
   * server last said, and the reason is printed on the row itself — a lead lost
   * to a faster colleague is the one failure a seller must not miss. A refusal
   * still refreshes: the list's picture of that lead is now known to be stale.
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
        // The row snaps back on its own, which is easy to miss on a long
        // list; the toast is what makes the reversal noticed.
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
    (id: string, body: Record<string, unknown>, patch: CardPatch) =>
      send(id, patch, () => axios.patch(`/api/v1/inquiries/${id}`, body)),
    [send],
  );

  const onClaim = useCallback(
    (id: string) => {
      void send(id, { column: "claimed", assignedSellerName: sellerName }, async () => {
        await axios.post(`/api/v1/inquiries/${id}/claim`);
        toast.success("So'rov sizga biriktirildi");
      });
    },
    [send, sellerName],
  );

  const onMove = useCallback(
    (id: string, move: BoardMove) => {
      // Goes through `send` rather than `patchInquiry` so the toast fires on
      // the write itself: `send` swallows failures to roll the row back, so a
      // `.then` on it would confirm a move that never happened.
      void send(id, { column: move.column }, async () => {
        await axios.patch(`/api/v1/inquiries/${id}`, { status: move.status });
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

  const shown = useMemo(() => {
    const stages = new Set(filterColumns(filter));
    return applyOverlay(cards, overlay)
      .filter((card) => stages.has(card.column))
      .sort(compareCards);
  }, [cards, overlay, filter]);

  /*
   * How many rows the server holds beyond the page it sent. Measured against
   * the un-overlaid grouping on purpose: a lead the seller has just claimed
   * leaves "Yangi" on screen but not in `totals`, and subtracting the moved row
   * would invent a hidden lead that does not exist.
   */
  const loaded = groupByColumn(cards);
  const countFor = (option: InquiryFilter) =>
    filterColumns(option).reduce((sum, column) => sum + totals[column], 0);
  const hidden = filterColumns(filter).reduce(
    (sum, column) => sum + Math.max(0, totals[column] - loaded[column].length),
    0,
  );

  return (
    <div className="mt-8">
      {/*
        * The pipeline, as a strip. It is what the board's five headings said,
        * in a sixth of the height — and unlike the headings it can be pressed,
        * so the stage a seller is working is the only one on screen.
        */}
      <div
        role="group"
        aria-label="So'rov holati"
        className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 lg:mx-0 lg:px-0"
      >
        {INQUIRY_FILTERS.map((option) => {
          const selected = option === filter;

          return (
            <button
              key={option}
              type="button"
              aria-pressed={selected}
              onClick={() => setFilter(option)}
              className={cn(
                "inline-flex shrink-0 items-center gap-2 rounded-md border px-3 py-2 text-xs transition-colors",
                selected
                  ? "border-accent-edge bg-accent font-medium text-accent-foreground"
                  : "border-border text-muted hover:bg-surface-hover hover:text-foreground",
                // "Ochiq" is the three live stages together, so it is fenced off
                // from the five that partition them — without the rule it reads
                // as a sixth stage whose count does not add up.
                option === "open" && "me-2",
              )}
            >
              {FILTER_LABELS[option]}
              <span className="font-mono tabular-nums">{countFor(option)}</span>
            </button>
          );
        })}
      </div>

      <div className="panel mt-4 p-0">
        {/*
          * Column names, from `xl` up — the width at which the rows actually
          * become columns. Below that each row is a card and the cells carry
          * their own labels, so a header strip would name columns that are not
          * there.
          */}
        <div
          aria-hidden
          className="hidden border-b border-border xl:block"
        >
          <div className={cn(INQUIRY_GRID, "border-l-2 border-transparent px-3 py-2 sm:px-4")}>
            {HEADINGS.map((heading, index) => (
              <span
                key={heading}
                className={cn("type-eyebrow text-muted", index === 5 && "xl:text-end")}
              >
                {heading}
              </span>
            ))}
          </div>
        </div>

        {shown.length === 0 ? (
          <p className="px-4 py-10 text-center type-body text-muted">
            {FILTER_EMPTY_TEXT[filter]}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {shown.map((card) => (
              <InquiryRow
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

        {/* Each stage loads one page. Saying so beats a list that quietly stops
            at twenty and looks complete. Which rows were left out differs by
            stage — the live ones lead with the longest wait, the closed ones
            with the most recent — so the wording stays neutral rather than
            claiming a direction. */}
        {hidden > 0 ? (
          <p className="border-t border-border px-4 py-3 text-xs text-muted">
            Yana {hidden} ta so&apos;rov bor — bu yerda ko&apos;rsatilmadi. Ro&apos;yxatni
            toraytiring yoki holat bo&apos;yicha filtrlang.
          </p>
        ) : null}
      </div>
    </div>
  );
}
