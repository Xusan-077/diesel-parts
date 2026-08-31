// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DirectorError from "./error";
import DirectorNotFound from "./not-found";

afterEach(cleanup);

/*
 * The director panel's copies of app/admin/boundaries.test.tsx — see that
 * file for why these two screens exist at all. The only real difference here
 * is where "back to the panel" points: `/director`, this root's own home,
 * rather than `/admin`.
 */
describe("the director panel's 404", () => {
  it("names the panel and offers the way back", () => {
    render(<DirectorNotFound />);

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Sahifa topilmadi");
    expect(screen.getByRole("link", { name: "Panelga qaytish" }).getAttribute("href")).toBe(
      "/director",
    );
  });
});

describe("the director panel's error boundary", () => {
  const error = Object.assign(new Error("Server has closed the connection."), {
    digest: "3141592653",
  });

  it("retries in place rather than reloading the page", async () => {
    const reset = vi.fn();
    render(<DirectorError error={error} reset={reset} />);

    await userEvent.click(screen.getByRole("button", { name: "Qayta urinish" }));

    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("escapes to the shared login screen, the one route that needs no database", () => {
    render(<DirectorError error={error} reset={vi.fn()} />);

    expect(screen.getByRole("link", { name: "Kirish sahifasi" }).getAttribute("href")).toBe(
      "/director/login",
    );
  });
});
