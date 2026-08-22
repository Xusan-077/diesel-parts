import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { controlVariants, fieldBox, fieldRail } from "./field-styles";

/** The Server Components that share the field treatment without the behaviour. */
const SERVER_PAGES = [
  "app/admin/director/products/page.tsx",
  "app/admin/seller/customers/page.tsx",
];

/** The client half — importing any of it from a Server Component opens a boundary. */
const CLIENT_ONLY = [
  "@/components/ui/form-field",
  "@/components/ui/input",
  "@/components/ui/select",
  "@/components/ui/textarea",
  "@/components/ui/checkbox",
];

function source(path: string): string {
  return readFileSync(new URL("../../" + path, import.meta.url), "utf8");
}

/** A module is client-side only if it *opens* with the directive. */
function isClientModule(text: string): boolean {
  const first = text.trimStart();
  return first.startsWith('"use client"') || first.startsWith("'use client'");
}

describe("fieldRail", () => {
  it("is quiet at rest and inks orange only on focus", () => {
    const rail = fieldRail();
    expect(rail).toContain("border-border");
    expect(rail).toContain("focus-within:border-accent-strong");
    expect(rail).not.toContain("border-danger");
  });

  it("goes red on error and stays red under focus", () => {
    const rail = fieldRail({ invalid: true });
    expect(rail).toContain("border-danger");
    expect(rail).not.toContain("focus-within:border-accent-strong");
  });

  it("lets a call site retune the gutter", () => {
    // The toolbar filters sit tighter than a form field.
    const rail = fieldRail({ className: "pl-3" });
    expect(rail).toContain("pl-3");
    expect(rail).not.toContain("pl-4");
  });
});

describe("controlVariants", () => {
  it("drops the frame on the rail and draws one in a box", () => {
    expect(controlVariants({ variant: "rail" })).toContain("border-0");
    expect(controlVariants({ variant: "box" })).toContain("border-field-border");
  });

  it("defaults to the box, for a control with no field around it", () => {
    expect(controlVariants()).toContain("border-field-border");
  });

  /*
   * One focus indicator per control. `ring: "field"` is the control saying the
   * box around it will mark the focus, so the app's own ring must go; without
   * that, a near-black rectangle is drawn 2px out from the *bare* input, which
   * lands inside the field's box horizontally and outside it vertically and
   * cuts through its top and bottom borders.
   */
  it("stands the control's ring down when the field will draw one", () => {
    expect(controlVariants({ variant: "rail", ring: "field" })).toContain(
      "focus:outline-none",
    );
  });

  it("leaves the app's ring alone when nothing else marks the control", () => {
    expect(controlVariants({ variant: "rail" })).not.toContain("outline-none");
  });

  it("lets a standalone box draw a ring that can carry focus on its own", () => {
    const box = controlVariants({ variant: "box" });
    // A solid stop, not just the translucent halo: a bloom cannot reach the
    // 3:1 WCAG 2.2 asks of a focus indicator at any opacity that still blooms.
    expect(box).toContain("focus:shadow-[0_0_0_2px_var(--accent-strong)");
    expect(box).toContain("focus:outline-none");
  });
});

describe("fieldBox", () => {
  it("rings the field itself, in the accent, on focus", () => {
    const box = fieldBox();
    expect(box).toContain("focus-within:border-accent-strong");
    expect(box).toContain("focus-within:shadow-[0_0_0_2px_var(--accent-strong)");
  });

  it("keeps a rejected field red under focus rather than promoting it", () => {
    const box = fieldBox({ invalid: true });
    expect(box).toContain("border-danger");
    expect(box).toContain("focus-within:shadow-[0_0_0_2px_var(--danger)");
    expect(box).not.toContain("accent-strong");
  });
});

/*
 * The half of the fix that does not live in this module.
 *
 * The app's focus ring is declared in `app/globals.css`, and it has to be
 * inside `@layer base`. Unlayered rules outrank every layer, so as a bare
 * `:focus-visible {}` it beat the `focus:outline-none` above outright and the
 * double ring came back — with nothing failing anywhere to say so. This is the
 * cheapest place to notice that.
 */
describe("the app's focus ring", () => {
  /** The `@layer base` block, which is where the app's ring has to live. */
  const base = source("app/globals.css").match(/@layer base \{[\s\S]*?\n\}/)?.[0];

  it("is layered, so a control can opt out of it", () => {
    expect(base, "globals.css must declare an @layer base block").toBeDefined();
    expect(base).toContain(":focus-visible");
  });

  it("does not reshape the element it marks", () => {
    // `border-radius` here applied to the *element*, not to the outline, and
    // squared off every focused button and card. An outline already follows
    // the element's own radius, so there was nothing for it to fix.
    expect(base).toContain("outline: 2px solid var(--foreground)");
    expect(base).not.toContain("border-radius");
  });
});

/*
 * The point of this module: a Server Component can wear the panel's field
 * treatment without being pulled across the client boundary. Both halves of
 * that are load-bearing, and neither is visible in a rendered page, so they
 * are asserted here rather than left to a reviewer to notice.
 */
describe("the server/client boundary", () => {
  it("keeps the style module on the server side of the line", () => {
    const styles = source("components/ui/field-styles.ts");
    expect(isClientModule(styles)).toBe(false);
    expect(styles).not.toMatch(/from "react"/);
  });

  it("still marks the behaviour half as client — the split is real", () => {
    // Positive control: without this the check above could pass because
    // nothing anywhere is a client module.
    expect(isClientModule(source("components/ui/form-field.tsx"))).toBe(true);
  });

  it("keeps the search filters off the client half", () => {
    for (const page of SERVER_PAGES) {
      const text = source(page);
      expect(isClientModule(text), page + " must stay a Server Component").toBe(false);
      expect(text).toContain("@/components/ui/field-styles");
      for (const client of CLIENT_ONLY) {
        expect(text, page + " must not import " + client).not.toContain(client + '"');
      }
    }
  });
});
