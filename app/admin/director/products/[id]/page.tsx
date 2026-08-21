import { notFound } from "next/navigation";
import { listBrands, listCategories } from "@/lib/api/product-repository";
import { getProductForEdit } from "@/lib/api/product-write-repository";
import { PageHeader } from "@/components/admin/page-header";
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
      <PageHeader
        eyebrow="Mahsulotlar"
        title={product.name.uz}
        description={<span className="font-mono text-xs">{product.sku}</span>}
        actions={product.isActive ? <RetireProductButton productId={id} /> : null}
      />

      <ProductForm
        productId={id}
        initial={product}
        categories={categories.map((c) => ({ id: c.id, label: c.name.uz }))}
        brands={brands.map((b) => ({ id: b.id, label: b.name }))}
      />
    </div>
  );
}
