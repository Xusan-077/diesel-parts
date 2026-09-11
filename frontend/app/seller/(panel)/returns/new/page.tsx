import { PageHeader } from "@/components/seller/page-header";
import { ReturnForm } from "@/components/seller/returns/return-form";

export default function NewReturnPage() {
  return (
    <div>
      <PageHeader
        title="Yangi qaytarish"
        description="Sotuvni tanlang va qaytariladigan mahsulotlarni belgilang."
      />
      <div className="mt-6">
        <ReturnForm />
      </div>
    </div>
  );
}
