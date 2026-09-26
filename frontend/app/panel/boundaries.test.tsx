// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PanelError from "./error";
import PanelNotFound from "./not-found";
import PanelForbidden from "./forbidden";

afterEach(cleanup);

/*
 * The two screens a staff member only ever sees on a bad day, so neither gets
 * looked at in normal use. Both were missing entirely until the panel first
 * merged (see app/admin/error.tsx's original doc comment): an unreachable
 * database rendered Next's unstyled "This page couldn't load", and every
 * `notFound()` in the panel rendered its default 404.
 */
describe("the panel's 404", () => {
  it("names the panel and offers the way back", () => {
    render(<PanelNotFound />);

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Sahifa topilmadi");
    expect(screen.getByRole("link", { name: "Panelga qaytish" }).getAttribute("href")).toBe(
      "/panel",
    );
  });
});

describe("the panel's error boundary", () => {
  const error = Object.assign(new Error("Server has closed the connection."), {
    digest: "3141592653",
  });

  it("retries in place rather than reloading the page", async () => {
    const reset = vi.fn();
    render(<PanelError error={error} reset={reset} />);

    await userEvent.click(screen.getByRole("button", { name: "Qayta urinish" }));

    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("escapes to the login screen, the one route that needs no database", () => {
    /*
     * Not `/panel`: that runs the gate (`(gated)/layout.tsx`), which reads
     * the user row, so on the failure this boundary exists for it would
     * throw straight back in here. The login page touches no database at
     * all and is the one panel route that always renders.
     */
    render(<PanelError error={error} reset={vi.fn()} />);

    expect(screen.getByRole("link", { name: "Kirish sahifasi" }).getAttribute("href")).toBe(
      "/director/login",
    );
  });
});

describe("the panel's forbidden screen", () => {
  it("names the restriction and offers the way back", () => {
    render(<PanelForbidden />);

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Ruxsat yo'q");
    expect(screen.getByRole("link", { name: "Panelga qaytish" }).getAttribute("href")).toBe(
      "/panel",
    );
  });
});
