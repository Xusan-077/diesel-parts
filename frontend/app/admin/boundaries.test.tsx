// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminError from "./error";
import AdminNotFound from "./not-found";

afterEach(cleanup);

/*
 * The two screens a staff member only ever sees on a bad day, so neither gets
 * looked at in normal use. Both were missing entirely until now: an unreachable
 * database rendered Next's unstyled "This page couldn't load", and every
 * `notFound()` in the panel rendered its default 404.
 *
 * The end-to-end 404 path could not be exercised by hand while writing these:
 * both `notFound()` call sites in the panel (a product id, a customer id) sit
 * behind a query, so with the database down the error boundary catches it first
 * and the 404 is never reached.
 */
describe("the panel's 404", () => {
  it("names the panel and offers the way back", () => {
    render(<AdminNotFound />);

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Sahifa topilmadi");
    expect(screen.getByRole("link", { name: "Panelga qaytish" }).getAttribute("href")).toBe(
      "/admin",
    );
  });
});

describe("the panel's error boundary", () => {
  const error = Object.assign(new Error("Server has closed the connection."), {
    digest: "3141592653",
  });

  it("retries in place rather than reloading the page", async () => {
    const reset = vi.fn();
    render(<AdminError error={error} reset={reset} />);

    await userEvent.click(screen.getByRole("button", { name: "Qayta urinish" }));

    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("escapes to the login screen, the one route that needs no database", () => {
    /*
     * Not `/admin`: that calls `requireStaff()`, which reads the user row, so on
     * the failure this boundary exists for it would throw straight back in here
     * and the reader would be stuck in a loop with no way out.
     */
    render(<AdminError error={error} reset={vi.fn()} />);

    expect(screen.getByRole("link", { name: "Kirish sahifasi" }).getAttribute("href")).toBe(
      "/director/login",
    );
  });
});
