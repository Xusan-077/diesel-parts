// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SaveCustomerButton } from "./save-customer-button";
import { refusal } from "./refusal.fixture";

const post = vi.fn();

/*
 * The panel's own axios instance, which carries the `/api/v1` base — so these
 * assertions pin the resource path, which is the part a component could get
 * wrong.
 */
vi.mock("@/lib/api/admin/client", () => ({
  panelClient: {
    get: vi.fn(),
    post: (...args: unknown[]) => post(...args),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

const lead = {
  customerName: "Sardor Aliyev",
  phone: "+998901234567",
  email: "sardor@example.uz",
  message: "Bosch forsunka bormi?",
};

/** A fresh client per render: a shared cache would answer the next test. */
function renderButton(props: React.ComponentProps<typeof SaveCustomerButton>) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={queryClient}>
      <SaveCustomerButton {...props} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  post.mockReset();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("SaveCustomerButton", () => {
  it("creates the customer from the card and then links to it", async () => {
    const user = userEvent.setup();
    post.mockResolvedValue({ data: { success: true, id: "cus-9" } });
    renderButton({ ...lead, saved: null });

    await user.click(screen.getByRole("button", { name: "Mijozlarga qo'shish" }));

    expect(post.mock.calls[0][0]).toBe("/customers");
    expect(post.mock.calls[0][1]).toEqual({
      name: "Sardor Aliyev",
      phone: "+998901234567",
      email: "sardor@example.uz",
      notes: "So'rovdan: Bosch forsunka bormi?",
    });

    const link = await screen.findByRole("link", { name: /Mijoz kartasi/ });
    expect(link.getAttribute("href")).toBe("/admin/seller/customers/cus-9");
    expect(screen.queryByRole("button", { name: "Mijozlarga qo'shish" })).toBeNull();
  });

  it("offers a link instead of the button when the number is already in the book", () => {
    renderButton({ ...lead, saved: { id: "cus-1", name: "Sardor Aliyev" } });

    expect(screen.getByRole("link", { name: /Sardor Aliyev/ }).getAttribute("href")).toBe(
      "/admin/seller/customers/cus-1",
    );
    expect(screen.queryByRole("button")).toBeNull();
    expect(post).not.toHaveBeenCalled();
  });

  it("keeps the button and says why when the save is refused", async () => {
    const user = userEvent.setup();
    post.mockRejectedValue(refusal({ success: false, errors: { _root: ["Saqlanmadi."] } }));
    renderButton({ ...lead, saved: null });

    await user.click(screen.getByRole("button", { name: "Mijozlarga qo'shish" }));

    expect(await screen.findByText("Saqlanmadi.")).toBeDefined();
    expect(screen.getByRole("button", { name: "Mijozlarga qo'shish" })).toBeDefined();
  });

  it("says so when the request never lands", async () => {
    const user = userEvent.setup();
    post.mockRejectedValue(new Error("offline"));
    renderButton({ ...lead, saved: null });

    await user.click(screen.getByRole("button", { name: "Mijozlarga qo'shish" }));

    expect(await screen.findByText("Ulanmadi. Qayta urinib ko'ring.")).toBeDefined();
  });
});
