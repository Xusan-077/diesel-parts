// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CategoryManager, type CategoryView } from "./category-manager";

const request = vi.fn();
const refresh = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock("axios", () => ({
  default: {
    request: (...args: unknown[]) => request(...args),
    isAxiosError: () => false,
  },
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

function category(overrides: Partial<CategoryView> & Pick<CategoryView, "id">): CategoryView {
  return {
    slug: overrides.id,
    name: { uz: overrides.id, ru: overrides.id, en: overrides.id },
    type: "general",
    order: 0,
    icon: null,
    parentId: null,
    productCount: 0,
    childCount: 0,
    ...overrides,
  };
}

const TREE: CategoryView[] = [
  category({
    id: "engine",
    slug: "dvigatel",
    name: { uz: "Dvigatel", ru: "Двигатель", en: "Engine" },
    type: "engine",
    childCount: 1,
  }),
  category({
    id: "injector",
    slug: "forsunkalar",
    name: { uz: "Forsunkalar", ru: "Форсунки", en: "Injectors" },
    type: "engine",
    parentId: "engine",
    productCount: 3,
  }),
];

beforeEach(() => {
  request.mockReset();
  refresh.mockReset();
  toastSuccess.mockReset();
  toastError.mockReset();
  request.mockResolvedValue({ data: { success: true } });
});

afterEach(cleanup);

describe("CategoryManager on an empty catalog", () => {
  it("says the menu is empty and what adding one does", () => {
    render(<CategoryManager categories={[]} />);

    expect(screen.getByText(/Menyu hali bo'sh/)).toBeDefined();
  });
});

describe("CategoryManager listing", () => {
  it("shows each column with the sections under it", () => {
    render(<CategoryManager categories={TREE} />);

    expect(screen.getByText("Dvigatel")).toBeDefined();
    expect(screen.getByText("Forsunkalar")).toBeDefined();
    expect(screen.getByText("1 ta ustun · 2 ta kategoriya")).toBeDefined();
  });
});

describe("CategoryManager adding a category", () => {
  it("fills the slug in from the Uzbek name", async () => {
    render(<CategoryManager categories={TREE} />);

    await userEvent.click(screen.getByRole("button", { name: "Kategoriya qo'shish" }));
    await userEvent.type(screen.getByLabelText("Nomi (uz)"), "Yoqilg'i filtri");

    expect(screen.getByLabelText<HTMLInputElement>("Slug").value).toBe("yoqilgi-filtri");
  });

  it("leaves a hand-written slug alone once it has been typed into", async () => {
    render(<CategoryManager categories={TREE} />);

    await userEvent.click(screen.getByRole("button", { name: "Kategoriya qo'shish" }));
    await userEvent.type(screen.getByLabelText("Slug"), "fuel-filter");
    await userEvent.type(screen.getByLabelText("Nomi (uz)"), "Yoqilg'i filtri");

    expect(screen.getByLabelText<HTMLInputElement>("Slug").value).toBe("fuel-filter");
  });

  it("inherits the part family of the column a section is added to", async () => {
    render(<CategoryManager categories={TREE} />);

    await userEvent.click(screen.getByRole("button", { name: "Bo'lim qo'shish" }));

    expect(screen.getByLabelText<HTMLInputElement>("Toifa").value).toBe("engine");
    expect(screen.getByLabelText<HTMLSelectElement>("Ustun").value).toBe("engine");
  });

  it("posts what the form holds", async () => {
    render(<CategoryManager categories={TREE} />);

    await userEvent.click(screen.getByRole("button", { name: "Kategoriya qo'shish" }));
    await userEvent.type(screen.getByLabelText("Nomi (uz)"), "Tormoz");
    await userEvent.type(screen.getByLabelText("Nomi (ru)"), "Тормоз");
    await userEvent.type(screen.getByLabelText("Nomi (en)"), "Brakes");
    await userEvent.type(screen.getByLabelText("Toifa"), "brakes");
    await userEvent.click(screen.getByRole("button", { name: "Qo'shish" }));

    await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    expect(request.mock.calls[0][0]).toMatchObject({
      url: "/api/v1/categories",
      method: "POST",
      data: {
        name: { uz: "Tormoz", ru: "Тормоз", en: "Brakes" },
        slug: "tormoz",
        type: "brakes",
        parentId: null,
        order: 0,
        icon: null,
      },
    });
    expect(refresh).toHaveBeenCalled();
  });
});

describe("CategoryManager deleting", () => {
  it("refuses in place when the category still holds products", async () => {
    render(<CategoryManager categories={TREE} />);

    await userEvent.click(screen.getAllByRole("button", { name: "O'chirish" })[1]);

    expect(screen.getByText(/3 ta mahsulot bog'langan/)).toBeDefined();
    // The confirm button is the second one now — disabled, so no request goes out.
    const confirm = screen
      .getAllByRole("button", { name: "O'chirish" })
      .find((button) => (button as HTMLButtonElement).disabled);
    expect(confirm).toBeDefined();
    expect(request).not.toHaveBeenCalled();
  });

  it("warns about the sections a column would take with it", async () => {
    render(<CategoryManager categories={TREE} />);

    await userEvent.click(screen.getAllByRole("button", { name: "O'chirish" })[0]);

    expect(screen.getByText(/1 ta pastki bo'lim bor/)).toBeDefined();
  });

  it("asks before deleting, then sends the delete", async () => {
    const lone = [category({ id: "spare", name: { uz: "Zaxira", ru: "Zaxira", en: "Spare" } })];
    render(<CategoryManager categories={lone} />);

    await userEvent.click(screen.getByRole("button", { name: "O'chirish" }));
    expect(request).not.toHaveBeenCalled();

    const buttons = screen.getAllByRole("button", { name: "O'chirish" });
    await userEvent.click(buttons[buttons.length - 1]);

    await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    expect(request.mock.calls[0][0]).toMatchObject({
      url: "/api/v1/categories/spare",
      method: "DELETE",
    });
  });
});
