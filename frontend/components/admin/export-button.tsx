"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { toCsv, type CsvColumn } from "@/lib/analytics/csv";
import { Icon } from "@/components/ui/icon";

/**
 * Saves one table as CSV, from data the page already has.
 *
 * No request goes out. Every figure on the analytics screen was rendered from
 * rows the server sent, so the export is those same rows serialised in the
 * browser — which means the file cannot disagree with the table above it, and
 * an export of a filtered view exports the filtered view.
 *
 * A `<button>` and not an `<a download>`: the href would have to be a blob URL
 * created before the click, so every table on the page would allocate and hold
 * a copy of its own CSV whether or not anyone ever exported it.
 */
export function ExportButton<T>({
  columns,
  rows,
  filename,
  label = "CSV",
}: {
  columns: readonly CsvColumn<T>[];
  rows: readonly T[];
  filename: string;
  /** Overridden where two exports sit side by side and "CSV" would be ambiguous. */
  label?: string;
}) {
  const [done, setDone] = useState(false);

  function save() {
    const blob = new Blob([toCsv(columns, rows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();

    // Released on the next tick rather than immediately: revoking synchronously
    // races the download in Safari, which has not finished reading the blob.
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    /*
     * A browser gives no signal that a download started, and the file lands
     * somewhere the page cannot see. Without this the button does nothing
     * observable and gets pressed three more times.
     */
    setDone(true);
    setTimeout(() => setDone(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={save}
      disabled={rows.length === 0}
      className="inline-flex h-7 items-center gap-2 rounded-md border border-border px-3 text-xs text-muted transition-colors hover:bg-surface-hover hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Icon icon={Download} size="xs" />
      {done ? "Saqlandi" : label}
    </button>
  );
}
