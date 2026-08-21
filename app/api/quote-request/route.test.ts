import { beforeEach, describe, expect, it, vi } from "vitest";

// The repository imports the Prisma client, which refuses to load without
// DATABASE_URL. Mocking it keeps these route tests free of a database.
const createInquiry = vi.fn();
vi.mock("@/lib/api/inquiry-repository", () => ({
  createInquiry: (...args: unknown[]) => createInquiry(...args),
}));

const { POST } = await import("./route");

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/quote-request", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validPayload = {
  name: "John Doe",
  company: "Acme Co",
  phone: "+998901234567",
  email: "john@example.com",
  country: "Uzbekistan",
  products: "CAT 3126 injector",
  quantity: "10",
  message: "",
};

beforeEach(() => {
  createInquiry.mockReset();
  createInquiry.mockResolvedValue(undefined);
});

describe("POST /api/quote-request", () => {
  it("returns 200 and success for a valid payload", async () => {
    const response = await POST(makeRequest(validPayload));
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);
  });

  it("returns 400 for a payload missing required fields", async () => {
    const response = await POST(makeRequest({ name: "John Doe" }));
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.success).toBe(false);
  });

  it("returns 400 for an invalid email", async () => {
    const response = await POST(makeRequest({ ...validPayload, email: "not-an-email" }));
    expect(response.status).toBe(400);
  });

  it("returns 400 for a malformed JSON body", async () => {
    const response = await POST(
      new Request("http://localhost/api/quote-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not valid json",
      })
    );
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.success).toBe(false);
  });
});

describe("POST /api/quote-request persistence", () => {
  it("persists a valid request with the quote-form source", async () => {
    const response = await POST(makeRequest(validPayload));

    expect(response.status).toBe(200);
    expect(createInquiry).toHaveBeenCalledTimes(1);
    expect(createInquiry.mock.calls[0][0]).toMatchObject({
      source: "QUOTE_FORM",
      customerName: "John Doe",
      phone: "+998901234567",
    });
  });

  it("carries the cart and the stated request into the message body", async () => {
    await POST(
      makeRequest({
        ...validPayload,
        message: "Urgent",
        cartItems: [
          { productId: "p1", sku: "DP-INJ-3126", name: "Injector", quantity: 2, price: 100 },
        ],
      }),
    );

    const message = (createInquiry.mock.calls[0][0] as { message: string }).message;
    expect(message).toContain("Urgent");
    expect(message).toContain("CAT 3126 injector");
    expect(message).toContain("- DP-INJ-3126 × 2");
  });

  it("does not persist an invalid request", async () => {
    await POST(makeRequest({ name: "John" }));
    expect(createInquiry).not.toHaveBeenCalled();
  });

  it("reports failure rather than success when the write fails", async () => {
    createInquiry.mockRejectedValue(new Error("connection lost"));

    const response = await POST(makeRequest(validPayload));

    expect(response.status).toBe(500);
    expect((await response.json()).success).toBe(false);
  });
});
