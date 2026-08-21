import { listBrands, listCategories } from "@/lib/api/product-repository";
import { PageHeader } from "@/components/admin/page-header";
import { ProductForm } from "@/components/admin/product-form";

export default async function NewProductPage() {
  const [categories, brands] = await Promise.all([listCategories(), listBrands()]);

  return (
    <div>
      <PageHeader eyebrow="Mahsulotlar" title="Yangi mahsulot" />

      <ProductForm
        categories={categories.map((c) => ({ id: c.id, label: c.name.uz }))}
        brands={brands.map((b) => ({ id: b.id, label: b.name }))}
      />
    </div>
  );
}
