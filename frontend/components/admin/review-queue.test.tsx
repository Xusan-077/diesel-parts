// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReviewQueue } from "./review-queue";
import type { AdminReviewPage } from "@/lib/api/admin/resources";
import type { ModeratedReview } from "@/lib/api/review-repository";

const get = vi.fn();
const patch = vi.fn();
const del = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();

/*
 * The panel's own axios instance rather than `axios` itself: it carries the
 * `/api/v1` base, so what these assertions pin is the resource path, which is
 * the part a component could get wrong.
 */
vi.mock("@/lib/api/admin/client", () => ({
  panelClient: {
    get: (...args: unknown[]) => get(...args),
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

function review(patchIn: Partial<ModeratedReview> = {}): ModeratedReview {
  return {
    id: "r-1",
    rating: 5,
    body: "Spam matn",
    authorName: "Anvar",
    createdAt: "2026-03-02T00:00:00.000Z",
    isApproved: true,
    product: { id: "p-1", slug: "cat-fuel-injector-3126", name: "CAT 3126 forsunka" },
    ...patchIn,
  };
}

function page(items: ModeratedReview[]): AdminReviewPage {
  return { items, total: items.length, page: 1, pageSize: 20, totalPages: 1 };
}

/** A fresh client per render: a shared cache would answer the next test. */
function renderQueue(items: ModeratedReview[]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={queryClient}>
      <ReviewQueue page={1} initialData={page(items)} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  get.mockReset();
  patch.mockReset();
  del.mockReset();
  toastSuccess.mockReset();
  toastError.mockReset();
  patch.mockResolvedValue({ data: { success: true } });
  del.mockResolvedValue({ data: { success: true } });
  get.mockResolvedValue({ data: page([review()]) });
});

afterEach(cleanup);

describe("ReviewQueue when there is nothing to moderate", () => {
  it("says so and explains what would put something here", () => {
    renderQueue([]);

    expect(screen.getByText("Hozircha sharh yo'q.")).toBeDefined();
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });

  /*
   * The seed is what keeps the panel server-rendered. A queue that ignored it
   * and fetched on mount would flash a skeleton over a list the server had
   * already drawn.
   */
  it("draws the server's page without asking for it again", () => {
    renderQueue([review()]);

    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(get).not.toHaveBeenCalled();
  });
});

describe("ReviewQueue listing", () => {
  /*
   * Not an approval queue — reviews publish on submission — so the screen has
   * to show what is already on the site, not only what is waiting. A list that
   * hid the visible ones would leave a director unable to find the spam.
   */
  it("shows visible and hidden reviews together", () => {
    renderQueue([review(), review({ id: "r-2", isApproved: false, authorName: "Bekzod" })]);

    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getAllByText("Yashirilgan")).toHaveLength(1);
  });

  it("links to the part the review is about", () => {
    renderQueue([review()]);

    expect(
      screen.getByRole("link", { name: "CAT 3126 forsunka" }).getAttribute("href")
    ).toBe("/products/cat-fuel-injector-3126");
  });
});

describe("ReviewQueue hiding and restoring", () => {
  it("hides a visible review", async () => {
    renderQueue([review()]);
    await userEvent.click(screen.getByRole("button", { name: "Saytdan yashirish" }));

    expect(patch).toHaveBeenCalledWith("/reviews/r-1", { isApproved: false });
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Sharh yashirildi"));
  });

  it("puts a hidden one back", async () => {
    renderQueue([review({ isApproved: false })]);
    await userEvent.click(screen.getByRole("button", { name: "Saytga qaytarish" }));

    expect(patch).toHaveBeenCalledWith("/reviews/r-1", { isApproved: true });
  });

  /*
   * What replaced `router.refresh()`. The write invalidates the review cache,
   * and the list — which is what holds that cache — goes back to the API for
   * the page it is showing rather than trusting the row it just changed.
   */
  it("re-reads the list from the API once the change lands", async () => {
    renderQueue([review()]);
    await userEvent.click(screen.getByRole("button", { name: "Saytdan yashirish" }));

    await waitFor(() => expect(get).toHaveBeenCalledWith("/reviews", { params: { page: 1 } }));
  });

  it("says so when the change did not land", async () => {
    patch.mockRejectedValue(new Error("offline"));
    renderQueue([review()]);

    await userEvent.click(screen.getByRole("button", { name: "Saytdan yashirish" }));

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    // A failed write invalidates nothing: the list on screen is still right.
    expect(get).not.toHaveBeenCalled();
  });
});

describe("ReviewQueue deleting", () => {
  /*
   * Two clicks rather than a `confirm()`. A browser dialog blocks the page and
   * reads as a system error rather than a decision — and deleting is the one
   * action here that cannot be undone.
   */
  it("asks before deleting", async () => {
    renderQueue([review()]);
    await userEvent.click(screen.getByRole("button", { name: "O'chirish" }));

    expect(del).not.toHaveBeenCalled();
    expect(screen.getByText("Sharh o'chirilsinmi?")).toBeDefined();
  });

  it("deletes once confirmed", async () => {
    renderQueue([review()]);
    await userEvent.click(screen.getByRole("button", { name: "O'chirish" }));
    await userEvent.click(screen.getByRole("button", { name: "Sharhni o'chirish" }));

    expect(del).toHaveBeenCalledWith("/reviews/r-1");
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Sharh o'chirildi"));
  });

  it("backs out without deleting", async () => {
    renderQueue([review()]);
    await userEvent.click(screen.getByRole("button", { name: "O'chirish" }));
    await userEvent.click(screen.getByRole("button", { name: "Bekor qilish" }));

    expect(del).not.toHaveBeenCalled();
    /*
     * Awaited, not asserted straight away: while the dialog is open Radix marks
     * the rest of the page `aria-hidden`, so the row's own trigger is out of the
     * accessible tree until the close animation has finished and the dialog has
     * unmounted. That is the correct behaviour — the test has to wait for it.
     */
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "O'chirish" })).toBeDefined(),
    );
  });
});
