// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CategoryManager, type CategoryView } from "./category-manager";

const get = vi.fn();
const post = vi.fn();
const patch = vi.fn();
const del = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();

/*
 * The panel's own axios instance, which carries the `/api/v1` base — so these
 * assertions pin the resource path, which is the part a component could get
 * wrong.
 */
vi.mock("@/lib/api/admin/client", () => ({
  panelClient: {
    get: (...args: unknown[]) => get(...args),
    post: (...args: unknown[]) => post(...args),
    patch: (...args: unknown[]) => patch(...args),
    delete: (...args: unknown[]) => del(...args),
  },
}));

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

/** A fresh client per render: a shared cache would answer the next test. */
function renderManager(categories: CategoryView[]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={queryClient}>
      <CategoryManager initialData={categories} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  patch.mockReset();
  del.mockReset();
  toastSuccess.mockReset();
  toastError.mockReset();
  for (const mock of [post, patch, del]) {
    mock.mockResolvedValue({ data: { success: true } });
  }
  get.mockResolvedValue({ data: { items: TREE } });
});

afterEach(cleanup);

describe("CategoryManager on an empty catalog", () => {
  it("says the menu is empty and what adding one does", () => {
    renderManager([]);

    expect(screen.getByText(/Menyu hali bo'sh/)).toBeDefined();
  });
});

describe("CategoryManager listing", () => {
  it("shows each column with the sections under it", () => {
    renderManager(TREE);

    expect(screen.getByText("Dvigatel")).toBeDefined();
    expect(screen.getByText("Forsunkalar")).toBeDefined();
    expect(screen.getByText("1 ta ustun · 2 ta kategoriya")).toBeDefined();
  });
});

describe("CategoryManager adding a category", () => {
  it("fills the slug in from the Uzbek name", async () => {
    renderManager(TREE);

    await userEvent.click(screen.getByRole("button", { name: "Kategoriya qo'shish" }));
    await userEvent.type(screen.getByLabelText("Nomi (uz)"), "Yoqilg'i filtri");

    expect(screen.getByLabelText<HTMLInputElement>("Slug").value).toBe("yoqilgi-filtri");
  });

  it("leaves a hand-written slug alone once it has been typed into", async () => {
    renderManager(TREE);

    await userEvent.click(screen.getByRole("button", { name: "Kategoriya qo'shish" }));
    await userEvent.type(screen.getByLabelText("Slug"), "fuel-filter");
    await userEvent.type(screen.getByLabelText("Nomi (uz)"), "Yoqilg'i filtri");

    expect(screen.getByLabelText<HTMLInputElement>("Slug").value).toBe("fuel-filter");
  });

  it("inherits the part family of the column a section is added to", async () => {
    renderManager(TREE);

    await userEvent.click(screen.getByRole("button", { name: "Bo'lim qo'shish" }));

    expect(screen.getByLabelText<HTMLInputElement>("Toifa").value).toBe("engine");
    expect(screen.getByLabelText<HTMLSelectElement>("Ustun").value).toBe("engine");
  });

  it("posts what the form holds", async () => {
    renderManager(TREE);

    await userEvent.click(screen.getByRole("button", { name: "Kategoriya qo'shish" }));
    await userEvent.type(screen.getByLabelText("Nomi (uz)"), "Tormoz");
    await userEvent.type(screen.getByLabelText("Nomi (ru)"), "Тормоз");
    await userEvent.type(screen.getByLabelText("Nomi (en)"), "Brakes");
    await userEvent.type(screen.getByLabelText("Toifa"), "brakes");
    await userEvent.click(screen.getByRole("button", { name: "Qo'shish" }));

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post).toHaveBeenCalledWith("/categories", {
      name: { uz: "Tormoz", ru: "Тормоз", en: "Brakes" },
      slug: "tormoz",
      type: "brakes",
      parentId: null,
      order: 0,
      icon: null,
    });

    /*
     * What replaced `router.refresh()`: the write invalidates the tree, and the
     * list goes back to the API for it rather than patching a row in place.
     */
    await waitFor(() => expect(get).toHaveBeenCalledWith("/categories"));
  });
});

describe("CategoryManager deleting", () => {
  it("refuses in place when the category still holds products", async () => {
    renderManager(TREE);

    await userEvent.click(screen.getAllByRole("button", { name: "O'chirish" })[1]);

    expect(screen.getByText(/3 ta mahsulot bog'langan/)).toBeDefined();
    // The dialog's own control is named apart from the row trigger that opened
    // it, so this finds the confirm button and nothing else.
    const confirm = screen.getByRole<HTMLButtonElement>("button", {
      name: "Kategoriyani o'chirish",
    });
    expect(confirm.disabled).toBe(true);
    expect(del).not.toHaveBeenCalled();
  });

  it("warns about the sections a column would take with it", async () => {
    renderManager(TREE);

    await userEvent.click(screen.getAllByRole("button", { name: "O'chirish" })[0]);

    expect(screen.getByText(/1 ta pastki bo'lim bor/)).toBeDefined();
  });

  it("asks before deleting, then sends the delete", async () => {
    const lone = [category({ id: "spare", name: { uz: "Zaxira", ru: "Zaxira", en: "Spare" } })];
    renderManager(lone);

    await userEvent.click(screen.getByRole("button", { name: "O'chirish" }));
    expect(del).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Kategoriyani o'chirish" }));

    await waitFor(() => expect(del).toHaveBeenCalledTimes(1));
    expect(del).toHaveBeenCalledWith("/categories/spare");
  });
});
