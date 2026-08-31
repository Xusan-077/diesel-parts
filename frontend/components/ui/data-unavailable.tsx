import { cn } from "@/lib/utils";

/**
 * The notice that stands in for a section whose data could not be read.
 *
 * Deliberately quiet: a dashed outline the width of the section it replaces,
 * one sentence, no icon and no alarm colour. A visitor who came to look at
 * injectors should still be able to read the rest of the page without a red
 * panel shouting at them, and the sections around it are unaffected.
 *
 * `role="status"` rather than `role="alert"` for the same reason — a screen
 * reader announces it when it reaches it, instead of interrupting.
 */
export function DataUnavailable({
  message,
  className,
}: {
  message: string;
  className?: string;
}) {
  return (
    <p
      role="status"
      className={cn(
        "rounded-lg border border-dashed border-border bg-surface-muted px-6 py-12 text-center text-sm text-muted",
        className,
      )}
    >
      {message}
    </p>
  );
}
