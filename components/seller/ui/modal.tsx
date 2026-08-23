"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  closeLabel?: string;
  footer?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

/** Lightweight Radix dialog styled to the seller panel's own tokens — the panel's UI kit is independent of components/ui/form-modal-shell.tsx by design. */
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  closeLabel = "Close",
  footer,
  className,
  children,
}: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-100 bg-black/70 data-[state=open]:animate-[fade-in_150ms_ease-out]" />
        <Dialog.Content
          {...(description === undefined ? { "aria-describedby": undefined } : {})}
          className={cn(
            "fixed top-1/2 left-1/2 z-100 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2",
            "rounded-md border border-border bg-surface shadow-2xl",
            "data-[state=open]:animate-[fade-in_150ms_ease-out]",
            className
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
            <div className="min-w-0 border-l-2 border-accent pl-3">
              <Dialog.Title className="text-base font-semibold text-foreground">{title}</Dialog.Title>
              {description === undefined ? null : (
                <Dialog.Description className="mt-1 text-xs text-muted">{description}</Dialog.Description>
              )}
            </div>
            <Dialog.Close
              aria-label={closeLabel}
              className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>
          <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
          {footer === undefined ? null : (
            <div className="flex flex-col-reverse gap-2 border-t border-border px-5 py-4 sm:flex-row sm:justify-end">
              {footer}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
