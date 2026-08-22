// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { FloatingPaths } from "./background-paths";

afterEach(cleanup);

const SOURCE = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "background-paths.tsx"),
  "utf8",
);

describe("FloatingPaths", () => {
  it("draws a sheaf that thickens as it fans out", () => {
    const { container } = render(<FloatingPaths position={1} />);
    const paths = container.querySelectorAll("path");

    expect(paths.length).toBe(36);
    expect(Number(paths[0].getAttribute("stroke-width"))).toBeLessThan(
      Number(paths[35].getAttribute("stroke-width")),
    );
  });

  it("leans the second sheaf the other way", () => {
    const { container: right } = render(<FloatingPaths position={1} />);
    const { container: left } = render(<FloatingPaths position={-1} />);

    // The tenth line and not the first: the two sheafs are pinned together at
    // index 0 by construction and only fan apart from there.
    expect(right.querySelectorAll("path")[10].getAttribute("d")).not.toBe(
      left.querySelectorAll("path")[10].getAttribute("d"),
    );
  });

  /*
   * The regression this file exists for.
   *
   * The version this was adapted from animates `pathLength` and `pathOffset`
   * per path, which is 72 JS-driven animations on the login screen: every
   * frame rewrites the dash geometry of all 72 and repaints the column, and
   * the page stops responding to typing and clicks. The drift belongs to the
   * group, in CSS, where it is one transform per sheaf.
   */
  it("animates the group and never the individual paths", () => {
    const { container } = render(<FloatingPaths position={1} />);

    expect(container.querySelectorAll(".door-paths").length).toBe(1);
    for (const path of container.querySelectorAll("path")) {
      expect(path.getAttribute("style")).toBeNull();
      expect(path.getAttribute("class")).toBeNull();
    }
  });

  it("stays a server component with no animation runtime", () => {
    // The directive, not the words: the file's own comment explains why it is
    // absent, and a bare `toContain` would read that as the directive itself.
    expect(SOURCE.trimStart().startsWith('"use client"')).toBe(false);
    expect(SOURCE).not.toMatch(/from "motion/);
  });
});
