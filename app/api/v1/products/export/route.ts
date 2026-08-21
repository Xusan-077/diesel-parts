import { authenticateDirector } from "@/lib/api/route-auth";
import { prisma } from "@/lib/db";
import { toCsv, type CsvProduct } from "@/lib/api/product-csv";

/**
 * The whole catalog as CSV, retired products included — the export is a working
 * copy the director edits and imports back, so leaving rows out would silently
 * delete nothing and silently recreate everything.
 */
export async function GET() {
  const guard = await authenticateDirector();
  if (!guard.ok) {
    return guard.response;
  }

  const rows = await prisma.product.findMany({ orderBy: { sku: "asc" } });

  const products: CsvProduct[] = rows.map((row) => ({
    id: row.id,
    sku: row.sku,
    slug: row.slug,
    oemNumbers: row.oemNumbers,
    name: { uz: row.nameUz, ru: row.nameRu, en: row.nameEn },
    description: { uz: row.descriptionUz, ru: row.descriptionRu, en: row.descriptionEn },
    price: row.price === null ? null : Number(row.price),
    stock: row.stock,
    minStock: row.minStock,
    categoryId: row.categoryId,
    brandId: row.brandId,
    compatibleModels: row.compatibleModels,
    specs: [],
    imageLabels: row.imageLabels,
    isActive: row.isActive,
  }));

  const today = new Date().toISOString().slice(0, 10);

  return new Response(toCsv(products), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="diesel-parts-katalog-' + today + '.csv"',
      // A catalog export is a point-in-time snapshot; a cached one is a wrong one.
      "Cache-Control": "no-store",
    },
  });
}
