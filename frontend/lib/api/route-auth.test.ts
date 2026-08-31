import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

// The DAL reads the session and then the user row, which needs a database.
// Mocking it leaves the guard itself — the part under test — untouched.
const getStaffUser = vi.fn();
vi.mock("@/lib/auth/dal", () => ({
  getStaffUser: () => getStaffUser(),
}));

const { authenticateStaff, authenticateDirector, parseJsonBody, parseQuery, validationError } =
  await import("./route-auth");

const seller = { id: "seller-1", name: "Sotuvchi", email: "s@d.uz", role: "SELLER", discountLimit: 5 };
const director = {
  id: "director-1",
  name: "Direktor",
  email: "d@d.uz",
  role: "DIRECTOR",
  discountLimit: 100,
};

beforeEach(() => {
  getStaffUser.mockReset();
});

describe("authenticateStaff", () => {
  it("answers 401 when nobody is signed in", async () => {
    getStaffUser.mockResolvedValue(null);

    const guard = await authenticateStaff();

    expect(guard.ok).toBe(false);
    if (!guard.ok) {
      expect(guard.response.status).toBe(401);
      expect((await guard.response.json()).success).toBe(false);
    }
  });

  it("lets a seller through", async () => {
    getStaffUser.mockResolvedValue(seller);

    const guard = await authenticateStaff();

    expect(guard.ok).toBe(true);
    if (guard.ok) {
      expect(guard.user.id).toBe("seller-1");
    }
  });
});

describe("authenticateDirector", () => {
  it("answers 401 before it answers 403", async () => {
    getStaffUser.mockResolvedValue(null);

    const guard = await authenticateDirector();

    expect(guard.ok).toBe(false);
    if (!guard.ok) {
      expect(guard.response.status).toBe(401);
    }
  });

  it("answers 403 for a signed-in seller", async () => {
    // 403, not 404: the seller is known, and hiding the route buys nothing when
    // the panel navigation is the same code they already run.
    getStaffUser.mockResolvedValue(seller);

    const guard = await authenticateDirector();

    expect(guard.ok).toBe(false);
    if (!guard.ok) {
      expect(guard.response.status).toBe(403);
    }
  });

  it("lets a director through", async () => {
    getStaffUser.mockResolvedValue(director);

    const guard = await authenticateDirector();

    expect(guard.ok).toBe(true);
  });
});

describe("validationError", () => {
  it("reports a field complaint under that field", async () => {
    const result = z.object({ name: z.string() }).safeParse({ name: 1 });
    if (result.success) {
      throw new Error("expected the parse to fail");
    }

    const response = validationError(result.error);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.success).toBe(false);
    expect(json.errors.name).toBeDefined();
  });

  it("reports a whole-object complaint under _root, which has no field", async () => {
    const schema = z.object({ a: z.string().optional() }).refine((v) => Object.keys(v).length > 0);
    const result = schema.safeParse({});
    if (result.success) {
      throw new Error("expected the parse to fail");
    }

    const json = await validationError(result.error).json();
    expect(json.errors._root).toHaveLength(1);
  });
});

describe("parseJsonBody", () => {
  const schema = z.object({ qty: z.number() });

  function request(body: string) {
    return new Request("http://localhost/api/v1/test", { method: "POST", body });
  }

  it("answers 400 for a body that is not JSON", async () => {
    const parsed = await parseJsonBody(request("not json"), schema);

    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.response.status).toBe(400);
      expect((await parsed.response.json()).errors._root).toBeDefined();
    }
  });

  it("answers 400 for JSON the schema rejects", async () => {
    const parsed = await parseJsonBody(request(JSON.stringify({ qty: "two" })), schema);

    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.response.status).toBe(400);
    }
  });

  it("hands back the parsed data when it fits", async () => {
    const parsed = await parseJsonBody(request(JSON.stringify({ qty: 2 })), schema);

    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.data).toEqual({ qty: 2 });
    }
  });
});

describe("parseQuery", () => {
  const schema = z.object({ page: z.coerce.number().int().min(1).default(1) });

  it("coerces the strings a query string is made of", () => {
    const parsed = parseQuery("http://localhost/api/v1/test?page=3", schema);

    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.data.page).toBe(3);
    }
  });

  it("applies the default when the parameter is absent", () => {
    const parsed = parseQuery("http://localhost/api/v1/test", schema);

    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.data.page).toBe(1);
    }
  });

  it("answers 400 for a value the schema rejects", () => {
    const parsed = parseQuery("http://localhost/api/v1/test?page=0", schema);

    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.response.status).toBe(400);
    }
  });
});
