"use client";

import { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { formatDayLabel } from "@/lib/analytics/format";
import { mailtoHref, telHref, whatsappHref } from "@/lib/admin/contact-links";
import { SaveCustomerButton } from "./save-customer-button";
import {
  AGE_STEP_TEXT,
  ageStep,
  movesFor,
  type AgeStep,
  type BoardCard,
  type BoardMove,
} from "@/lib/admin/inquiry-board-state";

/**
 * The rule down the left of every card, inked by how long the lead has waited.
 *
 * This is the board's one piece of colour beyond the claim button, and it is
 * deliberately switched off in three of the five columns (see `ageStep`): once
 * a seller is working a lead, or the lead is closed, elapsed time is no longer a
 * failure and a coloured rule would be decoration. The age is written on the
 * card in words as well, so nothing here is carried by colour alone.
 */
const RULE_INK: Record<AgeStep, string> = {
  fresh: "border-border",
  waiting: "border-muted",
  stale: "border-warning",
  cold: "border-danger",
  quiet: "border-border",
};

const AGE_INK: Record<AgeStep, string> = {
  fresh: "text-muted",
  waiting: "text-muted",
  stale: "text-warning",
  cold: "text-danger",
  quiet: "text-muted",
};

/* Contact hand-offs stay anchors — see the note on `buttonVariants`. */
const contactLink = buttonVariants({ variant: "outline", size: "sm" });

export interface InquiryCardProps {
  card: BoardCard;
  /** Directors see who holds each lead; a seller's board only holds their own. */
  showAssignee: boolean;
  todayIso: string;
  busy: boolean;
  error: string | null;
  onClaim: (id: string) => void;
  onMove: (id: string, move: BoardMove) => void;
  onSaveNotes: (id: string, notes: string) => void;
  onSaveFollowUp: (id: string, followUpAt: string | null) => void;
}

export function InquiryCard({
  card,
  showAssignee,
  todayIso,
  busy,
  error,
  onClaim,
  onMove,
  onSaveNotes,
  onSaveFollowUp,
}: InquiryCardProps) {
  const step = ageStep(card.ageHours, card.column);
  const stepText = AGE_STEP_TEXT[step];
  const moves = movesFor(card.column);

  /*
   * The note field holds a draft only while there is one to hold.
   *
   * Falling back to the saved note rather than copying it into state means a
   * refresh that brings a colleague's newer note simply shows it, while a
   * half-written draft still wins over whatever arrives underneath it. Saving
   * clears the draft, and the optimistic patch has already put the same text on
   * the card, so the field does not flicker back to the old note on the way.
   */
  const [draft, setDraft] = useState<string | null>(null);
  const notes = draft ?? card.notes ?? "";
  const notesDirty = draft !== null && draft !== (card.notes ?? "");

  const tel = telHref(card.phone);
  const whatsapp = whatsappHref(card.phone);
  const mail = mailtoHref(card.email, `So'rovingiz bo'yicha — Diesel Parts`);
  const overdue = card.followUpAt !== null && card.followUpAt < todayIso;
  const panelId = `so-rov-${card.id}`;

  return (
    <li className={cn("border-l-2 py-4 pl-4 transition-opacity", RULE_INK[step], busy && "opacity-60")}>
      {/* Wraps rather than squeezing: a customer's name broken across two lines
          to make room for a timestamp is the wrong trade. */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <p className="text-sm font-medium text-foreground">{card.customerName}</p>
        <p className={cn("shrink-0 font-mono text-xs tabular-nums", AGE_INK[step])}>
          {card.ageLabel}
          {stepText === null ? null : <span className="ml-1">· {stepText}</span>}
        </p>
      </div>

      <a
        href={tel ?? undefined}
        className="mt-0.5 inline-block font-mono text-xs tabular-nums text-foreground hover:underline"
      >
        {card.phone}
      </a>

      <p className="mt-2 line-clamp-3 text-sm text-muted">{card.message}</p>

      {card.productSku === null ? null : (
        <p className="mt-2 type-eyebrow text-foreground">
          {card.productSku}
          {card.quantity === null ? null : (
            <span className="ml-1.5 text-muted">× {card.quantity}</span>
          )}
        </p>
      )}

      <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs text-muted">
        <span className="font-mono tabular-nums">{card.createdAtLabel}</span>
        {showAssignee && card.assignedSellerName !== null ? (
          <span>{card.assignedSellerName}</span>
        ) : null}
        {card.followUpAt === null ? null : (
          <span className={cn("font-mono tabular-nums", overdue && "text-danger")}>
            Qayta aloqa: {formatDayLabel(card.followUpAt)}
            {overdue ? " · muddati o'tdi" : ""}
          </span>
        )}
      </div>

      <div aria-live="polite">
        {error === null ? null : (
          <p role="alert" className="mt-2 text-xs text-danger">
            {error}
          </p>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {card.column === "new" ? (
          <Button type="button" size="sm" disabled={busy} onClick={() => onClaim(card.id)}>
            {busy ? "Band qilinmoqda…" : "Men olaman"}
          </Button>
        ) : (
          moves.map((move) => (
            <Button
              key={move.status}
              type="button"
              size="sm"
              variant={move.primary ? "outline" : "ghost"}
              disabled={busy}
              onClick={() => onMove(card.id, move)}
            >
              {move.label}
            </Button>
          ))
        )}
      </div>

      <details className="group mt-2">
        <summary className="cursor-pointer list-none text-xs text-muted underline decoration-border underline-offset-4 hover:text-foreground">
          <span className="group-open:hidden">Bog&apos;lanish va izoh</span>
          <span className="hidden group-open:inline">Yopish</span>
        </summary>

        <div id={panelId} className="mt-3 space-y-3">
          <div className="flex flex-wrap gap-2">
            {tel === null ? null : (
              <a href={tel} className={contactLink}>
                Qo&apos;ng&apos;iroq
              </a>
            )}
            {whatsapp === null ? null : (
              <a href={whatsapp} target="_blank" rel="noreferrer" className={contactLink}>
                WhatsApp
              </a>
            )}
            {mail === null ? null : (
              <a href={mail} className={contactLink}>
                Email
              </a>
            )}
          </div>

          {/* Sits with the contact hand-offs rather than with the status
              buttons: saving the caller is something the seller does while
              talking to them, not a move of the lead. */}
          <SaveCustomerButton
            customerName={card.customerName}
            phone={card.phone}
            email={card.email}
            message={card.message}
            saved={card.savedCustomer}
          />

          <div>
            <label
              htmlFor={`izoh-${card.id}`}
              className="type-eyebrow text-muted"
            >
              Izoh
            </label>
            <Textarea
              id={`izoh-${card.id}`}
              value={notes}
              rows={3}
              className="mt-1 min-h-0 text-xs"
              placeholder="Nima gaplashildi, keyingi qadam nima"
              onChange={(event) => setDraft(event.target.value)}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-2"
              disabled={busy || !notesDirty}
              onClick={() => {
                setDraft(null);
                onSaveNotes(card.id, notes);
              }}
            >
              Izohni saqlash
            </Button>
          </div>

          <div>
            <label
              htmlFor={`sana-${card.id}`}
              className="type-eyebrow text-muted"
            >
              Qayta aloqa sanasi
            </label>
            <div className="mt-1 flex items-center gap-2">
              {/*
                Saves on change rather than behind its own button: a date input
                only emits a change once the whole date is valid, so there is no
                half-typed state to guard against, and one control beats two.
              */}
              <input
                id={`sana-${card.id}`}
                type="date"
                value={card.followUpAt ?? ""}
                min={todayIso}
                disabled={busy}
                onChange={(event) =>
                  onSaveFollowUp(card.id, event.target.value === "" ? null : event.target.value)
                }
                className="h-9 rounded-md border border-border bg-transparent px-2 font-mono text-xs tabular-nums text-foreground focus:border-accent-strong"
              />
              {card.followUpAt === null ? null : (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => onSaveFollowUp(card.id, null)}
                >
                  Tozalash
                </Button>
              )}
            </div>
          </div>
        </div>
      </details>
    </li>
  );
}
