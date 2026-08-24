// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginForm } from "./login-form";
import { refusal } from "./refusal.fixture";

/** This project installs no jest-dom, so the DOM is read directly. */
const post = vi.fn();
const replace = vi.fn();
const refresh = vi.fn();

vi.mock("@/lib/api/admin/client", () => ({
  panelClient: {
    get: vi.fn(),
    post: (...args: unknown[]) => post(...args),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh }) }));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

beforeEach(() => {
  post.mockReset();
  replace.mockReset();
  refresh.mockReset();
});

afterEach(cleanup);

async function signIn(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Email"), "direktor@dieselparts.uz");
  await user.type(screen.getByLabelText("Parol"), "parol123");
  await user.click(screen.getByRole("button", { name: "Kirish" }));
}

describe("LoginForm", () => {
  it("posts the credentials and lands on the requested page", async () => {
    const user = userEvent.setup();
    post.mockResolvedValue({ data: { success: true, redirectTo: "/admin" } });
    render(<LoginForm next="/director/products" />);

    await signIn(user);

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post.mock.calls[0][0]).toBe("/auth/login");
    expect(post.mock.calls[0][1]).toEqual({
      email: "direktor@dieselparts.uz",
      password: "parol123",
    });
    expect(replace).toHaveBeenCalledWith("/director/products");
    expect(refresh).toHaveBeenCalled();
  });

  it("falls back to the panel's own redirect when no next was given", async () => {
    const user = userEvent.setup();
    post.mockResolvedValue({ data: { success: true, redirectTo: "/admin/seller" } });
    render(<LoginForm next={null} />);

    await signIn(user);

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/admin/seller"));
  });

  it("prints what the server said and stays put", async () => {
    const user = userEvent.setup();
    post.mockRejectedValue(refusal({ errors: { _root: ["Email yoki parol noto'g'ri."] } }, 401));
    render(<LoginForm next={null} />);

    await signIn(user);

    expect(await screen.findByText("Email yoki parol noto'g'ri.")).toBeDefined();
    expect(replace).not.toHaveBeenCalled();
  });

  it("refuses an address that is not one, without asking the server", async () => {
    const user = userEvent.setup();
    render(<LoginForm next={null} />);

    await user.type(screen.getByLabelText("Email"), "direktor");
    await user.type(screen.getByLabelText("Parol"), "parol123");
    await user.click(screen.getByRole("button", { name: "Kirish" }));

    expect(await screen.findByText("To'g'ri email kiriting.")).toBeDefined();
    expect(post).not.toHaveBeenCalled();
  });

  it("reveals the password on request", async () => {
    const user = userEvent.setup();
    render(<LoginForm next={null} />);

    const password = screen.getByLabelText<HTMLInputElement>("Parol");
    expect(password.type).toBe("password");

    await user.click(screen.getByRole("button", { name: "Parolni ko'rsatish" }));
    expect(screen.getByLabelText<HTMLInputElement>("Parol").type).toBe("text");

    await user.click(screen.getByRole("button", { name: "Parolni yashirish" }));
    expect(screen.getByLabelText<HTMLInputElement>("Parol").type).toBe("password");
  });
});
