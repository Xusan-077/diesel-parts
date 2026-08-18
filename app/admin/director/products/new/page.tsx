import { listBrands, listCategories } from "@/lib/api/product-repository";
import { ProductForm } from "@/components/admin/product-form";

export default async function NewProductPage() {
  const [categories, brands] = await Promise.all([listCategories(), listBrands()]);

  return (
    <div>
      <p className="font-mono text-[0.6875rem] uppercase tracking-[0.2em] text-muted">
        Mahsulotlar
      </p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
        Yangi mahsulot
      </h1>

      <ProductForm
        categories={categories.map((c) => ({ id: c.id, label: c.name.uz }))}
        brands={brands.map((b) => ({ id: b.id, label: b.name }))}
      />
    </div>
  );
}
