import { notFound } from "next/navigation";
import { listBrands, listCategories } from "@/lib/api/product-repository";
import { getProductForEdit } from "@/lib/api/product-write-repository";
import { ProductForm } from "@/components/admin/product-form";
import { RetireProductButton } from "@/components/admin/retire-product-button";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [product, categories, brands] = await Promise.all([
    getProductForEdit(id),
    listCategories(),
    listBrands(),
  ]);

  if (product === null) {
    notFound();
  }

  return (
    <div>
      <p className="type-eyebrow text-muted">
        Mahsulotlar
      </p>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {product.name.uz}
        </h1>
        {product.isActive ? <RetireProductButton productId={id} /> : null}
      </div>
      <p className="mt-1 font-mono text-xs text-muted">{product.sku}</p>

      <ProductForm
        productId={id}
        initial={product}
        categories={categories.map((c) => ({ id: c.id, label: c.name.uz }))}
        brands={brands.map((b) => ({ id: b.id, label: b.name }))}
      />
    </div>
  );
}
