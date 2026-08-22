"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

/**
 * The panel's sortable table.
 *
 * Sorting happens in the browser, on rows the server already sent. That is the
 * right call at this size — an analytics table is a top-N list, tens of rows,
 * not thousands — and it means a sort costs no request and cannot disagree with
 * the chart beside it, which was rendered from the same array.
 *
 * A column declares how to *compare* rather than how to sort, so the direction
 * toggle is the table's business and a column cannot accidentally implement it
 * backwards.
 */

export interface Column<T> {
  key: string;
  header: string;
  /** Right-aligned and set in the data face — for anything numeric. */
  numeric?: boolean;
  /** Omit to make the column unsortable: an actions column, a rank badge. */
  sortValue?: (row: T) => number | string;
  render: (row: T, index: number) => React.ReactNode;
  /** A short line under the header, for a column whose name is not enough. */
  hint?: string;
}

export interface DataTableProps<T> {
  columns: readonly Column<T>[];
  rows: readonly T[];
  rowKey: (row: T) => string;
  /** The column sorted on first load, and the order it starts in. */
  initialSort?: { key: string; direction: "asc" | "desc" };
  emptyMessage: string;
  /** Called when a row is activated, which also makes the rows clickable. */
  onRowClick?: (row: T) => void;
  /** Names what a row click opens, for the row's accessible label. */
  rowActionLabel?: (row: T) => string;
  /** Rows to tint: the best and worst performers in a ranking. */
  highlight?: (row: T) => "positive" | "negative" | null;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  initialSort,
  emptyMessage,
  onRowClick,
  rowActionLabel,
  highlight,
}: DataTableProps<T>) {
  const [sort, setSort] = useState(initialSort ?? null);

  const sorted = useMemo(() => {
    if (sort === null) {
      return rows;
    }

    const column = columns.find((entry) => entry.key === sort.key);
    if (column?.sortValue === undefined) {
      return rows;
    }

    const { sortValue } = column;
    const direction = sort.direction === "asc" ? 1 : -1;

    return [...rows].sort((a, b) => {
      const left = sortValue(a);
      const right = sortValue(b);

      // Text sorts by the reader's own collation, so "Ö" and "O'" land where an
      // Uzbek speaker expects rather than where their code points fall.
      if (typeof left === "string" || typeof right === "string") {
        return String(left).localeCompare(String(right), "uz") * direction;
      }

      return (left - right) * direction;
    });
  }, [columns, rows, sort]);

  function toggle(key: string) {
    setSort((current) => {
      if (current?.key !== key) {
        /*
         * A fresh column starts descending. Every sortable column here is a
         * measure — revenue, units, a rate — and the question is always "who is
         * at the top", so ascending would put the least interesting row first
         * and cost a second click every time.
         */
        return { key, direction: "desc" };
      }
      return { key, direction: current.direction === "desc" ? "asc" : "desc" };
    });
  }

  if (rows.length === 0) {
    return <p className="type-body text-muted">{emptyMessage}</p>;
  }

  return (
    <div className="-mx-2 overflow-x-auto px-2">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border">
            {columns.map((column) => {
              const active = sort?.key === column.key;
              const sortable = column.sortValue !== undefined;

              return (
                <th
                  key={column.key}
                  scope="col"
                  // The live sort state, so a screen reader hears which column
                  // the table is ordered by instead of only seeing an arrow.
                  aria-sort={
                    active ? (sort.direction === "asc" ? "ascending" : "descending") : undefined
                  }
                  className={cn("pb-2 align-bottom", column.numeric && "text-right")}
                >
                  {sortable ? (
                    <button
                      type="button"
                      onClick={() => toggle(column.key)}
                      className={cn(
                        "type-eyebrow inline-flex items-center gap-1 transition-colors hover:text-foreground",
                        active ? "text-foreground" : "text-muted",
                        column.numeric && "flex-row-reverse",
                      )}
                    >
                      <Icon
                        icon={active ? (sort.direction === "asc" ? ArrowUp : ArrowDown) : ChevronsUpDown}
                        size="xs"
                        className={active ? "text-accent-strong" : "text-muted/60"}
                      />
                      {column.header}
                    </button>
                  ) : (
                    <span className="type-eyebrow text-muted">{column.header}</span>
                  )}

                  {column.hint === undefined ? null : (
                    <span className="mt-1 block text-xs font-normal normal-case tracking-normal text-muted">
                      {column.hint}
                    </span>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody>
          {sorted.map((row, index) => {
            const tone = highlight?.(row) ?? null;

            return (
              <tr
                key={rowKey(row)}
                onClick={onRowClick === undefined ? undefined : () => onRowClick(row)}
                className={cn(
                  "border-b border-border last:border-0",
                  onRowClick !== undefined && "row-hover cursor-pointer",
                  /*
                   * A 2px stroke down the left of the row, in the status
                   * colour — the same rail a field wears. It marks the best and
                   * worst rows without tinting a whole row's background, which
                   * would fight every figure printed on top of it.
                   */
                  tone === null
                    ? "border-l-2 border-l-transparent"
                    : tone === "positive"
                      ? "border-l-2 border-l-success"
                      : "border-l-2 border-l-danger",
                )}
              >
                {columns.map((column, columnIndex) => (
                  <td
                    key={column.key}
                    className={cn(
                      "py-3 pr-3",
                      column.numeric && "text-right font-mono tabular-nums",
                      columnIndex === 0 && "pl-3",
                    )}
                  >
                    {columnIndex === 0 && onRowClick !== undefined && rowActionLabel !== undefined ? (
                      /*
                       * The row is the click target, but a click target needs a
                       * keyboard equivalent and a name. The first cell carries a
                       * real button so the row is reachable by Tab and announced
                       * as what it opens — without wrapping every cell, which
                       * would put a dozen tab stops on each row.
                       */
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onRowClick(row);
                        }}
                        className="text-left transition-colors hover:text-accent-strong"
                      >
                        {column.render(row, index)}
                        <span className="sr-only"> — {rowActionLabel(row)}</span>
                      </button>
                    ) : (
                      column.render(row, index)
                    )}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
