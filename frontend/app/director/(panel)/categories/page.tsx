import { listCatalogRows } from "@/lib/api/catalog-repository";
import { safeRead } from "@/lib/api/safe-read";
import { PageHeader } from "@/components/admin/page-header";
import { CategoryManager } from "@/components/admin/category-manager";

export default async function DirectorCategoriesPage() {
  /*
   * Seeds the tree below, which owns it from there: every add, rename and
   * delete invalidates that cache instead of re-running this route.
   */
  const categories = await safeRead("admin category tree", listCatalogRows, undefined);

  return (
    <div>
      <PageHeader
        eyebrow="Direktor paneli"
        title="Kategoriyalar"
        description="Saytdagi «Katalog» menyusi. Yuqori bosqichdagi kategoriya — menyudagi ustun, uning ichidagilar — o'sha ustunning bo'limlari."
      />

      <div className="mt-8">
        <CategoryManager initialData={categories.data} />
      </div>
    </div>
  );
}
