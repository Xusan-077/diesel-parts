import { NextResponse } from "next/server";
import { authenticateDirector, apiError } from "@/lib/api/route-auth";
import { findProductImageUrl, setProductImage } from "@/lib/api/product-write-repository";
import {
  InvalidImageError,
  deleteProductImage,
  saveProductImage,
} from "@/lib/api/product-image-storage";

/**
 * Replaces one product's photo, and only its photo.
 *
 * Split from `PATCH /products/[id]` because the two bodies do not mix: that
 * route reads JSON, this one reads a single-file `multipart/form-data`, and a
 * director cropping a bad photo should not have to resend twenty other fields
 * to do it.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await authenticateDirector();
  if (!guard.ok) {
    return guard.response;
  }

  const { id } = await params;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return apiError(400, "Invalid form data");
  }

  const file = form.get("image");
  if (!(file instanceof File) || file.size === 0) {
    return apiError(400, "Rasm fayli talab qilinadi.");
  }

  const existing = await findProductImageUrl(id);
  if (existing === null) {
    return apiError(404, "Mahsulot topilmadi.");
  }

  let imageUrl: string;
  try {
    imageUrl = await saveProductImage(file);
  } catch (error) {
    if (error instanceof InvalidImageError) {
      return apiError(400, error.message);
    }
    throw error;
  }

  const result = await setProductImage(id, imageUrl, guard.user.id);
  if (!result.ok) {
    // Existed a moment ago and was just deleted from under this request —
    // rare, but leaves an orphaned file if not cleaned up here too.
    await deleteProductImage(imageUrl);
    return apiError(404, "Mahsulot topilmadi.");
  }

  // Only after the new file is safely referenced by the row.
  await deleteProductImage(existing.imageUrl);

  return NextResponse.json({ success: true, imageUrl });
}
