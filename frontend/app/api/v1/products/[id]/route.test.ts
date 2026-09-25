import { beforeEach, describe, expect, it, vi } from "vitest";

const getStaffUser = vi.fn();
const deleteProduct = vi.fn();
const deleteProductImage = vi.fn();
const checkProductDelete = vi.fn();

vi.mock("@/lib/auth/dal", () => ({ getStaffUser: () => getStaffUser() }));
vi.mock("@/lib/api/product-write-repository", () => ({
  deleteProduct: (...args: unknown[]) => deleteProduct(...args),
  checkProductDelete: (...args: unknown[]) => checkProductDelete(...args),
  getProductForEdit: vi.fn(),
  updateProduct: vi.fn(),
}));
vi.mock("@/lib/api/product-image-storage", () => ({
  deleteProductImage: (...args: unknown[]) => deleteProductImage(...args),
}));

const { DELETE } = await import("./route");
const { GET: DELETE_CHECK } = await import("./delete-check/route");

const params = { params: Promise.resolve({ id: "p1" }) };
const request = () => new Request("http://localhost/api/v1/products/p1", { method: "DELETE" });
const staff = (role: string) => ({ id: "u1", role, name: "X" });

describe("DELETE /api/v1/products/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(["MANAGER", "SELLER"])("refuses a %s with 403 and never calls the backend", async (role) => {
    getStaffUser.mockResolvedValue(staff(role));

    const response = await DELETE(request(), params);

    expect(response.status).toBe(403);
    expect(deleteProduct).not.toHaveBeenCalled();
    expect(deleteProductImage).not.toHaveBeenCalled();
  });

  it("answers 401 without a session", async () => {
    getStaffUser.mockResolvedValue(null);

    const response = await DELETE(request(), params);

    expect(response.status).toBe(401);
  });

  it("deletes for a DIRECTOR, then removes the photo", async () => {
    getStaffUser.mockResolvedValue(staff("DIRECTOR"));
    deleteProduct.mockResolvedValue({ ok: true, imageUrl: "https://a.public.blob.vercel-storage.com/p.jpg" });

    const response = await DELETE(request(), params);

    expect(response.status).toBe(200);
    expect(deleteProduct).toHaveBeenCalledWith("p1");
    expect(deleteProductImage).toHaveBeenCalledWith("https://a.public.blob.vercel-storage.com/p.jpg");
  });

  it("passes a history refusal through as 409 with its reasons, keeping the photo", async () => {
    getStaffUser.mockResolvedValue(staff("DIRECTOR"));
    deleteProduct.mockResolvedValue({
      ok: false,
      reason: "has_history",
      message: "Bu mahsulot bo'yicha savdo/ombor tarixi bor.",
      reasons: ["12 ta buyurtmada bor"],
    });

    const response = await DELETE(request(), params);
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.reasons).toEqual(["12 ta buyurtmada bor"]);
    expect(deleteProductImage).not.toHaveBeenCalled();
  });
});

describe("GET /api/v1/products/[id]/delete-check", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("refuses a MANAGER with 403", async () => {
    getStaffUser.mockResolvedValue(staff("MANAGER"));

    const response = await DELETE_CHECK(new Request("http://localhost"), params);

    expect(response.status).toBe(403);
    expect(checkProductDelete).not.toHaveBeenCalled();
  });

  it("returns the backend's answer to a DIRECTOR", async () => {
    getStaffUser.mockResolvedValue(staff("DIRECTOR"));
    checkProductDelete.mockResolvedValue({ canDelete: true, reasons: [] });

    const response = await DELETE_CHECK(new Request("http://localhost"), params);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, canDelete: true });
  });
});
