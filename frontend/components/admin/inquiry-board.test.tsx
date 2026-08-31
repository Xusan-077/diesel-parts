// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { InquiryBoard } from "./inquiry-board";
import { refusal } from "./refusal.fixture";
import type { BoardCard } from "@/lib/admin/inquiry-board-state";
import type { InquiryColumn } from "@/lib/api/inquiry-board";

/**
 * The board's one flow, end to end through the component: a seller takes a lead
 * out of the pool and then moves it along.
 *
 * The board is seeded with its cards and the refetch is mocked to answer with
 * that same seed, so the query never changes what is on screen after mount.
 * That is deliberate — it isolates the optimistic layer, which is the part that
 * decides what the seller sees in the second between tapping and the server
 * answering.
 */
const get = vi.fn();
const post = vi.fn();
const patch = vi.fn();

vi.mock("@/lib/api/admin/client", () => ({
  panelClient: {
    get: (...args: unknown[]) => get(...args),
    post: (...args: unknown[]) => post(...args),
    patch: (...args: unknown[]) => patch(...args),
  },
}));

function card(overrides: Partial<BoardCard> = {}): BoardCard {
  return {
    id: "i1",
    customerName: "Sardor Aliyev",
    phone: "+998901234567",
    email: "sardor@example.uz",
    message: "Bosch forsunka bormi?",
    productId: null,
    productSku: "BOSCH-0445120123",
    quantity: 2,
    column: "new",
    assignedSellerName: null,
    notes: null,
    followUpAt: null,
    ageHours: 2,
    ageLabel: "2 soat",
    createdAtLabel: "19 avg, 09:30",
    savedCustomer: null,
    ...overrides,
  };
}

const NO_TOTALS: Record<InquiryColumn, number> = {
  new: 0,
  claimed: 0,
  in_progress: 0,
  won: 0,
  lost: 0,
};

function view(cards: BoardCard[]) {
  const totals = { ...NO_TOTALS };
  for (const item of cards) {
    totals[item.column] += 1;
  }

  return {
    cards,
    totals,
    sellerName: "Nodir Karimov",
    showAssignee: false,
    todayIso: "2026-08-19",
  };
}

function renderBoard(cards: BoardCard[]) {
  const seed = view(cards);
  // Every reread answers with the seed, so a poll or an invalidation cannot
  // move a card on its own — only the overlay under test can.
  get.mockResolvedValue({ data: seed });

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={queryClient}>
      <InquiryBoard initialData={seed} />
    </QueryClientProvider>,
  );
}

/** The cards currently sitting in one column, by the column's own heading. */
function column(name: string) {
  return within(screen.getByRole("region", { name }));
}

/** Claims go out as a POST, every other card edit as a PATCH. */
function settleAll(value: { data: unknown }) {
  post.mockResolvedValue(value);
  patch.mockResolvedValue(value);
}

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  patch.mockReset();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("InquiryBoard", () => {
  it("claims a lead and then moves it into the working column", async () => {
    const user = userEvent.setup();
    settleAll({ data: { success: true, id: "i1" } });
    renderBoard([card()]);

    expect(column("Yangi").getByText("Sardor Aliyev")).toBeDefined();

    await user.click(column("Yangi").getByRole("button", { name: "Men olaman" }));

    expect(post).toHaveBeenCalledWith("/inquiries/i1/claim");

    // The card is in the seller's hands before the server has said so.
    const claimed = await column("Band qilingan").findByText("Sardor Aliyev");
    expect(claimed).toBeDefined();
    expect(column("Yangi").queryByText("Sardor Aliyev")).toBeNull();

    await user.click(
      column("Band qilingan").getByRole("button", { name: "Jarayonga o'tkazish" }),
    );

    expect(patch).toHaveBeenLastCalledWith("/inquiries/i1", {
      status: "IN_PROGRESS",
    });

    expect(await column("Jarayonda").findByText("Sardor Aliyev")).toBeDefined();
    expect(column("Band qilingan").queryByText("Sardor Aliyev")).toBeNull();

    /*
     * What replaced `router.refresh()`: a settled move invalidates the board,
     * and the board goes back to the API rather than trusting its own overlay.
     */
    await waitFor(() => expect(get).toHaveBeenCalledWith("/inquiries/board"));
  });

  it("puts a lead back in the pool and says why when another seller won the race", async () => {
    const user = userEvent.setup();
    post.mockRejectedValue(
      refusal(
        {
          success: false,
          errors: { _root: ["Bu so'rovni boshqa sotuvchi allaqachon band qilgan."] },
        },
        409,
      ),
    );
    renderBoard([card()]);

    await user.click(column("Yangi").getByRole("button", { name: "Men olaman" }));

    expect(
      await screen.findByText("Bu so'rovni boshqa sotuvchi allaqachon band qilgan."),
    ).toBeDefined();
    expect(column("Yangi").getByText("Sardor Aliyev")).toBeDefined();
    expect(column("Band qilingan").queryByText("Sardor Aliyev")).toBeNull();
  });

  it("keeps the lead where it was when the request never lands", async () => {
    const user = userEvent.setup();
    patch.mockRejectedValue(new Error("offline"));
    renderBoard([card({ column: "claimed", assignedSellerName: "Nodir Karimov" })]);

    await user.click(
      column("Band qilingan").getByRole("button", { name: "Jarayonga o'tkazish" }),
    );

    expect(await screen.findByText("Ulanmadi. Qayta urinib ko'ring.")).toBeDefined();
    expect(column("Band qilingan").getByText("Sardor Aliyev")).toBeDefined();
  });

  it("offers no move on an unclaimed lead, because it is nobody's to move", () => {
    renderBoard([card()]);

    const yangi = column("Yangi");
    expect(yangi.getByRole("button", { name: "Men olaman" })).toBeDefined();
    expect(yangi.queryByRole("button", { name: "Yutildi" })).toBeNull();
  });

  it("sets a callback date from the card", async () => {
    const user = userEvent.setup();
    settleAll({ data: { success: true, id: "i1" } });
    renderBoard([card({ column: "claimed", assignedSellerName: "Nodir Karimov" })]);

    await user.type(screen.getByLabelText("Qayta aloqa sanasi"), "2026-09-01");

    expect(patch).toHaveBeenLastCalledWith("/inquiries/i1", {
      followUpAt: "2026-09-01",
    });
    // Sent as an ISO date, shown the way the arrival stamp beside it is shown.
    expect(await screen.findByText(/Qayta aloqa: 1 sen/)).toBeDefined();
  });
});
