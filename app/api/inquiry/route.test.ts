import { beforeEach, describe, expect, it, vi } from "vitest";

// The repository imports the Prisma client, which refuses to load without
// DATABASE_URL. Mocking it keeps these route tests free of a database.
const createInquiry = vi.fn();
vi.mock("@/lib/api/inquiry-repository", () => ({
  createInquiry: (...args: unknown[]) => createInquiry(...args),
}));

const { POST } = await import("./route");

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/inquiry", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validPayload = {
  productId: "cat-injector-3126",
  productSlug: "cat-fuel-injector-3126",
  name: "Jane Doe",
  email: "jane@example.com",
  phone: "",
  message: "Is this compatible with CAT 320D?",
};

beforeEach(() => {
  createInquiry.mockReset();
  createInquiry.mockResolvedValue(undefined);
});

describe("POST /api/inquiry", () => {
  it("returns 200 and success for a valid payload", async () => {
    const response = await POST(makeRequest(validPayload));
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);
  });

  it("returns 400 for a payload missing required fields", async () => {
    const response = await POST(makeRequest({ productId: "cat-injector-3126" }));
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.success).toBe(false);
  });

  it("returns 400 for an invalid email", async () => {
    const response = await POST(makeRequest({ ...validPayload, email: "not-an-email" }));
    expect(response.status).toBe(400);
  });

  it("returns 400 and success: false for a non-JSON body", async () => {
    const request = new Request("http://localhost/api/inquiry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not valid json",
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.success).toBe(false);
    expect(json.errors._root).toBeDefined();
  });
});

describe("POST /api/inquiry persistence", () => {
  it("persists a valid inquiry with the product-dialog source", async () => {
    const response = await POST(makeRequest(validPayload));

    expect(response.status).toBe(200);
    expect(createInquiry).toHaveBeenCalledTimes(1);
    expect(createInquiry.mock.calls[0][0]).toMatchObject({
      source: "PRODUCT_DIALOG",
      customerName: "Jane Doe",
      email: "jane@example.com",
      productId: "cat-injector-3126",
      message: "Is this compatible with CAT 320D?",
    });
  });

  it("does not persist an invalid inquiry", async () => {
    await POST(makeRequest({ productId: "cat-injector-3126" }));
    expect(createInquiry).not.toHaveBeenCalled();
  });

  it("reports failure rather than success when the write fails", async () => {
    createInquiry.mockRejectedValue(new Error("connection lost"));

    const response = await POST(makeRequest(validPayload));

    expect(response.status).toBe(500);
    expect((await response.json()).success).toBe(false);
  });
});
