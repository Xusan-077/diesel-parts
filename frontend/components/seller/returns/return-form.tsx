"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/shadcn/card";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/shadcn/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/shadcn/radio-group";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/shadcn/sheet";
import { Checkbox } from "@/components/ui/shadcn/checkbox";
import { Skeleton } from "@/components/ui/shadcn/skeleton";
import { Input } from "@/components/seller/ui/input";
import { Select } from "@/components/seller/ui/select";
import { Button } from "@/components/seller/ui/button";
import { ConfirmDialog } from "@/components/seller/ui/confirm-dialog";
import { QueryErrorState } from "@/components/seller/query-error-state";
import { SalePicker } from "./sale-picker";
import { computeReturnableLines, type ReturnableLine } from "./return-lines";
import { returnSchema, type ReturnFormValues } from "./return-schema";
import { useSaleReturns } from "@/hooks/seller/queries/use-sale-returns";
import { useCreateReturn } from "@/hooks/seller/mutations/use-create-return";
import { formatMoney } from "@/lib/seller/format";
import { actionErrorMessage } from "@/lib/seller/action-errors";
import { SellerApiError } from "@/lib/api/seller-panel/client";
import {
  RETURN_CONDITION_LABEL,
  RETURN_REASON_LABEL,
} from "@/lib/seller/return-labels";
import type { Order } from "@/lib/api/seller-panel/types";

const refundMethods = [
  { value: "CASH", label: "Naqd" },
  { value: "CARD", label: "Karta" },
  { value: "PAYME", label: "Payme" },
  { value: "CLICK", label: "Click" },
  { value: "PAYNET", label: "Paynet" },
  { value: "ORIGINAL", label: "Asl to‘lov usuli" },
];
const cardClass = "border-border bg-surface text-foreground shadow-none";

export function ReturnForm() {
  const [order, setOrder] = useState<Order | null>(null);
  const history = useSaleReturns(order?.id);
  const lines = useMemo(
    () =>
      order && history.data
        ? computeReturnableLines(order, history.data).filter(
            (i) => i.remainingQty > 0,
          )
        : [],
    [order, history.data],
  );
  const eligible =
    order && ["COMPLETED", "PARTIALLY_REFUNDED"].includes(order.status);
  return (
    <div className="space-y-6">
      <Card className={cardClass}>
        <CardHeader>
          <CardTitle>Sotuv</CardTitle>
        </CardHeader>
        <CardContent>
          <SalePicker selected={order} onSelect={setOrder} />
        </CardContent>
      </Card>
      {order && !eligible && (
        <p role="alert" className="text-warning">
          Faqat yakunlangan yoki qisman qaytarilgan sotuvni tanlang.
        </p>
      )}
      {eligible &&
        (history.isError ? (
          <QueryErrorState
            error={history.error}
            onRetry={() => void history.refetch()}
          />
        ) : history.isLoading ? (
          <Skeleton className="h-56 bg-surface-muted" />
        ) : !lines.length ? (
          <p className="p-6 text-muted">Barcha mahsulotlar qaytarilgan.</p>
        ) : (
          <ReturnEditor key={order.id} order={order} lines={lines} />
        ))}
    </div>
  );
}

export function ReturnEditor({
  order,
  lines,
}: {
  order: Order;
  lines: ReturnableLine[];
}) {
  const router = useRouter();
  const mutation = useCreateReturn();
  const [confirm, setConfirm] = useState(false);
  const [mobileItem, setMobileItem] = useState<number | null>(null);
  const form = useForm<ReturnFormValues>({
    resolver: zodResolver(returnSchema),
    defaultValues: {
      refundMethod: "ORIGINAL",
      refundAmount: 0,
      items: lines.map((line) => ({
        ...line,
        selected: false,
        qty: line.remainingQty,
        reason: "WRONG_PRODUCT",
        condition: "GOOD",
      })),
    },
  });
  const items = useWatch({ control: form.control, name: "items" });
  const amount = useWatch({ control: form.control, name: "refundAmount" });
  const selectedCount = items.filter((i) => i.selected).length;
  const total =
    Math.round(
      items.reduce(
        (sum, i) => sum + (i.selected ? i.unitPrice * (Number(i.qty) || 0) : 0),
        0,
      ) * 100,
    ) / 100;
  function updateTotal() {
    const total = form
      .getValues("items")
      .reduce(
        (sum, i) => sum + (i.selected ? i.unitPrice * (Number(i.qty) || 0) : 0),
        0,
      );
    form.setValue("refundAmount", Math.round(total * 100) / 100, {
      shouldValidate: form.formState.isSubmitted,
    });
  }
  async function submit() {
    if (!(await form.trigger())) {
      setConfirm(false);
      return;
    }
    const values = form.getValues();
    try {
      const created = await mutation.mutateAsync({
        orderId: order.id,
        refundMethod: values.refundMethod,
        refundAmount: values.refundAmount,
        items: values.items
          .filter((i) => i.selected)
          .map(({ productId, qty, reason, condition }) => ({
            productId,
            qty,
            reason,
            condition,
          })),
      });
      setConfirm(false);
      router.push("/seller/returns/" + created.id);
    } catch (error) {
      setConfirm(false);
      const message = actionErrorMessage(error);
      if (
        error instanceof SellerApiError &&
        error.code === "refund_exceeds_total"
      )
        form.setError("refundAmount", { message });
      else if (
        error instanceof SellerApiError &&
        error.code === "original_payment_ambiguous"
      )
        form.setError("refundMethod", { message });
      else form.setError("root", { message });
    }
  }
  function itemControls(index: number, scope: string) {
    const item = items[index];
    return (
      <div className="grid gap-5 lg:grid-cols-[7rem_1fr_1fr]">
        <FormField
          control={form.control}
          name={`items.${index}.qty`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Miqdor (max {item.remainingQty})</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  value={Number.isNaN(field.value) ? "" : field.value}
                  type="number"
                  min={1}
                  max={item.remainingQty}
                  step={1}
                  onChange={(e) => {
                    field.onChange(
                      e.target.value === "" ? NaN : Number(e.target.value),
                    );
                    updateTotal();
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name={`items.${index}.reason`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Sabab</FormLabel>
              <FormControl>
                <Select
                  {...field}
                  options={Object.entries(RETURN_REASON_LABEL).map(
                    ([value, label]) => ({ value, label }),
                  )}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name={`items.${index}.condition`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Mahsulot holati</FormLabel>
              <FormControl>
                <RadioGroup
                  value={field.value}
                  onValueChange={field.onChange}
                  className="grid grid-cols-2 gap-3"
                >
                  {Object.entries(RETURN_CONDITION_LABEL).map(
                    ([value, label]) => (
                      <label
                        key={value}
                        className="flex items-center gap-2 text-sm"
                        htmlFor={scope + index + value}
                      >
                        <RadioGroupItem
                          id={scope + index + value}
                          value={value}
                        />
                        {label}
                      </label>
                    ),
                  )}
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    );
  }
  return (
    <Form {...form}>
      <form
        noValidate
        onSubmit={form.handleSubmit(() => {
          form.clearErrors("root");
          setConfirm(true);
        })}
        className="space-y-6"
      >
        <Card className={cardClass}>
          <CardHeader>
            <CardTitle>Qaytariladigan mahsulotlar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {items.map((item, index) => (
              <div
                key={item.productId}
                className="space-y-4 rounded-md border border-border p-4"
              >
                <div className="flex items-start gap-3">
                  <Checkbox
                    aria-label={item.name + " tanlash"}
                    checked={item.selected}
                    onCheckedChange={(value) => {
                      form.setValue(`items.${index}.selected`, value === true);
                      if (!value) {
                        form.setValue(`items.${index}.qty`, item.remainingQty);
                        form.clearErrors(`items.${index}`);
                      }
                      updateTotal();
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{item.name}</p>
                    <p className="mt-1 text-xs text-muted">
                      {item.sku} · {formatMoney(item.unitPrice)} ·{" "}
                      {item.remainingQty} dona
                    </p>
                  </div>
                </div>
                {item.selected && (
                  <>
                    <div className="hidden md:block">
                      {itemControls(index, "desktop")}
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      className="md:hidden w-full"
                      onClick={() => setMobileItem(index)}
                    >
                      Miqdor, sabab va holat
                    </Button>
                    <p className="text-right font-mono text-sm">
                      {formatMoney(item.unitPrice * (Number(item.qty) || 0))}
                    </p>
                  </>
                )}
                {form.formState.errors.items?.[index]?.qty && (
                  <p className="text-sm text-danger md:hidden">
                    {form.formState.errors.items[index]?.qty?.message}
                  </p>
                )}
              </div>
            ))}
            {form.formState.errors.items?.root && (
              <p role="alert" className="text-sm text-danger">
                {form.formState.errors.items.root.message}
              </p>
            )}
          </CardContent>
        </Card>
        <Card className={cardClass}>
          <CardHeader>
            <CardTitle>Qaytarish to‘lovi</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <FormField
              control={form.control}
              name="refundMethod"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>To‘lov usuli</FormLabel>
                  <FormControl>
                    <RadioGroup
                      value={field.value}
                      onValueChange={field.onChange}
                      className="grid grid-cols-2 gap-3 sm:grid-cols-3"
                    >
                      {refundMethods.map((method) => (
                        <label
                          key={method.value}
                          className="flex items-center gap-2 rounded-md border border-border p-3 text-sm"
                        >
                          <RadioGroupItem value={method.value} />
                          {method.label}
                        </label>
                      ))}
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="refundAmount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Qaytarish summasi (so‘m)</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={Number.isNaN(field.value) ? "" : field.value}
                      type="number"
                      min={0}
                      max={total}
                      step="0.01"
                      onChange={(e) =>
                        field.onChange(
                          e.target.value === "" ? NaN : Number(e.target.value),
                        )
                      }
                    />
                  </FormControl>
                  <p className="text-xs text-muted">
                    Mahsulotlar summasi: {formatMoney(total)}. Miqdor o‘zgarsa
                    summa qayta hisoblanadi.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
            {form.formState.errors.root && (
              <p role="alert" className="text-sm text-danger">
                {form.formState.errors.root.message}
              </p>
            )}
            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-4">
              <p className="text-sm text-muted">
                {selectedCount} ta mahsulot tanlandi
              </p>
              <Button
                type="submit"
                disabled={!selectedCount}
                loading={mutation.isPending}
              >
                Qaytarishni yaratish
              </Button>
            </div>
          </CardContent>
        </Card>
        <Sheet
          open={mobileItem !== null}
          onOpenChange={(next) => {
            if (!next) setMobileItem(null);
          }}
        >
          <SheetContent
            side="bottom"
            className="max-h-[90dvh] overflow-y-auto bg-surface text-foreground"
          >
            <SheetHeader>
              <SheetTitle>
                {mobileItem !== null ? items[mobileItem]?.name : "Mahsulot"}
              </SheetTitle>
              <SheetDescription className="text-muted">
                Miqdor, sabab va holatni belgilang.
              </SheetDescription>
            </SheetHeader>
            <div className="px-4">
              {mobileItem !== null && itemControls(mobileItem, "mobile")}
            </div>
            <SheetFooter>
              <Button type="button" onClick={() => setMobileItem(null)}>
                Tayyor
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
        <ConfirmDialog
          open={confirm}
          onOpenChange={setConfirm}
          title="Qaytarishni tasdiqlaysizmi?"
          description={
            selectedCount +
            " ta mahsulot · " +
            formatMoney(amount) +
            " qaytariladi."
          }
          loading={mutation.isPending}
          onConfirm={() => void submit()}
        />
      </form>
    </Form>
  );
}
