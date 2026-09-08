"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useWarehouses, useCreateGoodsReceipt, useUpdateGoodsReceipt } from "@/hooks/admin/use-warehouse";
import { requestErrorMessage } from "@/lib/api/request-error";
import { useFieldErrors } from "@/lib/forms/use-field-errors";
import { goodsReceiptWriteSchema } from "@/lib/schemas";
import { computeReceiptTotals, lineTotal } from "@/lib/warehouse/receipt-totals";
import { formatSum } from "@/lib/analytics/format";
import type { GoodsReceiptDetail, WarehouseProductRow, WarehouseRow } from "@/lib/api/warehouse-repository";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/shadcn/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/shadcn/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/shadcn/table";
import { ProductSearchAdd } from "./product-search-add";

interface LineDraft {
  productId: string;
  name: string;
  sku: string;
  unit: string;
  quantity: string;
  unitCost: string;
}

function numberOr(value: string, fallback = 0): number {
  const parsed = Number(value.replace(/\s+/g, ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function GoodsReceiptForm({
  warehouses,
  receipt,
}: {
  warehouses: WarehouseRow[];
  /** Present when editing a DRAFT; absent for a new receipt. */
  receipt?: GoodsReceiptDetail;
}) {
  const router = useRouter();
  const warehouseList = useWarehouses(warehouses);
  const activeWarehouses = (warehouseList.data ?? warehouses).filter(
    (w) => w.status === "ACTIVE" || w.id === receipt?.warehouseId,
  );

  const [warehouseId, setWarehouseId] = useState(receipt?.warehouseId ?? "");
  const [supplierName, setSupplierName] = useState(receipt?.supplierName ?? "");
  const [note, setNote] = useState(receipt?.note ?? "");
  const [discount, setDiscount] = useState(receipt ? String(receipt.discount) : "0");
  const [tax, setTax] = useState(receipt ? String(receipt.tax) : "0");
  const [lines, setLines] = useState<LineDraft[]>(
    receipt
      ? receipt.lines.map((line) => ({
          productId: line.productId,
          name: line.productName,
          sku: line.productSku,
          unit: line.unit,
          quantity: String(line.quantity),
          unitCost: String(line.unitCost),
        }))
      : [],
  );
  const [formError, setFormError] = useState<string | null>(null);

  const create = useCreateGoodsReceipt();
  const update = useUpdateGoodsReceipt();
  const busy = create.isPending || update.isPending;

  const chosenIds = useMemo(() => new Set(lines.map((line) => line.productId)), [lines]);

  const totals = useMemo(
    () =>
      computeReceiptTotals(
        lines.map((line) => ({ quantity: numberOr(line.quantity), unitCost: numberOr(line.unitCost) })),
        numberOr(discount),
        numberOr(tax),
      ),
    [lines, discount, tax],
  );

  const payload = {
    warehouseId,
    supplierName: supplierName.trim() || undefined,
    note: note.trim() || undefined,
    discount: numberOr(discount),
    tax: numberOr(tax),
    items: lines.map((line) => ({
      productId: line.productId,
      quantity: numberOr(line.quantity),
      unitCost: numberOr(line.unitCost),
    })),
  };
  const field = useFieldErrors(goodsReceiptWriteSchema, payload);

  function addProduct(product: WarehouseProductRow) {
    setLines((current) => [
      ...current,
      {
        productId: product.id,
        name: product.name,
        sku: product.sku,
        unit: product.unit,
        quantity: "1",
        unitCost: product.unitCost === null ? "" : String(product.unitCost),
      },
    ]);
  }

  function updateLine(index: number, patch: Partial<LineDraft>) {
    setLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  function removeLine(index: number) {
    setLines((current) => current.filter((_, i) => i !== index));
  }

  async function submit() {
    if (!field.touchAll()) {
      setFormError("Formada xatolik bor — belgilangan maydonlarni tekshiring.");
      return;
    }
    setFormError(null);

    try {
      const saved = receipt
        ? await update.mutateAsync({ id: receipt.id, values: payload })
        : await create.mutateAsync(payload);
      toast.success(receipt ? "Qabul yangilandi" : "Qabul qoralama sifatida saqlandi");
      router.push(`/director/warehouse/incomes/${saved.id}`);
    } catch (cause) {
      setFormError(requestErrorMessage(cause, "Saqlanmadi. Maydonlarni tekshiring."));
    }
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      noValidate
      className="space-y-8"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <FormField label="Ombor" required error={field.errorFor("warehouseId")}>
          <Select value={warehouseId} onValueChange={setWarehouseId}>
            <SelectTrigger aria-label="Ombor">
              <SelectValue placeholder="Omborni tanlang" />
            </SelectTrigger>
            <SelectContent>
              {activeWarehouses.map((warehouse) => (
                <SelectItem key={warehouse.id} value={warehouse.id}>
                  {warehouse.code} · {warehouse.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>

        <FormField label="Yetkazib beruvchi" error={field.errorFor("supplierName")}>
          <Input
            value={supplierName}
            onChange={(event) => setSupplierName(event.target.value)}
            onBlur={() => field.touch("supplierName")}
            placeholder="Diesel Impex MChJ"
          />
        </FormField>

        <FormField label="Izoh" error={field.errorFor("note")} className="md:col-span-2">
          <Textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={2}
            placeholder="Yuk xati raqami, kelishuv shartlari…"
          />
        </FormField>
      </div>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="type-title text-foreground">Qatorlar</h2>
          <ProductSearchAdd chosenIds={chosenIds} onPick={addProduct} />
        </div>

        {field.errorFor("items") ? (
          <p role="alert" className="mt-2 text-sm text-danger">
            {field.errorFor("items")}
          </p>
        ) : null}

        <div className="panel mt-4 overflow-x-auto">
          {lines.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">
              Hali qator yo&apos;q. Yuqoridan mahsulot qo&apos;shing.
            </p>
          ) : (
            <Table className="min-w-3xl">
              <TableHeader>
                <TableRow>
                  <TableHead>Mahsulot</TableHead>
                  <TableHead className="w-28 text-right">Miqdor</TableHead>
                  <TableHead className="w-40 text-right">Birlik tannarxi</TableHead>
                  <TableHead className="w-36 text-right">Jami</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((line, index) => (
                  <TableRow key={line.productId}>
                    <TableCell>
                      <span className="block text-foreground">{line.name}</span>
                      <span className="block font-mono text-xs text-muted">{line.sku}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={line.quantity}
                        onChange={(event) => updateLine(index, { quantity: event.target.value })}
                        onBlur={() => field.touch(`items.${index}.quantity`)}
                        aria-label={`${line.name} — miqdor`}
                        className="h-9 w-24 rounded-md border border-border bg-transparent px-2 text-right font-mono text-sm tabular-nums focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                      />
                      {field.errorFor(`items.${index}.quantity`) ? (
                        <span className="mt-0.5 block text-[11px] text-danger">
                          {field.errorFor(`items.${index}.quantity`)}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right">
                      <input
                        type="number"
                        min={0}
                        step={100}
                        value={line.unitCost}
                        onChange={(event) => updateLine(index, { unitCost: event.target.value })}
                        onBlur={() => field.touch(`items.${index}.unitCost`)}
                        aria-label={`${line.name} — birlik tannarxi`}
                        className="h-9 w-36 rounded-md border border-border bg-transparent px-2 text-right font-mono text-sm tabular-nums focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                      />
                      {field.errorFor(`items.${index}.unitCost`) ? (
                        <span className="mt-0.5 block text-[11px] text-danger">
                          {field.errorFor(`items.${index}.unitCost`)}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm tabular-nums text-foreground">
                      {formatSum(
                        lineTotal({
                          quantity: numberOr(line.quantity),
                          unitCost: numberOr(line.unitCost),
                        }),
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        aria-label={`${line.name} qatorini o'chirish`}
                        onClick={() => removeLine(index)}
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="grid gap-4">
          <FormField label="Chegirma (so'm)" error={field.errorFor("discount")}>
            <Input
              type="number"
              min={0}
              value={discount}
              onChange={(event) => setDiscount(event.target.value)}
              className="font-mono"
            />
          </FormField>
          <FormField label="Soliq (so'm)" error={field.errorFor("tax")}>
            <Input
              type="number"
              min={0}
              value={tax}
              onChange={(event) => setTax(event.target.value)}
              className="font-mono"
            />
          </FormField>
        </div>

        <dl className="panel space-y-2 self-start text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-muted">Qatorlar summasi</dt>
            <dd className="font-mono tabular-nums text-foreground">{formatSum(totals.subtotal)}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted">Chegirma</dt>
            <dd className="font-mono tabular-nums text-muted">−{formatSum(numberOr(discount))}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted">Soliq</dt>
            <dd className="font-mono tabular-nums text-muted">+{formatSum(numberOr(tax))}</dd>
          </div>
          <div className="flex items-center justify-between border-t border-border pt-2">
            <dt className="font-medium text-foreground">Umumiy</dt>
            <dd className="type-title font-mono tabular-nums text-foreground">
              {formatSum(totals.total)}
            </dd>
          </div>
        </dl>
      </div>

      {formError ? (
        <p role="alert" className="rounded-md border border-danger bg-danger-surface px-3 py-2 text-sm text-danger">
          {formError}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={busy}>
          {busy ? (
            <>
              <Spinner />
              Saqlanmoqda…
            </>
          ) : receipt ? (
            "O'zgarishlarni saqlash"
          ) : (
            "Qoralama sifatida saqlash"
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => router.push("/director/warehouse/incomes")}
        >
          Bekor qilish
        </Button>
        <p className="text-xs text-muted">
          Saqlangandan so&apos;ng qabulni tekshirib, tasdiqlaysiz — qoldiqlar shunda yangilanadi.
        </p>
      </div>
    </form>
  );
}
