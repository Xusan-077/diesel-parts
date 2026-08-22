// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HomeProductRow } from "./home-product-row";
import type { HomeProductsResponse } from "@/lib/product-collections";
import { stubObservers } from "@/lib/test/stub-observers";
import { products } from "@/prisma/seed-data/products";
import dictionary from "@/dictionaries/uz.json";

/*
 * The home page's product rows moved off the server and onto `/api/products/home`.
 * These pin the three states that move cost: the page paints its marketing copy
 * before the catalog answers, so what a visitor sees while it is answering,
 * when it refuses, and when a collection is genuinely empty are now three
 * different things rather than one server render.
 */

const get = vi.fn();

vi.mock("@/lib/api/client", () => ({
  apiClient: { get: (...args: unknown[]) => get(...args) },
}));

const { common, home, productActions, product: productDict } = dictionary;

const [first, second] = products;

const RESPONSE: HomeProductsResponse = {
  rows: { popular: [first], newest: [second], bestSellers: [] },
  meta: {
    [first.id]: { brandName: "CAT", categoryName: "Forsunkalar" },
    [second.id]: { brandName: "Bosch", categoryName: "Forsunkalar" },
  },
  stats: {},
};

function rowProps() {
  return {
    lang: "uz" as const,
    viewAllHref: "/products",
    viewAllLabel: common.viewAll,
    stock: common.stock,
    requestPriceLabel: common.requestPrice,
    actions: productActions,
    productDict,
    carousel: { prev: common.carouselPrev, next: common.carouselNext },
    unavailableLabel: common.productsUnavailable,
    loadingLabel: common.loading,
    retryLabel: common.retry,
  };
}

/** A fresh client per render: a shared cache would answer the next test. */
function client() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderRow(
  collection: "popular" | "newest" | "bestSellers" = "popular",
  initialData?: HomeProductsResponse,
) {
  const queryClient = client();

  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <HomeProductRow
          {...rowProps()}
          collection={collection}
          title={home.popularTitle}
          initialData={initialData}
        />
      </QueryClientProvider>,
    ),
  };
}

beforeEach(() => {
  stubObservers();
  // Embla asks its owner window which breakpoint it is at — the carousel
  // stands down above `lg`. jsdom implements no media engine, and "no match"
  // is the truthful reply for a headless DOM: the row renders its track, which
  // is what these assertions are about.
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: false,
      addEventListener: () => {},
      removeEventListener: () => {},
    })),
  );
  localStorage.clear();
  get.mockReset();
  get.mockResolvedValue({ data: RESPONSE });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/*
 * The seed is what keeps the cards in the server-rendered HTML — a crawler runs
 * no effects, so a row that only ever fetches on mount is a row it never sees.
 * These pin that the seed is used, that it costs no request, and that a visit
 * whose server read failed still has the API as its second chance.
 */
describe("a home product row seeded from the page's server render", () => {
  it("draws its cards without asking the API for anything", () => {
    renderRow("popular", RESPONSE);

    expect(screen.getByRole("link", { name: first.name.uz })).toBeDefined();
    expect(get).not.toHaveBeenCalled();
  });

  it("never shows the pending state, so nothing replaces the cards on hydration", () => {
    renderRow("popular", RESPONSE);

    expect(screen.queryByText(common.loading)).toBeNull();
  });

  /*
   * The seed is a first frame, not a freeze. A row that took `initialData` and
   * never consulted the API again would be the server-rendered arrangement this
   * replaced, with an extra client component for nothing.
   */
  it("still goes to the API once the seed is invalidated", async () => {
    const { queryClient } = renderRow("popular", RESPONSE);
    get.mockResolvedValue({
      data: { ...RESPONSE, rows: { ...RESPONSE.rows, popular: [second] } },
    });

    await act(() => queryClient.invalidateQueries());

    await waitFor(() =>
      expect(screen.getByRole("link", { name: second.name.uz })).toBeDefined(),
    );
    expect(get).toHaveBeenCalledWith("/products/home", {
      params: { lang: "uz", limit: 8 },
    });
  });

  it("falls back to fetching when the server read failed and left no seed", async () => {
    renderRow("popular", undefined);

    await waitFor(() => expect(get).toHaveBeenCalledTimes(1));
    expect(get).toHaveBeenCalledWith("/products/home", {
      params: { lang: "uz", limit: 8 },
    });
  });
});

describe("a home product row", () => {
  it("asks the catalog API for its collection", async () => {
    renderRow();

    await waitFor(() => expect(get).toHaveBeenCalled());
    expect(get).toHaveBeenCalledWith("/products/home", {
      params: { lang: "uz", limit: 8 },
    });
  });

  it("draws the parts the API returned for that collection", async () => {
    renderRow("newest");

    await waitFor(() =>
      expect(screen.getByRole("link", { name: second.name.uz })).toBeDefined(),
    );
    expect(screen.queryByRole("link", { name: first.name.uz })).toBeNull();
  });

  /*
   * The rows are interleaved with other sections down the page and cannot be
   * one component. Sharing a query key is what keeps them one request — three
   * rows fetching the same three collections separately would be the whole
   * reason not to do this in the browser.
   */
  it("costs one request no matter how many rows read from it", async () => {
    render(
      <QueryClientProvider client={client()}>
        <HomeProductRow {...rowProps()} collection="popular" title={home.popularTitle} />
        <HomeProductRow {...rowProps()} collection="newest" title={home.newTitle} />
        <HomeProductRow
          {...rowProps()}
          collection="bestSellers"
          title={home.bestSellersTitle}
        />
      </QueryClientProvider>,
    );

    await waitFor(() =>
      expect(screen.getByRole("link", { name: first.name.uz })).toBeDefined(),
    );
    expect(get).toHaveBeenCalledTimes(1);
  });

  it("holds the row's heading and its space while the request is in flight", () => {
    get.mockReturnValue(new Promise(() => {}));
    renderRow();

    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe(home.popularTitle);
    // The skeleton itself is `aria-hidden`, so the wait has to be said out loud
    // for a reader who cannot see it.
    expect(screen.getByText(common.loading)).toBeDefined();
    expect(screen.queryByRole("link", { name: first.name.uz })).toBeNull();
  });

  it("keeps its heading and explains the gap when the request fails", async () => {
    get.mockRejectedValue(new Error("Network Error"));
    renderRow();

    await waitFor(() => expect(screen.getByRole("status")).toBeDefined());
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe(home.popularTitle);
    expect(screen.getByRole("status").textContent).toBe(common.productsUnavailable);
  });

  it("refetches in place rather than reloading the page", async () => {
    get.mockRejectedValue(new Error("Network Error"));
    renderRow();

    await waitFor(() => expect(screen.getByRole("button", { name: common.retry })).toBeDefined());
    get.mockResolvedValue({ data: RESPONSE });
    await userEvent.click(screen.getByRole("button", { name: common.retry }));

    await waitFor(() =>
      expect(screen.getByRole("link", { name: first.name.uz })).toBeDefined(),
    );
  });

  /*
   * The distinction the whole design rests on, unchanged from the server
   * version: an empty collection and an unreadable one look identical in the
   * data and mean opposite things to a visitor.
   */
  it("stays hidden when the read succeeded and the collection is simply empty", async () => {
    const { container } = renderRow("bestSellers");

    await waitFor(() => expect(get).toHaveBeenCalled());
    await waitFor(() => expect(container.innerHTML).toBe(""));
  });
});
