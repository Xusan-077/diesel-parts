import { describe, expect, it } from "vitest";
import {
  customerCreateSchema,
  customerUpdateSchema,
  discountRequestSchema,
  inquirySchema,
  inquiryUpdateSchema,
  orderCreateSchema,
  orderListQuerySchema,
  orderUpdateSchema,
  quoteRequestSchema,
} from "./schemas";

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

describe("inquiryUpdateSchema", () => {
  it("accepts a status move on its own", () => {
    expect(inquiryUpdateSchema.safeParse({ status: "WON" }).success).toBe(true);
  });

  it("accepts a note and a follow-up date without a status", () => {
    const result = inquiryUpdateSchema.safeParse({
      notes: "Ertaga qayta aloqa",
      followUpAt: "2026-09-01",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a full timestamp as well as a bare date", () => {
    expect(inquiryUpdateSchema.safeParse({ followUpAt: "2026-09-01T09:30:00Z" }).success).toBe(
      true,
    );
  });

  it("accepts a cleared note and a cleared follow-up date", () => {
    expect(inquiryUpdateSchema.safeParse({ notes: null, followUpAt: null }).success).toBe(true);
  });

  it("rejects an empty object, which asks for nothing", () => {
    expect(inquiryUpdateSchema.safeParse({}).success).toBe(false);
  });

  it("rejects CLAIMED, which is not a status but an assignee", () => {
    expect(inquiryUpdateSchema.safeParse({ status: "CLAIMED" }).success).toBe(false);
  });

  it("rejects a follow-up date that is not a date", () => {
    expect(inquiryUpdateSchema.safeParse({ followUpAt: "kelasi juma" }).success).toBe(false);
  });
});

describe("customerCreateSchema", () => {
  const validInput = { name: "Anvar Karimov", phone: "+998901234567" };

  it("accepts a name and a phone alone", () => {
    expect(customerCreateSchema.safeParse(validInput).success).toBe(true);
  });

  it("rejects a missing phone", () => {
    const { phone, ...rest } = validInput;
    expect(customerCreateSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects an empty name", () => {
    expect(customerCreateSchema.safeParse({ ...validInput, name: "" }).success).toBe(false);
  });

  it("rejects an invalid email but accepts a null one", () => {
    expect(customerCreateSchema.safeParse({ ...validInput, email: "nope" }).success).toBe(false);
    expect(customerCreateSchema.safeParse({ ...validInput, email: null }).success).toBe(true);
  });
});

describe("customerUpdateSchema", () => {
  it("accepts one field on its own", () => {
    expect(customerUpdateSchema.safeParse({ notes: "VIP" }).success).toBe(true);
  });

  it("rejects an empty object", () => {
    expect(customerUpdateSchema.safeParse({}).success).toBe(false);
  });
});

describe("orderCreateSchema", () => {
  const validInput = { customerId: "cus-1", items: [{ productId: "prod-1", qty: 2 }] };

  it("accepts a customer and one line", () => {
    expect(orderCreateSchema.safeParse(validInput).success).toBe(true);
  });

  it("accepts a unit price, which only a product priced on request needs", () => {
    const result = orderCreateSchema.safeParse({
      customerId: "cus-1",
      items: [{ productId: "prod-1", qty: 1, unitPrice: 1500 }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects an order with no lines", () => {
    expect(orderCreateSchema.safeParse({ ...validInput, items: [] }).success).toBe(false);
  });

  it("rejects a quantity below one", () => {
    const result = orderCreateSchema.safeParse({
      customerId: "cus-1",
      items: [{ productId: "prod-1", qty: 0 }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a fractional quantity", () => {
    const result = orderCreateSchema.safeParse({
      customerId: "cus-1",
      items: [{ productId: "prod-1", qty: 1.5 }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a negative unit price", () => {
    const result = orderCreateSchema.safeParse({
      customerId: "cus-1",
      items: [{ productId: "prod-1", qty: 1, unitPrice: -1 }],
    });
    expect(result.success).toBe(false);
  });
});

describe("orderUpdateSchema", () => {
  it("accepts a status move on its own", () => {
    expect(orderUpdateSchema.safeParse({ status: "CONFIRMED" }).success).toBe(true);
  });

  it("rejects an empty object", () => {
    expect(orderUpdateSchema.safeParse({}).success).toBe(false);
  });

  it("rejects a status outside the lifecycle", () => {
    expect(orderUpdateSchema.safeParse({ status: "SHIPPED" }).success).toBe(false);
  });
});

describe("orderListQuerySchema", () => {
  it("defaults to the first page when none is asked for", () => {
    const result = orderListQuerySchema.safeParse({});
    expect(result.success && result.data.page).toBe(1);
  });

  it("coerces the page, which arrives as a query string", () => {
    const result = orderListQuerySchema.safeParse({ page: "3" });
    expect(result.success && result.data.page).toBe(3);
  });

  it("rejects a page below one", () => {
    expect(orderListQuerySchema.safeParse({ page: "0" }).success).toBe(false);
  });
});

describe("discountRequestSchema", () => {
  it("accepts a percent with a reason", () => {
    expect(discountRequestSchema.safeParse({ percent: 12.5, reason: "Katta buyurtma" }).success).toBe(
      true,
    );
  });

  it("accepts the two ends of the range", () => {
    expect(discountRequestSchema.safeParse({ percent: 0 }).success).toBe(true);
    expect(discountRequestSchema.safeParse({ percent: 100 }).success).toBe(true);
  });

  it("rejects a percent outside it", () => {
    expect(discountRequestSchema.safeParse({ percent: -1 }).success).toBe(false);
    expect(discountRequestSchema.safeParse({ percent: 101 }).success).toBe(false);
  });

  it("rejects a missing percent", () => {
    expect(discountRequestSchema.safeParse({ reason: "Katta buyurtma" }).success).toBe(false);
  });
});
