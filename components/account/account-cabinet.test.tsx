// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AccountCabinet } from "./account-cabinet";
import { useProfileStore } from "@/lib/store/stores";
import { EMPTY_PROFILE } from "@/lib/account/profile";
import dictionary from "@/dictionaries/uz.json";

/*
 * The panel's data has no server behind it — the profile lives in the browser
 * store and the number comes from the session cookie. These pin down the two
 * things that arrangement makes easy to get wrong: that an unfilled field says
 * so instead of rendering blank, and that saving the modal is what updates the
 * card rather than the form keeping its own copy.
 */

const post = vi.fn();
const push = vi.fn();
const refresh = vi.fn();

vi.mock("axios", () => ({
  default: {
    post: (...args: unknown[]) => post(...args),
    isAxiosError: () => false,
  },
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const account = dictionary.account;
const panel = account.profilePanel;
const PHONE = "+998 90 123-45-67";

beforeEach(() => {
  post.mockReset().mockResolvedValue({ data: {} });
  push.mockReset();
  refresh.mockReset();
  localStorage.clear();
  useProfileStore.setState({ profile: EMPTY_PROFILE });
});

afterEach(cleanup);

function renderCabinet() {
  return render(<AccountCabinet dict={account} phone={PHONE} />);
}

describe("AccountCabinet", () => {
  it("opens on the details card and shows the signed-in number", () => {
    renderCabinet();

    expect(screen.getByRole("heading", { name: panel.detailsTitle })).toBeDefined();
    // Once on the phone card, and once under the name in each identity head.
    expect(screen.getAllByText(PHONE).length).toBeGreaterThan(0);
  });

  it("says a field is empty rather than leaving it blank", () => {
    renderCabinet();

    expect(screen.getAllByText(panel.notFilled)).toHaveLength(3);
    expect(screen.getAllByText(panel.genderUnset).length).toBeGreaterThan(0);
  });

  it("saves the edited details onto the card and into the store", async () => {
    const user = userEvent.setup();
    renderCabinet();

    await user.click(screen.getAllByRole("button", { name: panel.edit })[0]);

    const modal = await screen.findByRole("dialog");
    await user.type(within(modal).getByLabelText(panel.firstName), "Aziz");
    await user.type(within(modal).getByLabelText(panel.lastName), "Karimov");
    await user.selectOptions(within(modal).getByLabelText(panel.gender), "male");
    await user.click(within(modal).getByRole("button", { name: panel.save }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    expect(useProfileStore.getState().profile).toMatchObject({
      firstName: "Aziz",
      lastName: "Karimov",
      gender: "male",
    });
    expect(screen.getAllByText("Aziz Karimov").length).toBeGreaterThan(0);
    expect(screen.getAllByText(panel.genderMale).length).toBeGreaterThan(0);
  });

  it("refuses a name that is one character and keeps the modal open", async () => {
    const user = userEvent.setup();
    renderCabinet();

    await user.click(screen.getAllByRole("button", { name: panel.edit })[0]);
    const modal = await screen.findByRole("dialog");
    await user.type(within(modal).getByLabelText(panel.firstName), "A");
    await user.type(within(modal).getByLabelText(panel.lastName), "K");
    await user.click(within(modal).getByRole("button", { name: panel.save }));

    expect(await within(modal).findAllByText(panel.errorTooShort)).toHaveLength(2);
    expect(useProfileStore.getState().profile).toEqual(EMPTY_PROFILE);
  });

  it("states that signing in is by SMS code, with no password to change", () => {
    renderCabinet();

    expect(screen.getByRole("heading", { name: panel.securityTitle })).toBeDefined();
    expect(screen.getByText(panel.signInBySms)).toBeDefined();
    // Two edit controls on the page — details and phone. Security has none.
    expect(screen.getAllByRole("button", { name: panel.edit })).toHaveLength(2);
  });

  it("swaps the panel for the section the menu picks", async () => {
    const user = userEvent.setup();
    renderCabinet();

    await user.click(screen.getByRole("button", { name: panel.nav.reviews }));

    expect(screen.getByText(panel.empty.reviews)).toBeDefined();
    expect(screen.queryByRole("heading", { name: panel.detailsTitle })).toBeNull();
  });

  it("clears the session when the menu's sign-out is used", async () => {
    const user = userEvent.setup();
    renderCabinet();

    await user.click(screen.getByRole("button", { name: panel.nav.logout }));

    await waitFor(() => expect(post).toHaveBeenCalledWith("/api/auth/logout"));
    expect(push).toHaveBeenCalledWith("/");
  });

  it("deleting the account wipes the stored profile and signs out", async () => {
    const user = userEvent.setup();
    useProfileStore.setState({ profile: { ...EMPTY_PROFILE, firstName: "Aziz" } });
    renderCabinet();

    await user.click(screen.getByRole("button", { name: panel.deleteTitle }));
    const modal = await screen.findByRole("dialog");
    await user.click(within(modal).getByRole("button", { name: panel.deleteConfirm }));

    await waitFor(() => expect(post).toHaveBeenCalledWith("/api/auth/logout"));
    expect(useProfileStore.getState().profile).toEqual(EMPTY_PROFILE);
  });
});
