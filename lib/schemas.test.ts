import { describe, expect, it } from "vitest";
import { inquirySchema, quoteRequestSchema } from "./schemas";

describe("quoteRequestSchema", () => {
  const validInput = {
    name: "John Doe",
    company: "Acme Co",
    phone: "+998901234567",
    email: "john@example.com",
    country: "Uzbekistan",
    products: "CAT 3126 injector",
    quantity: "10",
    message: "",
  };

  it("accepts a fully valid payload", () => {
    expect(quoteRequestSchema.safeParse(validInput).success).toBe(true);
  });

  it("accepts a missing/empty message (optional field)", () => {
    const { message, ...rest } = validInput;
    expect(quoteRequestSchema.safeParse(rest).success).toBe(true);
  });

  it("rejects a missing required field", () => {
    const { name, ...rest } = validInput;
    expect(quoteRequestSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects an invalid email", () => {
    const result = quoteRequestSchema.safeParse({ ...validInput, email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("rejects an empty required string", () => {
    const result = quoteRequestSchema.safeParse({ ...validInput, name: "" });
    expect(result.success).toBe(false);
  });
});

describe("inquirySchema", () => {
  const validInput = {
    productId: "cat-injector-3126",
    productSlug: "cat-fuel-injector-3126",
    name: "Jane Doe",
    email: "jane@example.com",
    phone: "",
    message: "Is this compatible with CAT 320D?",
  };

  it("accepts a fully valid payload", () => {
    expect(inquirySchema.safeParse(validInput).success).toBe(true);
  });

  it("accepts a missing/empty phone (optional field)", () => {
    const { phone, ...rest } = validInput;
    expect(inquirySchema.safeParse(rest).success).toBe(true);
  });

  it("rejects a missing required field", () => {
    const { message, ...rest } = validInput;
    expect(inquirySchema.safeParse(rest).success).toBe(false);
  });

  it("rejects an invalid email", () => {
    const result = inquirySchema.safeParse({ ...validInput, email: "not-an-email" });
    expect(result.success).toBe(false);
  });
});
