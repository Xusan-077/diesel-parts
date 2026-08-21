// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ProductReviews } from "./product-reviews";
import { AUTH_HINT_COOKIE } from "@/lib/auth/cookie-names";
import type { PublicReview } from "@/lib/reviews";
import dictionary from "@/dictionaries/uz.json";

const post = vi.fn();
const get = vi.fn();
const refresh = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock("axios", () => ({
  default: {
    post: (...args: unknown[]) => post(...args),
    get: (...args: unknown[]) => get(...args),
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

const dict = dictionary.reviews;
const VALID_BODY = "320D ga o'rnatdim, uch oydan beri muammosiz ishlayapti.";

function review(patch: Partial<PublicReview> = {}): PublicReview {
  return {
    id: "r-1",
    rating: 5,
    body: "Eski sharh",
    authorName: "Bekzod",
    createdAt: "2026-03-01T00:00:00.000Z",
    ...patch,
  };
}

function page(items: PublicReview[], total = items.length) {
  return { items, total, page: 1, pageSize: 5, totalPages: Math.max(1, Math.ceil(total / 5)) };
}

function renderSection(options: {
  initialPage?: ReturnType<typeof page>;
  initialOwn?: PublicReview | null;
} = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={client}>
      <ProductReviews
        productId="p-1"
        initialPage={options.initialPage ?? page([])}
        initialOwn={options.initialOwn ?? null}
        dict={dict}
        productDict={dictionary.product}
        account={dictionary.account}
        closeLabel={dictionary.common.close}
      />
    </QueryClientProvider>
  );
}

async function fillAndSubmit(label: string) {
  await userEvent.click(
    screen.getByRole("radio", { name: dict.ratingOption.replace("{n}", "5") })
  );
  await userEvent.type(screen.getByLabelText(dict.nameLabel), "Anvar");
  await userEvent.type(screen.getByLabelText(dict.bodyLabel), VALID_BODY);
  await userEvent.click(screen.getByRole("button", { name: label }));
}

/**
 * Queries scoped to the log.
 *
 * The body a reader just typed is still sitting in the textarea, so an
 * unscoped `getByText` matches it as well as the entry and fails on finding
 * two. Scoping also makes the assertion say what it means: the review is *in
 * the list*, not merely somewhere on the page.
 */
function log() {
  return within(screen.getByRole("list"));
}

function signIn() {
  document.cookie = `${AUTH_HINT_COOKIE}=1`;
}

function signOut() {
  document.cookie = `${AUTH_HINT_COOKIE}=; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

/**
 * What the server holds after the write.
 *
 * The submit invalidates the query, so a refetch always follows. Pointing it
 * at the same rows the merge produced is what makes these assertions mean
 * "consistent" rather than just "appeared for a moment": if the two disagreed,
 * the list would visibly change under the assertion.
 */
function serverReturns(items: PublicReview[], total = items.length) {
  get.mockResolvedValue({ data: page(items, total) });
}

beforeEach(() => {
  post.mockReset();
  get.mockReset();
  refresh.mockReset();
  toastSuccess.mockReset();
  toastError.mockReset();
  // Every test that does not care still needs the refetch to resolve.
  get.mockResolvedValue({ data: page([]) });
  signIn();
});

afterEach(() => {
  cleanup();
  signOut();
});

describe("ProductReviews when signed out", () => {
  it("offers a way in instead of a form", () => {
    signOut();
    renderSection();

    expect(screen.getByText(dict.signInPrompt)).toBeDefined();
    expect(screen.queryByRole("button", { name: dict.submit })).toBeNull();
  });
});

describe("ProductReviews empty state", () => {
  it("invites the first review rather than reporting a zero", () => {
    renderSection();

    expect(screen.getByText(dict.empty)).toBeDefined();
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });
});

describe("ProductReviews after writing one", () => {
  it("shows it at once, and the refetch agrees rather than replacing it", async () => {
    const saved = review({ id: "r-new", body: VALID_BODY, authorName: "Anvar", isMine: true });
    post.mockResolvedValue({ data: saved });
    serverReturns([saved, review()]);

    renderSection({ initialPage: page([review()]) });
    await fillAndSubmit(dict.submit);

    expect(await log().findByText(VALID_BODY)).toBeDefined();
    expect(log().getByText(dict.mine)).toBeDefined();

    // Once the refetch has landed there is still exactly one of each entry —
    // the merge applied the rule the server applies, so neither doubled up.
    await waitFor(() => expect(get).toHaveBeenCalled());
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  /*
   * The list is React Query's and the average above it is a Server Component's,
   * read straight from Postgres. Only a router refresh can recompute the second,
   * so a submit that skipped it would leave "4.5 · 12 ta sharh" stale over a
   * list that had just changed.
   */
  it("refreshes the server-rendered average and count too", async () => {
    post.mockResolvedValue({ data: review({ id: "r-new", isMine: true }) });

    renderSection();
    await fillAndSubmit(dict.submit);

    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("names the action it just completed", async () => {
    post.mockResolvedValue({ data: review({ id: "r-new", isMine: true }) });

    renderSection();
    await fillAndSubmit(dict.submit);

    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith(dict.toastCreated));
  });

  it("counts a first review, so the heading total moves with the list", async () => {
    const saved = review({ id: "r-new", isMine: true });
    post.mockResolvedValue({ data: saved });
    serverReturns([saved, review()]);

    renderSection({ initialPage: page([review()]) });
    await fillAndSubmit(dict.submit);

    expect(await screen.findByText(dict.count.replace("{count}", "2"))).toBeDefined();
  });
});

describe("ProductReviews when this person already reviewed the part", () => {
  const own = review({ id: "r-mine", authorName: "Anvar", body: "Eski fikrim", isMine: true });

  it("edits rather than adding a second entry", async () => {
    const other = review({ id: "r-2" });
    post.mockResolvedValue({ data: { ...own, body: VALID_BODY } });
    serverReturns([{ ...own, body: VALID_BODY }, other]);

    renderSection({ initialPage: page([own, other]), initialOwn: own });

    await userEvent.clear(screen.getByLabelText(dict.bodyLabel));
    await userEvent.type(screen.getByLabelText(dict.bodyLabel), VALID_BODY);
    await userEvent.click(screen.getByRole("button", { name: dict.submitEditing }));

    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith(dict.toastUpdated));
    expect(log().getAllByRole("listitem")).toHaveLength(2);
  });

  /*
   * A rewrite is not a new row. Incrementing here would show a total one
   * higher than the list until the refetch landed and then drop back, which
   * reads as a glitch.
   */
  it("leaves the total alone on a rewrite", async () => {
    const other = review({ id: "r-2" });
    post.mockResolvedValue({ data: { ...own, body: VALID_BODY } });
    serverReturns([{ ...own, body: VALID_BODY }, other]);

    renderSection({ initialPage: page([own, other]), initialOwn: own });
    await userEvent.click(screen.getByRole("button", { name: dict.submitEditing }));

    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    expect(screen.getByText(dict.count.replace("{count}", "2"))).toBeDefined();
  });
});

describe("ProductReviews when the write fails", () => {
  it("says so and keeps what was typed", async () => {
    post.mockRejectedValue(new Error("offline"));

    renderSection();
    await fillAndSubmit(dict.submit);

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect((screen.getByLabelText(dict.bodyLabel) as HTMLTextAreaElement).value).toBe(VALID_BODY);
  });
});
