import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("./backend-client", async () => {
  const actual = await vi.importActual<typeof import("./backend-client")>("./backend-client");
  return { ...actual, backendRequest: vi.fn() };
});

import { BackendApiError, backendRequest } from "./backend-client";
import { createInquiry } from "./inquiry-repository";

describe("inquiry-repository", () => {
  beforeEach(() => {
    vi.mocked(backendRequest).mockReset();
    vi.mocked(backendRequest).mockResolvedValue({ success: true });
  });

  describe("createInquiry", () => {
    it("POSTs to /inquiries with no accessToken and maps null optionals to undefined", async () => {
      await createInquiry({
        customerName: "Ali",
        phone: "998901234567",
        email: null,
        message: "Need a filter",
        source: "PRODUCT_DIALOG",
        productId: null,
        productSku: null,
        quantity: null,
      });

      expect(backendRequest).toHaveBeenCalledWith("/inquiries", {
        method: "POST",
        body: {
          customerName: "Ali",
          phone: "998901234567",
          email: undefined,
          message: "Need a filter",
          source: "PRODUCT_DIALOG",
          productId: undefined,
          productSku: undefined,
          quantity: undefined,
        },
      });
      const call = vi.mocked(backendRequest).mock.calls[0][1];
      expect(call).not.toHaveProperty("accessToken");
    });

    it("passes the optional fields through when they are present", async () => {
      await createInquiry({
        customerName: "Vali",
        phone: "998907654321",
        email: "vali@example.com",
        message: "Bulk order",
        source: "QUOTE_FORM",
        productId: "p1",
        productSku: "SKU-1",
        quantity: 5,
      });

      expect(backendRequest).toHaveBeenCalledWith("/inquiries", {
        method: "POST",
        body: {
          customerName: "Vali",
          phone: "998907654321",
          email: "vali@example.com",
          message: "Bulk order",
          source: "QUOTE_FORM",
          productId: "p1",
          productSku: "SKU-1",
          quantity: 5,
        },
      });
    });

    it("sends undefined for every optional given only the required fields", async () => {
      await createInquiry({
        customerName: "Bek",
        phone: "998900000000",
        message: "Hi",
        source: "CONTACT_FORM",
      });

      expect(backendRequest).toHaveBeenCalledWith("/inquiries", {
        method: "POST",
        body: {
          customerName: "Bek",
          phone: "998900000000",
          email: undefined,
          message: "Hi",
          source: "CONTACT_FORM",
          productId: undefined,
          productSku: undefined,
          quantity: undefined,
        },
      });
    });

    it("returns void, not the backend response", async () => {
      const result = await createInquiry({
        customerName: "Bek",
        phone: "998900000000",
        message: "Hi",
        source: "CONTACT_FORM",
      });

      expect(result).toBeUndefined();
    });

    it("lets a BackendApiError propagate", async () => {
      vi.mocked(backendRequest).mockRejectedValue(new BackendApiError("Down", 503, "unavailable"));

      await expect(
        createInquiry({
          customerName: "Bek",
          phone: "998900000000",
          message: "Hi",
          source: "CONTACT_FORM",
        }),
      ).rejects.toThrow("Down");
    });
  });
});
