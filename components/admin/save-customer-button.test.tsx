// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SaveCustomerButton } from "./save-customer-button";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const fetchMock = vi.fn();

function jsonResponse(body: unknown) {
  return Promise.resolve({ json: () => Promise.resolve(body) } as Response);
}

const lead = {
  customerName: "Sardor Aliyev",
  phone: "+998901234567",
  email: "sardor@example.uz",
  message: "Bosch forsunka bormi?",
};

beforeEach(() => {
  fetchMock.mockReset();
  refresh.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("SaveCustomerButton", () => {
  it("creates the customer from the card and then links to it", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation(() => jsonResponse({ success: true, id: "cus-9" }));
    render(<SaveCustomerButton {...lead} saved={null} />);

    await user.click(screen.getByRole("button", { name: "Mijozlarga qo'shish" }));

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/customers");
    expect(JSON.parse(init.body as string)).toEqual({
      name: "Sardor Aliyev",
      phone: "+998901234567",
      email: "sardor@example.uz",
      notes: "So'rovdan: Bosch forsunka bormi?",
    });

    const link = await screen.findByRole("link", { name: /Mijoz kartasi/ });
    expect(link.getAttribute("href")).toBe("/admin/seller/customers/cus-9");
    expect(screen.queryByRole("button", { name: "Mijozlarga qo'shish" })).toBeNull();
    expect(refresh).toHaveBeenCalled();
  });

  it("offers a link instead of the button when the number is already in the book", () => {
    render(<SaveCustomerButton {...lead} saved={{ id: "cus-1", name: "Sardor Aliyev" }} />);

    expect(screen.getByRole("link", { name: /Sardor Aliyev/ }).getAttribute("href")).toBe(
      "/admin/seller/customers/cus-1",
    );
    expect(screen.queryByRole("button")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps the button and says why when the save is refused", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation(() =>
      jsonResponse({ success: false, errors: { _root: ["Saqlanmadi."] } }),
    );
    render(<SaveCustomerButton {...lead} saved={null} />);

    await user.click(screen.getByRole("button", { name: "Mijozlarga qo'shish" }));

    expect(await screen.findByText("Saqlanmadi.")).toBeDefined();
    expect(screen.getByRole("button", { name: "Mijozlarga qo'shish" })).toBeDefined();
  });

  it("says so when the request never lands", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation(() => Promise.reject(new Error("offline")));
    render(<SaveCustomerButton {...lead} saved={null} />);

    await user.click(screen.getByRole("button", { name: "Mijozlarga qo'shish" }));

    expect(await screen.findByText("Ulanmadi. Qayta urinib ko'ring.")).toBeDefined();
  });
});
