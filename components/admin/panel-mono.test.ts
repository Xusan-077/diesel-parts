import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function source(file: string): string {
  return readFileSync(path.join(ROOT, file), "utf8");
}

/*
 * The panel's data face has to survive a portal.
 *
 * `.admin-root` carries one declaration — JetBrains Mono ahead of Geist Mono —
 * and every dialog in the panel renders through a Radix portal, which mounts to
 * `document.body`. While the class lived only on the panel frame, a product's
 * SKU was set in one mono face in the catalogue table and a different one in the
 * dialog editing that same row: two faces, same string, one screen.
 *
 * This is asserted rather than left to the eye because the difference is a
 * couple of pixels of x-height, which nobody catches in review and everybody
 * feels.
 */
describe("the panel's mono face", () => {
  it("is declared on the body, so portalled dialogs inherit it", () => {
    const layout = source("app/admin/layout.tsx");
    const bodyTag = layout.slice(layout.indexOf("<body"), layout.indexOf(">", layout.indexOf("<body")));

    expect(bodyTag).toContain("admin-root");
  });

  it("still loads the face it is overriding to", () => {
    expect(source("app/admin/layout.tsx")).toContain("jetbrainsMono.variable");
  });

  it("puts JetBrains ahead of Geist, with Geist as the fallback", () => {
    const css = source("app/globals.css");
    const block = css.slice(css.indexOf(".admin-root {"));
    const declaration = block.slice(0, block.indexOf("}"));

    expect(declaration.indexOf("--font-jetbrains-mono")).toBeLessThan(
      declaration.indexOf("--font-geist-mono"),
    );
  });
});
