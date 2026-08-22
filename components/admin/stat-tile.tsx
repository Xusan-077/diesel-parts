import type { LucideIcon } from "lucide-react";
import { formatDelta } from "@/lib/analytics/format";
import { Icon } from "@/components/ui/icon";
import { Gauge, type GaugeTone } from "@/components/admin/gauge";

/**
 * One headline number. A single current value is a stat tile, not a one-bar
 * chart — see the data-viz form heuristic.
 *
 * Read top to bottom, the tile is a sentence with the verb first:
 *
 *   1. **the glyph, in a tinted disc** — top left, so the strip is scannable by
 *      shape before a word of it is read. A disc rather than the previous 24px
 *      square: the square was the same shape and size as the badge opposite it,
 *      and two identical marks at either end of a row is a symmetry that says
 *      nothing;
 *   2. **the change, as a pill** — top right, carrying arrow, sign and colour
 *      together so direction survives colour-blindness and a monochrome print.
 *      It sits at the top because "up or down" is the question the strip
 *      exists to answer and it was previously the last thing on the tile;
 *   3. **the figure**, at `type-figure` — a step of its own above the type
 *      scale, because `text-2xl` set a sum of money at exactly the size of the
 *      page's own <h1> and nothing on the screen claimed to be the point;
 *   4. **the label and the footnote**, quiet, at the bottom. The label moved
 *      below the figure deliberately: a director opens this screen to read
 *      numbers, and the four words naming them are how you check you read the
 *      right one, not how you find it;
 *   5. **the peak-hold gauge**, which answers "ahead or behind" before the
 *      percentage has been read.
 *
 * `emphasis="quiet"` drops (3) to the smaller figure step and omits the gauge.
 * The dashboard's lower strip reports queue depths, and setting a count of
 * three next to a sum of 355 million at the same size is most of what made the
 * screen read as flat.
 */
export function StatTile({
  label,
  value,
  unit,
  change,
  comparisonLabel,
  hint,
  icon,
  emphasis = "loud",
  gauge,
  noComparisonLabel,
}: {
  label: string;
  value: string;
  /**
   * The currency word, kept out of `value`.
   *
   * `formatSum` returns "1 897 471 900 so'm" as one string, and at four tiles
   * across that wraps — leaving "so'm" alone on a second line at the same size
   * and weight as the figure, where it reads for a beat as another number. The
   * unit is not data; it is small and muted, and it is the part allowed to
   * wrap.
   */
  unit?: string;
  change?: number | null;
  comparisonLabel?: string;
  hint?: string;
  /** The tile's silhouette. Decorative — the label is the label. */
  icon?: LucideIcon;
  /** "loud" for a period measure, "quiet" for a queue depth. */
  emphasis?: "loud" | "quiet";
  /**
   * The two readings behind the gauge, in the tile's own units. Omitted when
   * there is no previous reading to hold a mark at.
   */
  gauge?: { value: number; reference: number; tone?: GaugeTone };
  /** Shown in place of the footnote when there is nothing to compare against. */
  noComparisonLabel?: string;
}) {
  const delta = change === undefined ? null : formatDelta(change);
  const rising = (change ?? 0) > 0;
  const flat = change === 0;
  const loud = emphasis === "loud";

  return (
    <div className={"panel panel-lift flex h-full flex-col " + (loud ? "panel-wash" : "")}>
      <div className="flex items-start justify-between gap-3">
        {icon ? (
          /* One disc treatment for every tile. Colour-coding it per measure was
             tried and cut: the tile is already named in words, so a hue there
             says nothing the label does not, and it spends the page's one
             accent on decoration. The colour that survived is on the gauge bar,
             where it distinguishes money banked from money merely agreed. */
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-accent-edge bg-accent-subtle">
            <Icon icon={icon} size="sm" className="text-accent-strong" />
          </span>
        ) : (
          <span aria-hidden="true" />
        )}

        {delta !== null ? (
          <span
            className={
              "inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2 font-mono text-xs font-medium tabular-nums " +
              (flat
                ? "bg-surface-muted text-muted"
                : rising
                  ? "bg-success-surface text-success"
                  : "bg-danger-surface text-danger")
            }
          >
            <span aria-hidden="true">{flat ? "→" : rising ? "↑" : "↓"}</span>
            {delta}
          </span>
        ) : null}
      </div>

      <p className="mt-4 flex flex-wrap items-baseline gap-x-2">
        <span className={(loud ? "type-figure" : "type-figure-sm") + " text-foreground"}>
          {value}
        </span>
        {unit ? <span className="type-caption text-muted">{unit}</span> : null}
      </p>

      <p className="type-label mt-1 text-foreground">{label}</p>

      {/* mt-auto pins the footnote to the card's bottom padding, so a row of
          tiles shares a baseline top and bottom however long each hint runs. */}
      <p className="type-caption mt-auto pt-2 text-muted">
        {delta !== null && comparisonLabel
          ? comparisonLabel
          : (hint ?? noComparisonLabel ?? "")}
      </p>

      {gauge && loud ? (
        <Gauge value={gauge.value} reference={gauge.reference} tone={gauge.tone} />
      ) : null}
    </div>
  );
}
