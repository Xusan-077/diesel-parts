// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FloatingContactWidget } from "./floating-contact-widget";
import { SUPPORT_CONTACT, telegramHref } from "@/lib/site-config";
import dictionary from "@/dictionaries/uz.json";

const { support, common } = dictionary;

function setup() {
  return {
    user: userEvent.setup(),
    ...render(<FloatingContactWidget support={support} closeLabel={common.close} />),
  };
}

/** The panel animates out, so it outlives the state change that dismissed it. */
function expectDismissed() {
  return waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
}

afterEach(cleanup);

describe("FloatingContactWidget", () => {
  it("keeps the panel closed until the button is pressed", () => {
    setup();

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(
      screen.getByRole("button", { name: support.open }).getAttribute("aria-expanded")
    ).toBe("false");
  });

  it("opens the panel and marks the trigger expanded", async () => {
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: support.open }));

    expect(screen.getByRole("dialog", { name: support.title })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: support.title }).getAttribute("aria-expanded")
    ).toBe("true");
  });

  /*
   * Once open, the trigger and the panel's X must not answer to the same name —
   * that is the defect this asserts against, not the labels themselves.
   */
  it("gives the trigger and the panel's close button distinct names", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: support.open }));

    expect(screen.getAllByRole("button", { name: common.close })).toHaveLength(1);
  });

  /*
   * The two channels are the whole point of the widget, and both hrefs are
   * derived from config — so a wrong handle, or a number that lost its `+`,
   * fails here rather than in a visitor's dialler.
   */
  it("links each channel at the configured destination", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: support.open }));

    expect(
      screen.getByRole("link", { name: new RegExp(support.telegram) }).getAttribute("href")
    ).toBe(telegramHref(SUPPORT_CONTACT.telegramUsername));
    expect(
      screen.getByRole("link", { name: new RegExp(support.call) }).getAttribute("href")
    ).toBe(`tel:${SUPPORT_CONTACT.phone.tel}`);
  });

  it("closes on Escape and hands focus back to the trigger", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: support.open }));

    await user.keyboard("{Escape}");

    await expectDismissed();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: support.open }));
  });

  it("closes when a pointer lands outside the widget", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: support.open }));

    await user.click(document.body);

    await expectDismissed();
  });
});
