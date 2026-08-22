"use client";

import { useState } from "react";
import { ChevronDown, MoreHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FormField } from "@/components/ui/form-field";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { formatDayLabel } from "@/lib/analytics/format";
import { mailtoHref, telHref, whatsappHref } from "@/lib/admin/contact-links";
import { SaveCustomerButton } from "./save-customer-button";
import {
  AGE_STEP_TEXT,
  COLUMN_LABELS,
  STAGE_TONE,
  ageStep,
  movesFor,
  type AgeStep,
  type BoardCard,
  type BoardMove,
} from "@/lib/admin/inquiry-board-state";

/**
 * The list's column template, shared by the header strip and every row so the
 * two cannot drift apart.
 *
 * Three layouts, not one. Stacked on a phone; two-up from `sm`, where a lead
 * reads as a card with the clock in its own narrow column; and the full six
 * columns from `xl`, which is the first width at which the panel's 264px rail
 * still leaves room for them. Putting the grid on at `lg` was the tempting
 * option and it is wrong: at 1024px the content area is 696px, and six columns
 * in 696px is the cramped board this list replaced.
 */
export const INQUIRY_GRID = cn(
  "grid gap-x-4 gap-y-3 sm:grid-cols-[6rem_minmax(0,1fr)]",
  "xl:grid-cols-[6rem_minmax(9rem,1fr)_minmax(12rem,1.8fr)_8rem_7rem_auto] xl:items-start xl:gap-y-0",
);

/** Cells that take the whole card width until the six-column grid arrives. */
const WIDE_CELL = "sm:col-span-2 xl:col-span-1";

/**
 * The rule down the left of every row, inked by how long the lead has waited.
 *
 * This is the list's one piece of colour beyond the claim button, and it is
 * deliberately switched off in three of the five stages (see `ageStep`): once a
 * seller is working a lead, or the lead is closed, elapsed time is no longer a
 * failure and a coloured rule would be decoration. Because the rows are sorted
 * by longest wait first, the rules stack into a ladder down the left edge —
 * the oldest, reddest leads land where the eye starts.
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

export interface InquiryRowProps {
  card: BoardCard;
  /** Directors see who holds each lead; a seller's list only holds their own. */
  showAssignee: boolean;
  todayIso: string;
  busy: boolean;
  error: string | null;
  onClaim: (id: string) => void;
  onMove: (id: string, move: BoardMove) => void;
  onSaveNotes: (id: string, notes: string) => void;
  onSaveFollowUp: (id: string, followUpAt: string | null) => void;
}

export function InquiryRow({
  card,
  showAssignee,
  todayIso,
  busy,
  error,
  onClaim,
  onMove,
  onSaveNotes,
  onSaveFollowUp,
}: InquiryRowProps) {
  const step = ageStep(card.ageHours, card.column);
  const stepText = AGE_STEP_TEXT[step];

  /*
   * One button, and a menu for the rest.
   *
   * A claimed lead has three moves, and drawn as three equal buttons they made
   * the seller choose before they had read the row. `movesFor` already marks
   * which one is the next step; the others are still one click away, but they
   * no longer compete with it. A closed lead has no next step, so it gets no
   * button at all — only the menu that can reopen it.
   */
  const moves = movesFor(card.column);
  const primary = moves.find((move) => move.primary) ?? null;
  const secondary = moves.filter((move) => move !== primary);

  const [open, setOpen] = useState(false);

  /*
   * The note field holds a draft only while there is one to hold.
   *
   * Falling back to the saved note rather than copying it into state means a
   * refresh that brings a colleague's newer note simply shows it, while a
   * half-written draft still wins over whatever arrives underneath it. Saving
   * clears the draft, and the optimistic patch has already put the same text on
   * the row, so the field does not flicker back to the old note on the way.
   */
  const [draft, setDraft] = useState<string | null>(null);
  const notes = draft ?? card.notes ?? "";
  const notesDirty = draft !== null && draft !== (card.notes ?? "");

  const tel = telHref(card.phone);
  const whatsapp = whatsappHref(card.phone);
  const mail = mailtoHref(card.email, "So'rovingiz bo'yicha — Diesel Parts");
  const overdue = card.followUpAt !== null && card.followUpAt < todayIso;
  const panelId = "so-rov-" + card.id;

  return (
    <li
      className={cn(
        "border-l-2 transition-opacity",
        RULE_INK[step],
        busy && "opacity-60",
        // A row that is open stops being one line in a list and becomes the
        // thing being worked on, so it is lifted onto the recessed surface.
        open && "bg-surface-muted",
      )}
    >
      <div className={cn(INQUIRY_GRID, "px-3 py-3 sm:px-4")}>
        {/* --- Kutmoqda ----------------------------------------------------
          * The clock, in words as well as in colour. `stepText` is null while
          * the wait is still normal, so a fresh lead says only how old it is.
          */}
        <p className={cn("font-mono text-xs tabular-nums", AGE_INK[step])}>
          <span className="sr-only">Kutmoqda: </span>
          {card.ageLabel}
          {stepText === null ? null : (
            <span className="ms-1 xl:ms-0 xl:mt-0.5 xl:block">· {stepText}</span>
          )}
        </p>

        {/* --- Mijoz -------------------------------------------------------- */}
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{card.customerName}</p>
          {tel === null ? (
            <p className="mt-0.5 truncate font-mono text-xs tabular-nums text-muted">
              {card.phone}
            </p>
          ) : (
            <a
              href={tel}
              className="mt-0.5 block truncate font-mono text-xs tabular-nums text-muted transition-colors hover:text-foreground hover:underline"
            >
              {card.phone}
            </a>
          )}
        </div>

        {/* --- So'rov -------------------------------------------------------
          * Two lines, not three. The full text is one click away in the panel
          * below, and a row that can be four lines tall stops being scannable
          * — which was the whole reason for reading this as a list.
          */}
        <div className={cn("min-w-0", WIDE_CELL)}>
          <p className="line-clamp-2 text-sm text-muted">{card.message}</p>
          {card.productSku === null ? null : (
            <p className="type-eyebrow mt-1 truncate text-foreground">
              {card.productSku}
              {card.quantity === null ? null : (
                <span className="ms-2 text-muted">× {card.quantity}</span>
              )}
            </p>
          )}
        </div>

        {/* --- Holat --------------------------------------------------------- */}
        <div className="min-w-0">
          <Badge variant={STAGE_TONE[card.column]}>
            {card.column === "new" ? (
              /* The accent, on the one stage that is an invitation to act.
                 That is the hue's whole job in this panel, and it keeps the
                 unclaimed pool findable without inking it as a fault. */
              <span aria-hidden className="me-1.5 size-1.5 rounded-full bg-accent" />
            ) : null}
            {COLUMN_LABELS[card.column]}
          </Badge>
          {showAssignee && card.assignedSellerName !== null ? (
            <p className="type-caption mt-1 truncate text-muted">{card.assignedSellerName}</p>
          ) : null}
        </div>

        {/* --- Qayta aloqa ---------------------------------------------------- */}
        <p className="font-mono text-xs tabular-nums">
          <span className="sr-only">Qayta aloqa: </span>
          {card.followUpAt === null ? (
            <span className="text-muted" aria-label="belgilanmagan">
              —
            </span>
          ) : (
            <span className={overdue ? "text-danger" : "text-foreground"}>
              {formatDayLabel(card.followUpAt)}
              {overdue ? <span className="block">muddati o&apos;tdi</span> : null}
            </span>
          )}
        </p>

        {/* --- Amal ------------------------------------------------------------ */}
        <div className={cn("flex flex-wrap items-center gap-2 xl:justify-end", WIDE_CELL)}>
          {card.column === "new" ? (
            <Button type="button" size="sm" disabled={busy} onClick={() => onClaim(card.id)}>
              {busy ? "Band qilinmoqda…" : "Men olaman"}
            </Button>
          ) : primary === null ? null : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => onMove(card.id, primary)}
            >
              {primary.label}
            </Button>
          )}

          {secondary.length === 0 ? null : (
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label={"Boshqa amallar — " + card.customerName}
                disabled={busy}
                className="flex size-8 items-center justify-center rounded-md border border-border text-muted transition-colors hover:bg-surface-hover hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
              >
                <Icon icon={MoreHorizontal} size="sm" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {secondary.map((move) => (
                  <DropdownMenuItem
                    key={move.status}
                    onSelect={() => onMove(card.id, move)}
                  >
                    {move.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <button
            type="button"
            aria-expanded={open}
            aria-controls={panelId}
            aria-label={"Tafsilotlar — " + card.customerName}
            onClick={() => setOpen((was) => !was)}
            className="flex size-8 items-center justify-center rounded-md border border-border text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
          >
            <Icon
              icon={ChevronDown}
              size="sm"
              className={cn("transition-transform", open && "rotate-180")}
            />
          </button>
        </div>
      </div>

      <div aria-live="polite">
        {error === null ? null : (
          <p role="alert" className="px-3 pb-3 text-xs text-danger sm:px-4">
            {error}
          </p>
        )}
      </div>

      {/*
        * Everything that needs room: the full message, the hand-offs, the note
        * and the callback date. It opens across the whole list rather than
        * inside a 240px board column, which is the difference between a note
        * field you can write a sentence in and one you cannot.
        */}
      {open ? (
        <div
          id={panelId}
          className="grid gap-6 border-t border-border px-3 py-4 sm:grid-cols-2 sm:px-4 xl:grid-cols-3"
        >
          <div className="space-y-3">
            <div>
              <h3 className="type-eyebrow text-muted">So&apos;rov matni</h3>
              <p className="mt-1 whitespace-pre-line text-pretty text-sm text-foreground">
                {card.message}
              </p>
              <p className="mt-2 font-mono text-xs tabular-nums text-muted">
                {card.createdAtLabel}
              </p>
            </div>

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
          </div>

          <div>
            <FormField
              label="Izoh"
              hint="Nima gaplashildi, keyingi qadam nima"
              multiline
              disabled={busy}
            >
              <Textarea
                value={notes}
                rows={4}
                onChange={(event) => setDraft(event.target.value)}
              />
            </FormField>
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
            {/*
              Saves on change rather than behind its own button: a date input
              only emits a change once the whole date is valid, so there is no
              half-typed state to guard against, and one control beats two.
            */}
            <FormField
              label="Qayta aloqa sanasi"
              hint="Bu sana o'tib ketsa, qatorda qizil bo'lib turadi."
              disabled={busy}
            >
              <Input
                type="date"
                value={card.followUpAt ?? ""}
                min={todayIso}
                className="font-mono"
                onChange={(event) =>
                  onSaveFollowUp(card.id, event.target.value === "" ? null : event.target.value)
                }
              />
            </FormField>
            {card.followUpAt === null ? null : (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="mt-2"
                disabled={busy}
                onClick={() => onSaveFollowUp(card.id, null)}
              >
                Tozalash
              </Button>
            )}
          </div>
        </div>
      ) : null}
    </li>
  );
}
