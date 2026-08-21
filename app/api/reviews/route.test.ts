import { beforeEach, describe, expect, it, vi } from "vitest";

const listProductReviews = vi.fn();
const upsertReview = vi.fn();
const hasPurchasedProduct = vi.fn();
const getSession = vi.fn();

vi.mock("@/lib/api/review-repository", () => ({
  listProductReviews: (...args: unknown[]) => listProductReviews(...args),
  upsertReview: (...args: unknown[]) => upsertReview(...args),
  hasPurchasedProduct: (...args: unknown[]) => hasPurchasedProduct(...args),
}));

vi.mock("@/lib/auth/session", () => ({
  getSession: () => getSession(),
}));

// `route-auth` reaches the DAL, which loads the Prisma client, which refuses
// to construct without DATABASE_URL. This route only uses the two helpers
// below, so standing them in keeps the test free of a database.
vi.mock("@/lib/auth/dal", () => ({ getStaffUser: vi.fn() }));

const { GET, POST } = await import("./route");

const VALID = {
  productId: "cat-injector-3126",
  rating: 5,
  body: "320D ga o'rnatdim, uch oydan beri muammosiz.",
  authorName: "Anvar",
};

function post(body: unknown): Request {
  return new Request("http://localhost/api/reviews", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function get(query: string): Request {
  return new Request(`http://localhost/api/reviews?${query}`);
}

beforeEach(() => {
  listProductReviews.mockReset();
  upsertReview.mockReset();
  hasPurchasedProduct.mockReset();
  getSession.mockReset();
  getSession.mockResolvedValue(null);
  // Most POST cases are about validation, not the purchase gate.
  hasPurchasedProduct.mockResolvedValue(true);
});

describe("GET /api/reviews", () => {
  it("refuses a request that names no product", async () => {
    expect((await GET(get("page=1"))).status).toBe(400);
  });

  it("defaults the page and page size", async () => {
    listProductReviews.mockResolvedValue({ items: [] });
    await GET(get("productId=p-1"));

    expect(listProductReviews).toHaveBeenCalledWith("p-1", 1, 5, undefined);
  });

  it("reads reviews for a signed-out visitor", async () => {
    listProductReviews.mockResolvedValue({ items: [] });
    expect((await GET(get("productId=p-1"))).status).toBe(200);
  });

  /*
   * The session changes nothing about which rows come back — only whether the
   * reader's own entry is marked. Gating the list on a session would hide the
   * reviews from exactly the people deciding whether to buy.
   */
  it("passes the session phone through so the reader's own entry is marked", async () => {
    getSession.mockResolvedValue({ phone: "998901234567" });
    listProductReviews.mockResolvedValue({ items: [] });
    await GET(get("productId=p-1"));

    expect(listProductReviews).toHaveBeenCalledWith("p-1", 1, 5, "998901234567");
  });

  it("caps the page size so one request cannot pull every review", async () => {
    expect((await GET(get("productId=p-1&pageSize=500"))).status).toBe(400);
  });
});

describe("POST /api/reviews", () => {
  it("refuses a signed-out caller", async () => {
    const response = await POST(post(VALID));

    expect(response.status).toBe(401);
    expect(upsertReview).not.toHaveBeenCalled();
  });

  it("writes the review for a signed-in caller who bought the part", async () => {
    getSession.mockResolvedValue({ phone: "998901234567" });
    upsertReview.mockResolvedValue({ id: "r-1" });

    const response = await POST(post(VALID));

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ id: "r-1" });
  });

  /*
   * The rule the unique index rests on. If the body could name the author,
   * one person could review a part under a hundred identities and the
   * constraint would be decoration.
   */
  it("takes the identity from the session, never from the body", async () => {
    getSession.mockResolvedValue({ phone: "998901234567" });
    upsertReview.mockResolvedValue({ id: "r-1" });

    await POST(post({ ...VALID, authorPhone: "998900000000" }));

    expect(upsertReview).toHaveBeenCalledWith(
      expect.objectContaining({ authorPhone: "998901234567" }),
    );
  });

  it("rejects a rating outside the scale", async () => {
    getSession.mockResolvedValue({ phone: "998901234567" });

    expect((await POST(post({ ...VALID, rating: 6 }))).status).toBe(400);
    expect((await POST(post({ ...VALID, rating: 0 }))).status).toBe(400);
    expect((await POST(post({ ...VALID, rating: 4.5 }))).status).toBe(400);
    expect(upsertReview).not.toHaveBeenCalled();
  });

  it("rejects a body under the floor and over the ceiling", async () => {
    getSession.mockResolvedValue({ phone: "998901234567" });

    expect((await POST(post({ ...VALID, body: "zo'r" }))).status).toBe(400);
    expect((await POST(post({ ...VALID, body: "a".repeat(1001) }))).status).toBe(400);
  });

  it("rejects a name of nothing but spaces", async () => {
    getSession.mockResolvedValue({ phone: "998901234567" });
    expect((await POST(post({ ...VALID, authorName: "   " }))).status).toBe(400);
  });

  it("rejects a body that is not JSON", async () => {
    getSession.mockResolvedValue({ phone: "998901234567" });
    const response = await POST(
      new Request("http://localhost/api/reviews", { method: "POST", body: "{" }),
    );

    expect(response.status).toBe(400);
  });

  /*
   * `productId` comes from the browser, so a part retired between the page
   * rendering and the button being pressed arrives as a foreign-key violation.
   * That is not a server fault and a 500 explains nothing.
   */
  it("answers a write against a vanished product with a 400, not a crash", async () => {
    getSession.mockResolvedValue({ phone: "998901234567" });
    upsertReview.mockRejectedValue(new Error("Foreign key constraint failed"));

    expect((await POST(post(VALID))).status).toBe(400);
  });

  /*
   * The rule itself. The form is hidden from anyone who has not bought the
   * part, but a hidden form is a suggestion — a signed-in caller can post this
   * request by hand for any `productId` in the catalog, which is exactly what
   * a competitor with a phone number would do.
   */
  it("refuses a caller who has not bought the part", async () => {
    getSession.mockResolvedValue({ phone: "998901234567" });
    hasPurchasedProduct.mockResolvedValue(false);

    const response = await POST(post(VALID));

    expect(response.status).toBe(403);
    expect(upsertReview).not.toHaveBeenCalled();
  });

  it("checks the purchase against the session phone and the named part", async () => {
    getSession.mockResolvedValue({ phone: "998901234567" });
    upsertReview.mockResolvedValue({ id: "r-1" });

    await POST(post({ ...VALID, authorPhone: "998900000000" }));

    // The body's phone is ignored here for the same reason it is ignored below.
    expect(hasPurchasedProduct).toHaveBeenCalledWith(VALID.productId, "998901234567");
  });

  it("checks the purchase before writing, not after", async () => {
    getSession.mockResolvedValue({ phone: "998901234567" });
    hasPurchasedProduct.mockResolvedValue(false);

    await POST(post(VALID));

    expect(upsertReview).not.toHaveBeenCalled();
  });

  it("does not reach the purchase check for a signed-out caller", async () => {
    await POST(post(VALID));
    expect(hasPurchasedProduct).not.toHaveBeenCalled();
  });
});
