import { describe, expect, it } from "vitest";
import { deleteProductImage, validateImageFile } from "./product-image-storage";

function fakeFile(type: string, size: number): File {
  return new File([new Uint8Array(size)], "photo", { type });
}

describe("validateImageFile", () => {
  it("accepts a jpeg within the size limit", () => {
    const result = validateImageFile(fakeFile("image/jpeg", 1024));
    expect(result).toEqual({ ok: true, extension: "jpg" });
  });

  it("accepts png and webp", () => {
    expect(validateImageFile(fakeFile("image/png", 1024))).toEqual({
      ok: true,
      extension: "png",
    });
    expect(validateImageFile(fakeFile("image/webp", 1024))).toEqual({
      ok: true,
      extension: "webp",
    });
  });

  it("rejects an unsupported type", () => {
    const result = validateImageFile(fakeFile("application/pdf", 1024));
    expect(result.ok).toBe(false);
  });

  it("rejects an empty file", () => {
    const result = validateImageFile(fakeFile("image/jpeg", 0));
    expect(result.ok).toBe(false);
  });

  it("rejects a file over 5 MB", () => {
    const result = validateImageFile(fakeFile("image/jpeg", 5 * 1024 * 1024 + 1));
    expect(result.ok).toBe(false);
  });

  it("accepts a file exactly at the 5 MB limit", () => {
    const result = validateImageFile(fakeFile("image/jpeg", 5 * 1024 * 1024));
    expect(result.ok).toBe(true);
  });
});

describe("deleteProductImage", () => {
  it("does nothing for null or undefined", async () => {
    await expect(deleteProductImage(null)).resolves.toBeUndefined();
    await expect(deleteProductImage(undefined)).resolves.toBeUndefined();
  });

  it("does nothing for a URL outside the upload directory", async () => {
    // Guards seed photos under /seed-images from ever being unlinked by an
    // image replace or archive — this call must not touch disk at all.
    await expect(deleteProductImage("/seed-images/cat-injector.svg")).resolves.toBeUndefined();
  });

  it("resolves for a non-existent uploaded file rather than throwing", async () => {
    await expect(
      deleteProductImage("/uploads/products/does-not-exist.jpg"),
    ).resolves.toBeUndefined();
  });
});
