import { NextResponse } from "next/server";
import { authenticateDirector, apiError } from "@/lib/api/route-auth";
import { parseProductCsv, type CsvRowError } from "@/lib/api/product-csv";
import { createProduct, updateProduct } from "@/lib/api/product-write-repository";

/** A 200-row catalog is a few hundred kB; anything far larger is a mistake. */
const MAX_BYTES = 2 * 1024 * 1024;

export async function POST(request: Request) {
  const guard = await authenticateDirector();
  if (!guard.ok) {
    return guard.response;
  }

  const form = await request.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return apiError(400, "Fayl yuborilmadi.");
  }

  if (file.size > MAX_BYTES) {
    return apiError(413, "Fayl juda katta (2 MB dan oshmasin).");
  }

  const { rows, errors } = parseProductCsv(await file.text());

  /*
   * Validation is all-or-nothing: nothing is written until every row parses, so
   * a typo on line 80 cannot leave the catalog half-updated.
   *
   * A write that fails afterwards (a duplicate SKU, say) does leave the earlier
   * rows applied. That is safe to recover from — every exported row carries its
   * id, so re-uploading the corrected file updates those rows instead of
   * duplicating them — and each failure is reported with its line number.
   */
  if (errors.length > 0) {
    return NextResponse.json(
      { success: false, created: 0, updated: 0, errors },
      { status: 400 },
    );
  }

  const failures: CsvRowError[] = [];
  let created = 0;
  let updated = 0;

  for (const [index, row] of rows.entries()) {
    const { id, ...input } = row;
    const line = index + 2;

    const result = id
      ? await updateProduct(id, input, guard.user.id)
      : await createProduct(input, guard.user.id);

    if (result.ok) {
      if (id) {
        updated += 1;
      } else {
        created += 1;
      }
      continue;
    }

    failures.push({
      line,
      message:
        result.reason === "duplicate"
          ? "Bu " + result.field + " allaqachon band."
          : result.reason === "missing_reference"
            ? "Kategoriya yoki brend topilmadi."
            : "Mahsulot topilmadi (id: " + id + ")",
    });
  }

  return NextResponse.json({
    success: failures.length === 0,
    created,
    updated,
    errors: failures,
  });
}
