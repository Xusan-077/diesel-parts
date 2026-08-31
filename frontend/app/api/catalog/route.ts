import { NextResponse } from "next/server";
import { getCatalogTree } from "@/lib/api/catalog-repository";
import type { CatalogTreeResponse } from "@/lib/catalog-tree";

/**
 * The catalog menu the header and the mobile drawer draw.
 *
 * Public and read-only: this is the site's navigation, not catalog data, and
 * every visitor gets the same answer. Names come back in all three locales
 * rather than one — the payload is a few kilobytes and it lets the language
 * switch repaint the menu without a second request.
 *
 * A failed read answers 503 rather than an empty tree: an empty menu looks like
 * a shop with nothing in it, while a refusal is something the menu can show a
 * retry button for.
 */
export async function GET() {
  try {
    const items = await getCatalogTree();
    return NextResponse.json({ items } satisfies CatalogTreeResponse);
  } catch (error) {
    console.error("[api/catalog] failed to read the category tree:", error);
    return NextResponse.json(
      { success: false, errors: { _root: ["Katalog hozircha yuklanmadi."] } },
      { status: 503 },
    );
  }
}
