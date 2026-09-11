"use client";

import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/seller/page-header";
import { SectionCard } from "@/components/seller/section-card";
import { ProductSearchPanel } from "@/components/seller/pos/product-search-panel";
import { CustomerPicker } from "@/components/seller/pos/customer-picker";
import { CartPanel } from "@/components/seller/pos/cart-panel";
import { CheckoutDialog } from "@/components/seller/pos/checkout-dialog";
import { cartSubtotal, type CartLine } from "@/components/seller/pos/cart-types";
import type { Customer, SellerProduct } from "@/lib/api/seller-panel/types";

export default function NewSalePage() {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [discount, setDiscount] = useState(0);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  function handleAdd(product: SellerProduct) {
    if (product.availableQuantity <= 0) {
      toast.error(`${product.nameEn} — omborda mavjud emas`);
      return;
    }
    setLines((prev) => {
      const existing = prev.find((l) => l.productId === product.id);
      if (existing) {
        if (existing.qty >= product.availableQuantity) {
          toast.error(`${product.nameEn} — omborda ${product.availableQuantity} dona qoldi`);
          return prev;
        }
        return prev.map((l) => (l.productId === product.id ? { ...l, qty: l.qty + 1 } : l));
      }
      return [
        ...prev,
        {
          productId: product.id,
          sku: product.sku,
          nameEn: product.nameEn,
          unitPrice: product.price === null ? null : Number(product.price),
          availableQuantity: product.availableQuantity,
          qty: 1,
        },
      ];
    });
  }

  function resetSale() {
    setLines([]);
    setDiscount(0);
    setCustomer(null);
  }

  const total = Math.max(0, cartSubtotal(lines) - discount);
  const canCheckout = lines.length > 0 && customer !== null;

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Yangi sotuv" description="Mahsulotlarni qidiring yoki shtrix-kodni skanerlang." />

      <div className="mt-6 grid min-h-0 flex-1 gap-4 md:grid-cols-2">
        <SectionCard title="Mahsulotlar" className="min-h-0" bodyClassName="flex min-h-0 flex-1 flex-col">
          <ProductSearchPanel onAdd={handleAdd} />
        </SectionCard>

        <SectionCard title="Savatcha" className="min-h-0" bodyClassName="flex min-h-0 flex-1 flex-col gap-4">
          <CustomerPicker selected={customer} onSelect={setCustomer} />
          <CartPanel
            lines={lines}
            discount={discount}
            onDiscountChange={setDiscount}
            onUpdateQty={(productId, qty) =>
              setLines((prev) => prev.map((l) => (l.productId === productId ? { ...l, qty } : l)))
            }
            onRemove={(productId) => setLines((prev) => prev.filter((l) => l.productId !== productId))}
            onCheckout={() => setCheckoutOpen(true)}
            checkoutDisabled={!canCheckout}
          />
        </SectionCard>
      </div>

      {customer ? (
        <CheckoutDialog
          open={checkoutOpen}
          onOpenChange={setCheckoutOpen}
          customer={customer}
          lines={lines}
          discount={discount}
          total={total}
          onCompleted={resetSale}
        />
      ) : null}
    </div>
  );
}
