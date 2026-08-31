import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("./backend-client", async () => {
  const actual = await vi.importActual<typeof import("./backend-client")>("./backend-client");
  return { ...actual, backendRequest: vi.fn() };
});
vi.mock("./internal-backend", () => ({ callBackendPhoneVerified: vi.fn() }));
vi.mock("@/lib/auth/staff-session", () => ({ getStaffSession: vi.fn() }));

import { backendRequest } from "./backend-client";
import { callBackendPhoneVerified } from "./internal-backend";
import { getStaffSession } from "@/lib/auth/staff-session";
import {
  deleteReview,
  getOwnReview,
  hasPurchasedProduct,
  listAllReviews,
  listProductReviews,
  setReviewApproval,
  upsertReview,
} from "./review-repository";

const SESSION = {
  role: "DIRECTOR" as const,
  accessToken: "tok",
  refreshToken: "rt",
  accessTokenExpiresAt: Date.now() + 900_000,
};

const PUBLIC_REVIEW = {
  id: "r1",
  rating: 5,
  body: "Yaxshi",
  authorName: "Ali",
  createdAt: "2026-08-01T00:00:00.000Z",
};

describe("review-repository", () => {
  beforeEach(() => {
    vi.mocked(backendRequest).mockReset();
    vi.mocked(callBackendPhoneVerified).mockReset();
    vi.mocked(getStaffSession).mockReset();
    vi.mocked(getStaffSession).mockResolvedValue(SESSION);
  });

  describe("listProductReviews", () => {
    it("reads backend/'s public /reviews and maps the page shape", async () => {
      vi.mocked(backendRequest).mockResolvedValue({
        data: [PUBLIC_REVIEW],
        meta: { page: 1, limit: 5, total: 1, totalPages: 1 },
      });

      const page = await listProductReviews("p1", 1, 5, "998901234567");

      expect(backendRequest).toHaveBeenCalledWith("/reviews", {
        query: { productId: "p1", page: 1, limit: 5, authorPhone: "998901234567" },
      });
      expect(page).toEqual({ items: [PUBLIC_REVIEW], total: 1, page: 1, pageSize: 5, totalPages: 1 });
    });

    it("omits authorPhone when there is no session", async () => {
      vi.mocked(backendRequest).mockResolvedValue({
        data: [],
        meta: { page: 1, limit: 5, total: 0, totalPages: 1 },
      });

      await listProductReviews("p1", 1, 5, null);

      expect(backendRequest).toHaveBeenCalledWith("/reviews", {
        query: { productId: "p1", page: 1, limit: 5, authorPhone: undefined },
      });
    });
  });

  describe("upsertReview", () => {
    it("signs the write with the author's phone and never sends it in the body", async () => {
      vi.mocked(callBackendPhoneVerified).mockResolvedValue({ ...PUBLIC_REVIEW, isMine: true });

      const result = await upsertReview({
        productId: "p1",
        authorPhone: "998901234567",
        rating: 5,
        body: "Yaxshi",
        authorName: "Ali",
      });

      expect(callBackendPhoneVerified).toHaveBeenCalledWith("998901234567", "reviews", {
        method: "PUT",
        body: { productId: "p1", rating: 5, body: "Yaxshi", authorName: "Ali" },
      });
      expect(result.isMine).toBe(true);
    });
  });

  describe("getOwnReview", () => {
    it("signs the read with the caller's phone", async () => {
      vi.mocked(callBackendPhoneVerified).mockResolvedValue(null);

      expect(await getOwnReview("p1", "998901234567")).toBeNull();
      expect(callBackendPhoneVerified).toHaveBeenCalledWith("998901234567", "reviews/mine?productId=p1");
    });
  });

  describe("hasPurchasedProduct", () => {
    it("unwraps backend/'s { purchased } response", async () => {
      vi.mocked(callBackendPhoneVerified).mockResolvedValue({ purchased: true });

      expect(await hasPurchasedProduct("p1", "998901234567")).toBe(true);
      expect(callBackendPhoneVerified).toHaveBeenCalledWith(
        "998901234567",
        "reviews/purchase-check?productId=p1",
      );
    });
  });

  describe("listAllReviews", () => {
    it("reads the moderation queue with the staff session's token", async () => {
      vi.mocked(backendRequest).mockResolvedValue({
        data: [{ ...PUBLIC_REVIEW, isApproved: true, product: { id: "p1", slug: "s", name: "N" } }],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });

      const page = await listAllReviews(1, 20);

      expect(backendRequest).toHaveBeenCalledWith("/reviews/admin", {
        accessToken: "tok",
        query: { page: 1, limit: 20 },
      });
      expect(page.items[0].isApproved).toBe(true);
    });
  });

  describe("setReviewApproval", () => {
    it("PATCHes the approval endpoint", async () => {
      vi.mocked(backendRequest).mockResolvedValue(undefined);

      await setReviewApproval("r1", false);

      expect(backendRequest).toHaveBeenCalledWith("/reviews/r1/approval", {
        method: "PATCH",
        accessToken: "tok",
        body: { isApproved: false },
      });
    });
  });

  describe("deleteReview", () => {
    it("DELETEs the review", async () => {
      vi.mocked(backendRequest).mockResolvedValue(undefined);

      await deleteReview("r1");

      expect(backendRequest).toHaveBeenCalledWith("/reviews/r1", { method: "DELETE", accessToken: "tok" });
    });
  });
});
