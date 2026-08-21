import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { controlVariants, fieldRail } from "./field-styles";

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
    expect(controlVariants({ variant: "box" })).toContain("border-border-strong");
  });

  it("defaults to the box, for a control with no field around it", () => {
    expect(controlVariants()).toContain("border-border-strong");
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
