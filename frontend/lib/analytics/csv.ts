/**
 * CSV for the analytics screen's export buttons.
 *
 * Pure and browser-free so it can be tested directly; the download itself is a
 * few lines at the call site in `export-button.tsx`.
 */

/**
 * One field, escaped.
 *
 * Quoting is not conditional. RFC 4180 lets a field go bare when it holds no
 * comma, quote or newline, and doing that here would mean an SKU like
 * `DP-INJ-3126` exports bare while `Yoqilg'i, dizel` exports quoted — same
 * column, two shapes, and a hand-written parser downstream that works on the
 * sample and fails on the real file. Always quoting costs two bytes a field.
 */
function cell(value: string | number | null): string {
  if (value === null) {
    return '""';
  }

  const text = typeof value === "number" ? String(value) : value;
  return '"' + text.replace(/"/g, '""') + '"';
}

export interface CsvColumn<T> {
  header: string;
  /**
   * The value for one row. Returns a raw number where the column is numeric —
   * formatting it here would export "1,2 mln" into a spreadsheet column that
   * can no longer be summed, which is the one thing an export is for.
   */
  value: (row: T) => string | number | null;
}

/**
 * Rows and columns to a CSV document.
 *
 * `\r\n` line endings and a UTF-8 BOM, both for the same reader: Excel on
 * Windows, which is what this file is opened in. Without the BOM it decodes
 * the Uzbek Latin apostrophes as mojibake; without CRLF it puts the whole
 * document on one line in older builds.
 */
export function toCsv<T>(columns: readonly CsvColumn<T>[], rows: readonly T[]): string {
  const head = columns.map((column) => cell(column.header)).join(",");
  const body = rows.map((row) => columns.map((column) => cell(column.value(row))).join(","));

  return "﻿" + [head, ...body].join("\r\n") + "\r\n";
}

/**
 * A filename that sorts by date and says what it holds.
 *
 * `diesel-parts-sotuv-2026-08-01_2026-08-22.csv` — the slug, then the window,
 * so a directory of exports taken over months stays ordered and self-describing
 * rather than being six files called `export (3).csv`.
 */
export function csvFilename(slug: string, from: Date, to: Date): string {
  const day = (date: Date) => date.toISOString().slice(0, 10);
  return `diesel-parts-${slug}-${day(from)}_${day(to)}.csv`;
}
