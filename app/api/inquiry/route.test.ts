import { describe, expect, it } from "vitest";
import { POST } from "./route";

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
