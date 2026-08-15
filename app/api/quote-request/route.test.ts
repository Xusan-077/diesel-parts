import { describe, expect, it } from "vitest";
import { POST } from "./route";

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
