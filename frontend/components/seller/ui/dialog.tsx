"use client";

import * as React from "react";
import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The seller panel's one modal chrome — plain Radix + Tailwind, no motion
 * library. Deliberately not FormModalShell (components/ui/form-modal-shell.tsx):
 * that one is styled for the main app's tokens and pulls in `motion/react`,
 * which nothing else in the seller panel depends on.
 */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  closeLabel = "Yopish",
  footer,
  className,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  closeLabel?: string;
  footer?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-100 bg-black/60 data-[state=open]:animate-in data-[state=open]:fade-in" />
        <RadixDialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-100 flex max-h-[85dvh] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border border-border bg-surface-elevated shadow-2xl sm:w-full sm:max-w-md",
            className
          )}
          {...(description === undefined ? { "aria-describedby": undefined } : {})}
        >
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-5 py-4">
            <div className="min-w-0 border-l-2 border-accent pl-3">
              <RadixDialog.Title className="type-title text-foreground">{title}</RadixDialog.Title>
              {description === undefined ? null : (
                <RadixDialog.Description className="mt-1 type-caption text-muted">
                  {description}
                </RadixDialog.Description>
              )}
            </div>
            <RadixDialog.Close
              aria-label={closeLabel}
              className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </RadixDialog.Close>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>

          {footer === undefined ? null : (
            <div className="flex shrink-0 flex-col-reverse gap-3 border-t border-border px-5 py-4 *:w-full sm:flex-row sm:justify-end sm:*:w-auto">
              {footer}
            </div>
          )}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
