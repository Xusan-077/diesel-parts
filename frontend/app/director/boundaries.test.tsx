// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DirectorError from "./error";
import DirectorNotFound from "./not-found";

afterEach(cleanup);

/*
 * `/director`'s own boundaries — see app/panel/boundaries.test.tsx for the
 * merged panel's copies. Almost nothing lives under `/director` any more
 * (just `/director/login`), so "back to the panel" here points at `/panel`,
 * not at this root itself.
 */
describe("the director panel's 404", () => {
  it("names the panel and offers the way back", () => {
    render(<DirectorNotFound />);

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Sahifa topilmadi");
    expect(screen.getByRole("link", { name: "Panelga qaytish" }).getAttribute("href")).toBe(
      "/panel",
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
