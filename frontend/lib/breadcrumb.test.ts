import { describe, expect, it } from "vitest";
import { getDictionary } from "@/lib/i18n/dictionaries";
import {
  buildBreadcrumbs,
  finalise,
  pathSegments,
  staticRouteLabels,
  type BreadcrumbItem,
} from "./breadcrumb";

const dict = getDictionary("uz");
const labels = staticRouteLabels(dict);
const homeLabel = dict.nav.home;

function build(pathname: string): BreadcrumbItem[] | null {
  return buildBreadcrumbs({ pathname, homeLabel, labels });
}

describe("pathSegments", () => {
  it("splits a path", () => {
    expect(pathSegments("/products/injector")).toEqual(["products", "injector"]);
  });

  it("treats the root as no segments", () => {
    expect(pathSegments("/")).toEqual([]);
    expect(pathSegments("")).toEqual([]);
  });

  it("tolerates a trailing slash", () => {
    expect(pathSegments("/products/")).toEqual(["products"]);
  });
});

describe("buildBreadcrumbs", () => {
  /*
   * The distinction the layout depends on: no trail and no answer are not the
   * same. Home genuinely has no trail; a product page has one this cannot
   * build, and the page renders it instead.
   */
  it("returns an empty trail for the home page", () => {
    expect(build("/")).toEqual([]);
  });

  it("returns null for a route whose segments are slugs", () => {
    expect(build("/products/cat-fuel-injector-3126")).toBeNull();
    expect(build("/brands/cat")).toBeNull();
    expect(build("/blog/how-to-choose-diesel-injectors")).toBeNull();
  });

  it("names no segment that has no page behind it", () => {
    // /categories/[slug] exists; /categories does not. A crumb is a link, so
    // every label here has to be somewhere the reader can actually go.
    expect(labels.categories).toBeUndefined();
  });

  it("builds a one-level trail from home", () => {
    expect(build("/delivery")).toEqual([
      { label: homeLabel, href: "/" },
      { label: dict.nav.delivery },
    ]);
  });

  it("links every crumb but the last", () => {
    const trail = build("/products");
    expect(trail?.at(0)?.href).toBe("/");
    expect(trail?.at(-1)?.href).toBeUndefined();
  });

  it("accumulates hrefs down the path", () => {
    const trail = buildBreadcrumbs({
      pathname: "/account/login",
      homeLabel,
      labels: { ...labels, login: dict.account.loginTitle },
    });

    expect(trail).toEqual([
      { label: homeLabel, href: "/" },
      { label: dict.account.profileTitle, href: "/account" },
      { label: dict.account.loginTitle },
    ]);
  });
});

describe("finalise", () => {
  it("drops the link from the crumb you are standing on", () => {
    const trail = finalise([
      { label: "A", href: "/a" },
      { label: "B", href: "/a/b" },
    ]);

    expect(trail).toEqual([{ label: "A", href: "/a" }, { label: "B" }]);
  });

  it("leaves a single crumb unlinked", () => {
    expect(finalise([{ label: "A", href: "/a" }])).toEqual([{ label: "A" }]);
  });

  it("handles an empty trail", () => {
    expect(finalise([])).toEqual([]);
  });
});

describe("staticRouteLabels", () => {
  it("names every static top-level route the main nav links to", () => {
    for (const href of [
      "/products",
      "/brands",
      "/partnership",
      "/services",
      "/delivery",
      "/payment",
      "/about",
      "/contact",
    ]) {
      expect(labels[href.slice(1)], href).toBeTypeOf("string");
    }
  });

  it("is translated per locale", () => {
    expect(staticRouteLabels(getDictionary("ru")).delivery).toBe(
      getDictionary("ru").nav.delivery
    );
  });
});
