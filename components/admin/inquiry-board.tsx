"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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

/**
 * How often the board re-reads itself while it is on screen.
 *
 * Nothing here needs to be live to the second — a lead that arrived thirty
 * seconds ago is not more claimable than one that arrived a minute ago — so the
 * board leans on the two moments that actually matter: the seller coming back to
 * the tab, and a slow tick behind that as a backstop. Polling stops entirely
 * when the tab is hidden, because a phone in a pocket must not hold a request
 * loop open.
 */
const POLL_MS = 90_000;

const OFFLINE_MESSAGE = "Ulanmadi. Qayta urinib ko'ring.";

interface ApiResponse {
  success: boolean;
  errors?: { _root?: string[] };
}

export interface InquiryBoardProps {
  cards: BoardCard[];
  totals: Record<InquiryColumn, number>;
  /** Shown on a card the moment it is claimed, before the server confirms. */
  sellerName: string;
  showAssignee: boolean;
  todayIso: string;
}

export function InquiryBoard({
  cards,
  totals,
  sellerName,
  showAssignee,
  todayIso,
}: InquiryBoardProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [overlay, setOverlay] = useState<BoardOverlay>(EMPTY_OVERLAY);
  const [busyIds, setBusyIds] = useState<readonly string[]>([]);
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});
  const [activeColumn, setActiveColumn] = useState<InquiryColumn>("new");

  const refresh = useCallback(() => {
    startTransition(() => router.refresh());
  }, [router]);

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
   * Moves the card first and asks the server second.
   *
   * On a refusal the patch is dropped, which snaps the card back to whatever the
   * server last said, and the reason is printed on the card itself — a lead lost
   * to a faster colleague is the one failure a seller must not miss. A refusal
   * still refreshes: the board's picture of that card is now known to be stale.
   */
  const send = useCallback(
    async (id: string, patch: CardPatch, request: () => Promise<Response>) => {
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
        const response = await request();
        const data = (await response.json()) as ApiResponse;

        if (!data.success) {
          setOverlay((current) => dropPatch(current, id));
          setErrors((current) => ({
            ...current,
            [id]: data.errors?._root?.[0] ?? "Saqlanmadi.",
          }));
        }

        refresh();
      } catch {
        setOverlay((current) => dropPatch(current, id));
        setErrors((current) => ({ ...current, [id]: OFFLINE_MESSAGE }));
      } finally {
        setBusyIds((current) => current.filter((busy) => busy !== id));
      }
    },
    [refresh],
  );

  const patchInquiry = useCallback(
    (id: string, body: Record<string, unknown>, patch: CardPatch) =>
      send(id, patch, () =>
        fetch(`/api/v1/inquiries/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
      ),
    [send],
  );

  const onClaim = useCallback(
    (id: string) => {
      void send(id, { column: "claimed", assignedSellerName: sellerName }, () =>
        fetch(`/api/v1/inquiries/${id}/claim`, { method: "POST" }),
      );
    },
    [send, sellerName],
  );

  const onMove = useCallback(
    (id: string, move: BoardMove) => {
      void patchInquiry(id, { status: move.status }, { column: move.column });
    },
    [patchInquiry],
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
                "shrink-0 rounded-full border px-3 py-1.5 text-xs transition-colors",
                selected
                  ? "border-foreground bg-surface-hover font-medium text-foreground"
                  : "border-border text-muted hover:text-foreground",
              )}
            >
              {COLUMN_LABELS[column]}
              <span className="ml-1.5 font-mono tabular-nums">{count}</span>
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
