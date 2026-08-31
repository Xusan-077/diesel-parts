import { NextResponse } from "next/server";
import { authenticateDirector, apiError, parseQuery } from "@/lib/api/route-auth";
import {
  ADMIN_PAGE_SIZE,
  createProduct,
  listProductsForAdmin,
  setProductImage,
} from "@/lib/api/product-write-repository";
import {
  InvalidImageError,
  deleteProductImage,
  saveProductImage,
} from "@/lib/api/product-image-storage";
import { adminProductListQuerySchema, productWriteSchema } from "@/lib/schemas";

/**
 * The catalogue table's rows.
 *
 * Director-only, like every write below it: this listing exposes stock levels
 * and the archive, neither of which belongs in the public `/api/products`.
 * The page renders the first page itself and seeds React Query with it; this
 * is what the table refetches against after an edit, an archive or a restore.
 */
export async function GET(request: Request) {
  const guard = await authenticateDirector();
  if (!guard.ok) {
    return guard.response;
  }

  const query = parseQuery(request.url, adminProductListQuerySchema);
  if (!query.ok) {
    return query.response;
  }

  const page = await listProductsForAdmin({
    search: query.data.q,
    page: query.data.page,
    includeInactive: query.data.all,
    sort: query.data.sort,
  });

  return NextResponse.json({ success: true, ...page, pageSize: ADMIN_PAGE_SIZE });
}

/**
 * Reads the product fields from either body shape the form sends: plain JSON
 * when there is no photo to attach, or `multipart/form-data` — a `data` part
 * holding the same JSON as a string, plus an `image` part — when there is.
 * Two routes would otherwise exist for what is one creation with an optional
 * extra.
 */
async function readCreateBody(
  request: Request,
): Promise<{ ok: true; body: unknown; image: File | null } | { ok: false; response: NextResponse }> {
  const contentType = request.headers.get("content-type") ?? "";

  if (!contentType.includes("multipart/form-data")) {
    try {
      return { ok: true, body: await request.json(), image: null };
    } catch {
      return { ok: false, response: apiError(400, "Invalid JSON body") };
    }
  }

  const form = await request.formData();
  const raw = form.get("data");
  if (typeof raw !== "string") {
    return { ok: false, response: apiError(400, "Missing 'data' field") };
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return { ok: false, response: apiError(400, "Invalid JSON in 'data' field") };
  }

  const file = form.get("image");
  const image = file instanceof File && file.size > 0 ? file : null;
  return { ok: true, body, image };
}

export async function POST(request: Request) {
  const guard = await authenticateDirector();
  if (!guard.ok) {
    return guard.response;
  }

  const parsedBody = await readCreateBody(request);
  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const parsed = productWriteSchema.safeParse(parsedBody.body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, errors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  // Saved before the row exists, so a bad file is refused before anything is
  // written to the database — but nothing is left on disk for a create that
  // then fails on its own, which is why it is removed again below.
  let imageUrl: string | null = null;
  if (parsedBody.image) {
    try {
      imageUrl = await saveProductImage(parsedBody.image);
    } catch (error) {
      if (error instanceof InvalidImageError) {
        return NextResponse.json({ success: false, errors: { image: [error.message] } }, { status: 400 });
      }
      throw error;
    }
  }

  const result = await createProduct(parsed.data, guard.user.id);

  if (!result.ok) {
    if (imageUrl) {
      await deleteProductImage(imageUrl);
    }
    return result.reason === "duplicate"
      ? apiError(409, "Bu " + result.field + " allaqachon band.")
      : apiError(400, "Kategoriya yoki brend topilmadi.");
  }

  if (imageUrl) {
    await setProductImage(result.value.id, imageUrl, guard.user.id);
  }

  return NextResponse.json({ success: true, id: result.value.id }, { status: 201 });
}
