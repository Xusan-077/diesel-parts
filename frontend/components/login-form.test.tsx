// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginForm } from "./login-form";
import { useSellerAuthStore } from "@/lib/store/seller-auth-store";

const replace = vi.fn();
const refresh = vi.fn();
const sellerLogin = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh }) }));
vi.mock("@/lib/api/seller-panel/auth", () => ({
  login: (...args: unknown[]) => sellerLogin(...args),
}));

function mockFetchOnce(body: unknown, ok = true) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok,
    json: () => Promise.resolve(body),
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  replace.mockClear();
  refresh.mockClear();
  sellerLogin.mockReset();
  useSellerAuthStore.getState().clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("LoginForm", () => {
  it("renders the director copy and an email field", () => {
    render(<LoginForm role="director" next={null} />);

    expect(screen.getByRole("heading", { name: "Direktor paneli" })).toBeInTheDocument();
    expect(screen.getByLabelText<HTMLInputElement>("Email").type).toBe("email");
    expect(screen.getByText("Parolni unutdingizmi? Tizim administratoriga murojaat qiling.")).toBeInTheDocument();
  });

  it("renders the seller copy and a phone field prefilled with the country code", () => {
    render(<LoginForm role="seller" next={null} />);

    expect(screen.getByRole("heading", { name: "Sotuvchi paneli" })).toBeInTheDocument();
    const phone = screen.getByLabelText<HTMLInputElement>("Telefon raqami");
    expect(phone.type).toBe("tel");
    expect(phone.value).toBe("+998 ");
    expect(screen.getByText("Parolni unutdingizmi? Direktoringizga murojaat qiling.")).toBeInTheDocument();
  });

  it("refuses an address that is not one", async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetchOnce({ success: true });
    render(<LoginForm role="director" next={null} />);

    await user.type(screen.getByLabelText("Email"), "direktor");
    await user.type(screen.getByLabelText("Parol"), "parol123");
    await user.click(screen.getByRole("button", { name: "Kirish" }));

    expect(await screen.findByText("To'g'ri email kiriting")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("formats the phone number as the seller types it", async () => {
    const user = userEvent.setup();
    render(<LoginForm role="seller" next={null} />);

    const phone = screen.getByLabelText<HTMLInputElement>("Telefon raqami");
    await user.type(phone, "901234567");
    expect(phone.value).toBe("+998 90 123-45-67");
  });

  it("refuses a phone number that is too short", async () => {
    const user = userEvent.setup();
    render(<LoginForm role="seller" next={null} />);

    await user.type(screen.getByLabelText("Telefon raqami"), "90 123");
    await user.type(screen.getByLabelText("Parol"), "parol123");
    await user.click(screen.getByRole("button", { name: "Kirish" }));

    expect(await screen.findByText("To'g'ri telefon raqamini kiriting")).toBeInTheDocument();
    expect(sellerLogin).not.toHaveBeenCalled();
  });

  it("refuses a password shorter than six characters", async () => {
    const user = userEvent.setup();
    render(<LoginForm role="director" next={null} />);

    await user.type(screen.getByLabelText("Email"), "direktor@dieselparts.uz");
    await user.type(screen.getByLabelText("Parol"), "12345");
    await user.click(screen.getByRole("button", { name: "Kirish" }));

    expect(
      await screen.findByText("Parol kamida 6 belgidan iborat bo'lishi kerak"),
    ).toBeInTheDocument();
  });

  it("reveals the password on request", async () => {
    const user = userEvent.setup();
    render(<LoginForm role="director" next={null} />);

    expect(screen.getByLabelText<HTMLInputElement>("Parol").type).toBe("password");

    await user.click(screen.getByRole("button", { name: "Parolni ko'rsatish" }));
    expect(screen.getByLabelText<HTMLInputElement>("Parol").type).toBe("text");

    await user.click(screen.getByRole("button", { name: "Parolni yashirish" }));
    expect(screen.getByLabelText<HTMLInputElement>("Parol").type).toBe("password");
  });

  it("signs a director in through /api/v1/auth/login and follows the redirect", async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetchOnce({ success: true, redirectTo: "/director" });
    render(<LoginForm role="director" next={null} />);

    await user.type(screen.getByLabelText("Email"), "direktor@dieselparts.uz");
    await user.type(screen.getByLabelText("Parol"), "parol123");
    await user.click(screen.getByRole("button", { name: "Kirish" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/v1/auth/login");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      email: "direktor@dieselparts.uz",
      password: "parol123",
    });
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/director"));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("prefers an explicit next over the server redirect", async () => {
    const user = userEvent.setup();
    mockFetchOnce({ success: true, redirectTo: "/director" });
    render(<LoginForm role="director" next="/director/products" />);

    await user.type(screen.getByLabelText("Email"), "direktor@dieselparts.uz");
    await user.type(screen.getByLabelText("Parol"), "parol123");
    await user.click(screen.getByRole("button", { name: "Kirish" }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/director/products"));
  });

  it("shows the server's message when the director credentials are refused", async () => {
    const user = userEvent.setup();
    mockFetchOnce({ success: false, errors: { _root: ["Email yoki parol noto'g'ri."] } }, false);
    render(<LoginForm role="director" next={null} />);

    await user.type(screen.getByLabelText("Email"), "direktor@dieselparts.uz");
    await user.type(screen.getByLabelText("Parol"), "parol123");
    await user.click(screen.getByRole("button", { name: "Kirish" }));

    expect(await screen.findByText("Email yoki parol noto'g'ri.")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("signs a seller in through the seller API and stores the session", async () => {
    const user = userEvent.setup();
    sellerLogin.mockResolvedValue({
      accessToken: "token-123",
      user: { id: "s1", name: "Sotuvchi", phone: "+998901234567", role: "SELLER" },
    });
    render(<LoginForm role="seller" next={null} />);

    await user.type(screen.getByLabelText("Telefon raqami"), "901234567");
    await user.type(screen.getByLabelText("Parol"), "parol123");
    await user.click(screen.getByRole("button", { name: "Kirish" }));

    await waitFor(() => expect(sellerLogin).toHaveBeenCalledWith("+998901234567", "parol123"));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/seller"));
    expect(useSellerAuthStore.getState().accessToken).toBe("token-123");
    expect(useSellerAuthStore.getState().status).toBe("authenticated");
  });
});
