// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CustomerCreateForm } from "./customer-create-form";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const fetchMock = vi.fn();
const onDone = vi.fn();

function jsonResponse(body: unknown) {
  return Promise.resolve({ json: () => Promise.resolve(body) } as Response);
}

/** The body the form actually posted, parsed. */
function postedBody(): Record<string, unknown> {
  const init = fetchMock.mock.calls[0][1] as RequestInit;
  return JSON.parse(init.body as string) as Record<string, unknown>;
}

beforeEach(() => {
  fetchMock.mockReset();
  refresh.mockReset();
  onDone.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("CustomerCreateForm", () => {
  it("posts the filled fields and closes on success", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation(() => jsonResponse({ success: true, id: "cus-1" }));
    render(<CustomerCreateForm onDone={onDone} />);

    await user.type(screen.getByLabelText("Ismi"), "Anvar Karimov");
    await user.type(screen.getByLabelText("Telefon"), "+998901234567");
    await user.type(screen.getByLabelText("Kompaniya"), "Yo'l Qurilish");
    await user.click(screen.getByRole("button", { name: "Mijoz qo'shish" }));

    expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/customers");
    expect(postedBody()).toEqual({
      name: "Anvar Karimov",
      phone: "+998901234567",
      email: null,
      company: "Yo'l Qurilish",
      notes: null,
    });
    expect(onDone).toHaveBeenCalled();
    expect(refresh).toHaveBeenCalled();
  });

  it("sends blank optional fields as null rather than as empty strings", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation(() => jsonResponse({ success: true, id: "cus-1" }));
    render(<CustomerCreateForm onDone={onDone} />);

    await user.type(screen.getByLabelText("Ismi"), "  Anvar  ");
    await user.type(screen.getByLabelText("Telefon"), "+998901234567");
    await user.click(screen.getByRole("button", { name: "Mijoz qo'shish" }));

    const body = postedBody();
    expect(body.name).toBe("Anvar");
    expect(body.email).toBeNull();
    expect(body.company).toBeNull();
    expect(body.notes).toBeNull();
  });

  it("keeps the form open and shows why when the server refuses", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation(() =>
      jsonResponse({ success: false, errors: { _root: ["Telefon noto'g'ri."] } }),
    );
    render(<CustomerCreateForm onDone={onDone} />);

    await user.type(screen.getByLabelText("Ismi"), "Anvar");
    await user.type(screen.getByLabelText("Telefon"), "12");
    await user.click(screen.getByRole("button", { name: "Mijoz qo'shish" }));

    expect(await screen.findByText("Telefon noto'g'ri.")).toBeDefined();
    expect(onDone).not.toHaveBeenCalled();
    // The typed name is still there to correct rather than retype.
    expect(screen.getByLabelText<HTMLInputElement>("Ismi").value).toBe("Anvar");
  });

  it("says so when the request never lands", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation(() => Promise.reject(new Error("offline")));
    render(<CustomerCreateForm onDone={onDone} />);

    await user.type(screen.getByLabelText("Ismi"), "Anvar");
    await user.type(screen.getByLabelText("Telefon"), "+998901234567");
    await user.click(screen.getByRole("button", { name: "Mijoz qo'shish" }));

    expect(await screen.findByText("Ulanmadi. Qayta urinib ko'ring.")).toBeDefined();
    expect(onDone).not.toHaveBeenCalled();
  });

  it("prefills from a board card so the seller retypes nothing", () => {
    render(
      <CustomerCreateForm
        initial={{ name: "Sardor Aliyev", phone: "+998901112233" }}
        onDone={onDone}
      />,
    );

    expect(screen.getByLabelText<HTMLInputElement>("Ismi").value).toBe("Sardor Aliyev");
    expect(screen.getByLabelText<HTMLInputElement>("Telefon").value).toBe("+998901112233");
  });
});
