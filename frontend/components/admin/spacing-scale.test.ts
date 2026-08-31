import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it } from "vitest";

/*
 * The panel's spacing scale, enforced.
 *
 * Every margin, padding and gap in the staff panel comes from one ramp:
 *
 *   0 · 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64px
 *   0 ·  1 · 2 ·  3 ·  4 ·  6 ·  8 · 12 ·  16   (Tailwind steps)
 *
 * It is a scale rather than a preference because the alternative is what the
 * panel actually had: cards 24px apart on one screen and 20px on the next, a
 * table row at 10px and the identical table beside it at 12px, four different
 * gaps between a label and its input. None of those differences meant
 * anything, and every one of them was visible.
 *
 * This is asserted rather than left to review because the failure mode is
 * invisible one file at a time — nobody rejects a `mt-5`. It only shows up as
 * a screen that feels untidy for no nameable reason.
 */
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SURFACES = ["app/admin", "components/admin"];

const ALLOWED = new Set(["0", "1", "2", "3", "4", "6", "8", "12", "16"]);

/**
 * Matches a Tailwind spacing utility with a numeric step, keeping any
 * responsive prefix. `min-w-`, `h-`, `top-` and friends are sizes, not spacing,
 * and are not on this ramp.
 */
const SPACING = /(?:^|[\s"'`{])(?:(?:sm|md|lg|xl|2xl):)?-?((?:m|p)[trblxy]?|gap-[xy]|gap|space-[xy])-(\d+(?:\.\d+)?)\b/g;

/** Comments discuss class names; only what ships to the browser is checked. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("//"))
    .join("\n");
}

function tsxFiles(dir: string): string[] {
  const full = path.join(ROOT, dir);
  return readdirSync(full).flatMap((entry) => {
    const child = path.join(dir, entry);
    if (statSync(path.join(ROOT, child)).isDirectory()) {
      return tsxFiles(child);
    }
    return entry.endsWith(".tsx") && !entry.endsWith(".test.tsx") ? [child] : [];
  });
}

describe("the panel's spacing scale", () => {
  const files = SURFACES.flatMap(tsxFiles);

  it("covers the whole panel surface", () => {
    // A glob that silently matched nothing would make every assertion below
    // pass without reading a line of the panel.
    expect(files.length).toBeGreaterThan(20);
  });

  it("would notice a step that is off it", () => {
    // Positive control: without this the check below could be passing because
    // the pattern matches nothing at all.
    const offScale = [...'<p className="mt-5 gap-1.5 sm:py-2.5" />'.matchAll(SPACING)]
      .filter((match) => !ALLOWED.has(match[2]))
      .map((match) => match[1] + "-" + match[2]);

    expect(offScale).toEqual(["mt-5", "gap-1.5", "py-2.5"]);
  });

  it.each(files)("%s uses only steps from the ramp", (file) => {
    const source = stripComments(readFileSync(path.join(ROOT, file), "utf8"));
    const offScale = [...source.matchAll(SPACING)]
      .filter((match) => !ALLOWED.has(match[2]))
      .map((match) => match[1] + "-" + match[2]);

    expect([...new Set(offScale)]).toEqual([]);
  });
});
