// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReviewQueue } from "./review-queue";
import type { ModeratedReview } from "@/lib/api/review-repository";

const patch = vi.fn();
const del = vi.fn();
const refresh = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock("axios", () => ({
  default: {
    patch: (...args: unknown[]) => patch(...args),
    delete: (...args: unknown[]) => del(...args),
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

beforeEach(() => {
  patch.mockReset();
  del.mockReset();
  refresh.mockReset();
  toastSuccess.mockReset();
  toastError.mockReset();
  patch.mockResolvedValue({ data: { success: true } });
  del.mockResolvedValue({ data: { success: true } });
});

afterEach(cleanup);

describe("ReviewQueue when there is nothing to moderate", () => {
  it("says so and explains what would put something here", () => {
    render(<ReviewQueue reviews={[]} />);

    expect(screen.getByText("Hozircha sharh yo'q.")).toBeDefined();
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });
});

describe("ReviewQueue listing", () => {
  /*
   * Not an approval queue — reviews publish on submission — so the screen has
   * to show what is already on the site, not only what is waiting. A list that
   * hid the visible ones would leave a director unable to find the spam.
   */
  it("shows visible and hidden reviews together", () => {
    render(
      <ReviewQueue
        reviews={[review(), review({ id: "r-2", isApproved: false, authorName: "Bekzod" })]}
      />
    );

    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getAllByText("Yashirilgan")).toHaveLength(1);
  });

  it("links to the part the review is about", () => {
    render(<ReviewQueue reviews={[review()]} />);

    expect(
      screen.getByRole("link", { name: "CAT 3126 forsunka" }).getAttribute("href")
    ).toBe("/products/cat-fuel-injector-3126");
  });
});

describe("ReviewQueue hiding and restoring", () => {
  it("hides a visible review", async () => {
    render(<ReviewQueue reviews={[review()]} />);
    await userEvent.click(screen.getByRole("button", { name: "Saytdan yashirish" }));

    expect(patch).toHaveBeenCalledWith("/api/v1/reviews/r-1", { isApproved: false });
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Sharh yashirildi"));
    expect(refresh).toHaveBeenCalled();
  });

  it("puts a hidden one back", async () => {
    render(<ReviewQueue reviews={[review({ isApproved: false })]} />);
    await userEvent.click(screen.getByRole("button", { name: "Saytga qaytarish" }));

    expect(patch).toHaveBeenCalledWith("/api/v1/reviews/r-1", { isApproved: true });
  });

  it("says so when the change did not land", async () => {
    patch.mockRejectedValue(new Error("offline"));
    render(<ReviewQueue reviews={[review()]} />);

    await userEvent.click(screen.getByRole("button", { name: "Saytdan yashirish" }));

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe("ReviewQueue deleting", () => {
  /*
   * Two clicks rather than a `confirm()`. A browser dialog blocks the page and
   * reads as a system error rather than a decision — and deleting is the one
   * action here that cannot be undone.
   */
  it("asks before deleting", async () => {
    render(<ReviewQueue reviews={[review()]} />);
    await userEvent.click(screen.getByRole("button", { name: "O'chirish" }));

    expect(del).not.toHaveBeenCalled();
    expect(screen.getByText("Butunlay o'chirilsinmi?")).toBeDefined();
  });

  it("deletes once confirmed", async () => {
    render(<ReviewQueue reviews={[review()]} />);
    await userEvent.click(screen.getByRole("button", { name: "O'chirish" }));
    await userEvent.click(screen.getByRole("button", { name: "Ha, o'chirish" }));

    expect(del).toHaveBeenCalledWith("/api/v1/reviews/r-1");
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Sharh o'chirildi"));
  });

  it("backs out without deleting", async () => {
    render(<ReviewQueue reviews={[review()]} />);
    await userEvent.click(screen.getByRole("button", { name: "O'chirish" }));
    await userEvent.click(screen.getByRole("button", { name: "Bekor qilish" }));

    expect(del).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "O'chirish" })).toBeDefined();
  });
});
