"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Spinner } from "@/components/ui/spinner";
import {
  FormModalShell,
  type FormModalSize,
} from "@/components/ui/form-modal-shell";

/*
 * The two dialogs every module in the panel needs, so that no module writes
 * either one again.
 *
 * `FormModalShell` is the chrome — overlay, header, scroll, footer slot. What
 * it deliberately does not know is that a form is usually what goes in it, and
 * that a form's footer is always the same two buttons in the same order with
 * the same busy behaviour. Six modules assembling that by hand is six chances
 * to put Save on the left, or to leave it enabled through a save, or to forget
 * that Enter should submit.
 */

/** Uzbek is the panel's only language; see the note in `app/admin/layout.tsx`. */
const LABELS = {
  cancel: "Bekor qilish",
  close: "Yopish",
  saving: "Saqlanmoqda…",
  deleting: "O'chirilmoqda…",
  delete: "O'chirish",
  confirmTitle: "Rostdan ham o'chirmoqchimisiz?",
} as const;

export interface FormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Names the primary control: "Mahsulot qo'shish", "O'zgarishlarni saqlash". */
  submitLabel: string;
  /** Resolves when the write is done; throwing leaves the dialog open. */
  onSubmit: () => void | Promise<void>;
  busy?: boolean;
  /**
   * Blocks the primary control. Reserved for a form that cannot possibly be
   * saved — never for one that merely has not been touched yet, because a
   * button that is grey before you have done anything cannot tell you why.
   */
  submitDisabled?: boolean;
  size?: FormModalSize;
  /** A refusal that belongs to the whole form rather than to one field. */
  error?: string | null;
  children: React.ReactNode;
}

/**
 * A form in a dialog: fields in the body, Cancel and Save pinned below.
 *
 * The `<form>` is inside the shell but wraps both body and footer, which is why
 * the footer buttons are rendered through it rather than passed as plain nodes
 * — a submit button has to be inside the form element it submits, and Enter
 * from any field has to reach it. Getting that wrong is invisible until someone
 * with a keyboard tries to save.
 */
export function FormModal({
  open,
  onOpenChange,
  title,
  description,
  submitLabel,
  onSubmit,
  busy = false,
  submitDisabled = false,
  size = "md",
  error,
  children,
}: FormModalProps) {
  const formId = React.useId();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    await onSubmit();
  }

  return (
    <FormModalShell
      open={open}
      // A save in flight is a write the director cannot see the end of. Esc and
      // the backdrop stop closing the dialog until it lands, because closing
      // would strand them on a list that may or may not have changed.
      onOpenChange={(next) => {
        if (!busy) {
          onOpenChange(next);
        }
      }}
      title={title}
      description={description}
      closeLabel={LABELS.close}
      size={size}
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            {LABELS.cancel}
          </Button>
          <Button type="submit" form={formId} disabled={busy || submitDisabled}>
            {busy ? (
              <>
                <Spinner />
                {LABELS.saving}
              </>
            ) : (
              submitLabel
            )}
          </Button>
        </>
      }
    >
      {/*
        * `noValidate` because the panel prints its own messages under its own
        * fields. The browser's bubbles say the same thing in a different
        * language, in a tooltip that vanishes, one field at a time.
        */}
      <form id={formId} onSubmit={handleSubmit} noValidate className="space-y-6">
        {children}

        {/*
          * The form-level slot, kept in the scrolling body rather than beside
          * the buttons: it is usually a sentence, and a sentence in the footer
          * pushes Save off a short screen.
          */}
        <div aria-live="polite" className="empty:hidden">
          {error ? (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-md border border-danger bg-danger-surface px-3 py-2 text-sm text-danger"
            >
              <Icon icon={AlertTriangle} className="mt-1 shrink-0" />
              <span>{error}</span>
            </p>
          ) : null}
        </div>
      </form>
    </FormModalShell>
  );
}

export interface ConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Overrides the default question when the action is not a deletion. */
  title?: React.ReactNode;
  /** What is about to be destroyed, named. Never "this item". */
  subject: React.ReactNode;
  /**
   * The consequence, when there is one worth stating: an order history that
   * will lose its product, a seller whose customers become unassigned.
   */
  warning?: React.ReactNode;
  confirmLabel?: string;
  onConfirm: () => void | Promise<void>;
  /**
   * Blocks the destructive control — for a record something else still depends
   * on. The dialog still opens, and `warning` is where the reason goes: a
   * director who clicked delete is owed the reason it cannot happen, not a
   * button that quietly does nothing.
   */
  confirmDisabled?: boolean;
  busy?: boolean;
  error?: string | null;
}

/**
 * The destructive confirmation: one question, the thing named, two buttons.
 *
 * Deliberately not a `FormModal` with a red button. A confirmation has no
 * fields, so the parts that make a form dialog work — Enter to submit, a
 * scrolling body, validation — are all either absent or actively wrong here.
 * Enter especially: a dialog where the return key destroys a record is a
 * dialog that will eventually destroy one by accident.
 */
export function ConfirmModal({
  open,
  onOpenChange,
  title = LABELS.confirmTitle,
  subject,
  warning,
  confirmLabel = LABELS.delete,
  onConfirm,
  confirmDisabled = false,
  busy = false,
  error,
}: ConfirmModalProps) {
  return (
    <FormModalShell
      open={open}
      onOpenChange={(next) => {
        if (!busy) {
          onOpenChange(next);
        }
      }}
      title={title}
      closeLabel={LABELS.close}
      size="sm"
      tone="danger"
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            {LABELS.cancel}
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={() => void onConfirm()}
            disabled={busy || confirmDisabled}
          >
            {busy ? (
              <>
                <Spinner />
                {LABELS.deleting}
              </>
            ) : (
              confirmLabel
            )}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/*
          * The subject is set in the panel's data face and boxed, so the name
          * of the record cannot be skim-read as part of the question around it.
          * This is the whole job of the dialog: making sure the director is
          * looking at the row they think they are looking at.
          */}
        <p className="rounded-md border border-border bg-surface-muted px-3 py-2 font-mono text-sm text-foreground">
          {subject}
        </p>

        {warning === undefined ? null : (
          <p className="flex items-start gap-2 text-sm text-muted">
            <Icon icon={AlertTriangle} className="mt-1 shrink-0 text-warning" />
            <span>{warning}</span>
          </p>
        )}

        <div aria-live="polite" className="empty:hidden">
          {error ? (
            <p role="alert" className="text-sm font-medium text-danger">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </FormModalShell>
  );
}
