import { NextResponse } from "next/server";
import { authenticateDirector, apiError } from "@/lib/api/route-auth";
import {
  deleteProduct,
  getProductForEdit,
  updateProduct,
} from "@/lib/api/product-write-repository";
import { deleteProductImage } from "@/lib/api/product-image-storage";
import { productWriteSchema } from "@/lib/schemas";

/**
 * The product as the edit form needs it, which is not the shape the catalogue
 * serves at `/api/products/[slug]`.
 *
 * That one answers a shopper: one language, a rendered price, no archived rows.
 * This answers the director's form: all three languages, the raw nullable
 * price, the category and brand as ids rather than names. Deriving one from the
 * other in the browser would mean the form re-guessing what it is about to
 * PATCH, so the write shape is read back verbatim.
 *
 * It exists because the edit dialog opens over the catalogue list, which holds
 * only the row summary. Loading twenty fields per row up front to save this
 * request would send the whole catalogue to the browser to edit one part.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await authenticateDirector();
  if (!guard.ok) {
    return guard.response;
  }

  const { id } = await params;
  const product = await getProductForEdit(id);

  if (product === null) {
    return apiError(404, "Mahsulot topilmadi.");
  }

  return NextResponse.json({ success: true, product });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await authenticateDirector();
  if (!guard.ok) {
    return guard.response;
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "Invalid JSON body");
  }

  const parsed = productWriteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, errors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const result = await updateProduct(id, parsed.data, guard.user.id);

  if (!result.ok) {
    if (result.reason === "not_found") {
      return apiError(404, "Mahsulot topilmadi.");
    }
    return result.reason === "duplicate"
      ? apiError(409, "Bu " + result.field + " allaqachon band.")
      : apiError(400, "Kategoriya yoki brend topilmadi.");
  }

  return NextResponse.json({ success: true, id });
}

/**
 * Permanent delete — DIRECTOR only here, and backend/ gates the same call to
 * DIRECTOR_UP on its own, so a MANAGER/SELLER token is refused twice over.
 * A product with any sales/warehouse history answers 409 with the reasons;
 * archiving lives at `POST /products/[id]/archive`.
 *
 * The photo is removed from Blob only after the row is gone: a failed file
 * delete is logged inside `deleteProductImage` and never fails the request.
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await authenticateDirector();
  if (!guard.ok) {
    return guard.response;
  }

  const { id } = await params;
  const result = await deleteProduct(id);

  if (!result.ok) {
    if (result.reason === "not_found") {
      return apiError(404, "Mahsulot topilmadi.");
    }
    return NextResponse.json(
      { success: false, errors: { _root: [result.message] }, reasons: result.reasons },
      { status: 409 },
    );
  }

  await deleteProductImage(result.imageUrl);

  return NextResponse.json({ success: true, id });
}
