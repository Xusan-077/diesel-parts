import { listCatalogRows } from "@/lib/api/catalog-repository";
import { PageHeader } from "@/components/admin/page-header";
import { CategoryManager } from "@/components/admin/category-manager";

export default async function DirectorCategoriesPage() {
  const categories = await listCatalogRows();

  return (
    <div>
      <PageHeader
        eyebrow="Direktor paneli"
        title="Kategoriyalar"
        description="Saytdagi «Katalog» menyusi. Yuqori bosqichdagi kategoriya — menyudagi ustun, uning ichidagilar — o'sha ustunning bo'limlari."
      />

      <div className="mt-8">
        <CategoryManager categories={categories} />
      </div>
    </div>
  );
}
