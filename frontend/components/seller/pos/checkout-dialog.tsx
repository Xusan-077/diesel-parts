"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Dialog } from "@/components/seller/ui/dialog";
import { Button } from "@/components/seller/ui/button";
import { Input } from "@/components/seller/ui/input";
import { useCreateOrder } from "@/hooks/seller/mutations/use-create-order";
import { useUpdateOrderStatus } from "@/hooks/seller/mutations/use-update-order-status";
import { useRecordPayment } from "@/hooks/seller/mutations/use-record-payment";
import { formatMoney } from "@/lib/seller/format";
import { SellerApiError } from "@/lib/api/seller-panel/client";
import { cn } from "@/lib/utils";
import type { Customer, PaymentMethod } from "@/lib/api/seller-panel/types";
import type { CartLine } from "./cart-types";

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "CASH", label: "Naqd" },
  { value: "CARD", label: "Karta" },
  { value: "TRANSFER", label: "O'tkazma" },
  { value: "ONLINE", label: "Onlayn" },
];

export function CheckoutDialog({
  open,
  onOpenChange,
  customer,
  lines,
  discount,
  total,
  onCompleted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: Customer;
  lines: CartLine[];
  discount: number;
  total: number;
  onCompleted: () => void;
}) {
  const router = useRouter();
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [amountReceived, setAmountReceived] = useState(String(total));
  const [step, setStep] = useState<"idle" | "running">("idle");

  const createOrder = useCreateOrder();
  const updateStatus = useUpdateOrderStatus();
  const recordPayment = useRecordPayment();

  const paid = Math.min(Math.max(0, Number(amountReceived) || 0), total);
  const remainingDebt = Math.max(0, total - paid);

  async function handleSubmit() {
    setStep("running");
    let orderId: string | null = null;
    try {
      const order = await createOrder.mutateAsync({
        customerId: customer.id,
        items: lines.map((line) => ({
          productId: line.productId,
          quantity: line.qty,
          ...(line.unitPrice === null ? {} : { price: line.unitPrice }),
        })),
        discount: discount || undefined,
      });
      orderId = order.id;

      await updateStatus.mutateAsync({ id: order.id, status: "CONFIRMED" });

      if (paid > 0) {
        await recordPayment.mutateAsync({ orderId: order.id, amount: paid, method });
      }

      await updateStatus.mutateAsync({ id: order.id, status: "COMPLETED" });

      toast.success(
        remainingDebt > 0
          ? `Sotuv yakunlandi — ${formatMoney(remainingDebt)} mijoz qarziga yozildi`
          : "Sotuv yakunlandi",
      );
      onCompleted();
      router.push(`/seller/orders/${order.id}`);
    } catch (err) {
      // Each step's own mutation already toasted what failed. The order (if
      // created) is left exactly where it stopped — the detail page's status
      // stepper can resume CONFIRM/COMPLETE from there, so nothing is lost.
      if (orderId) {
        toast.info("Buyurtma yaratildi, lekin yakunlanmadi — uni buyurtma sahifasidan davom ettiring");
        router.push(`/seller/orders/${orderId}`);
      } else if (!(err instanceof SellerApiError)) {
        toast.error("Kutilmagan xatolik yuz berdi");
      }
      setStep("idle");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (step !== "running") onOpenChange(next);
      }}
      title="Sotuvni yakunlash"
      description={`${customer.name} · ${lines.length} ta mahsulot`}
      footer={
        <>
          <Button type="button" variant="secondary" disabled={step === "running"} onClick={() => onOpenChange(false)}>
            Bekor qilish
          </Button>
          <Button type="button" loading={step === "running"} onClick={() => void handleSubmit()}>
            Tasdiqlash
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex justify-between border-b border-border pb-3 text-base font-semibold text-foreground">
          <span>Jami to&apos;lov</span>
          <span className="font-mono">{formatMoney(total)}</span>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium text-muted">To&apos;lov usuli</p>
          <div className="flex flex-wrap gap-1 rounded-md border border-border bg-surface p-1">
            {PAYMENT_METHODS.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => setMethod(m.value)}
                className={cn(
                  "rounded-sm px-3 py-1.5 text-xs font-medium transition-colors",
                  method === m.value ? "bg-accent text-accent-foreground" : "text-muted hover:text-foreground",
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted">Qabul qilingan summa</span>
          <Input
            type="number"
            min={0}
            max={total}
            value={amountReceived}
            onChange={(e) => setAmountReceived(e.target.value)}
          />
        </label>

        {remainingDebt > 0 ? (
          <p className="rounded-md border border-warning bg-warning-surface px-3 py-2 text-xs text-warning">
            Qolgan {formatMoney(remainingDebt)} mijoz qarziga yoziladi (qarz limiti oshsa, sotuv yakunlanmaydi).
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}
