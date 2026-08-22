"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useCreateProduct, useUpdateProduct } from "@/hooks/admin/use-admin-products";
import { OFFLINE_MESSAGE, refusalPayload } from "@/lib/api/request-error";
import { useFieldErrors, type FieldErrors } from "@/lib/forms/use-field-errors";
import { productWriteSchema, type ProductWriteInput } from "@/lib/schemas";
import { CheckboxField } from "@/components/ui/checkbox";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { FormField } from "@/components/ui/form-field";
import { FormModal } from "@/components/ui/form-modal";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export interface ReferenceOption {
  id: string;
  label: string;
}

/** One list value per line: a director pasting OEM numbers from a supplier's
 *  sheet gets them one per line, and commas appear inside part numbers. */
function linesToList(value: string): string[] {
  return value
    .split("\n")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function listToLines(values: readonly string[]): string {
  return values.join("\n");
}

/**
 * Splits the API's refusal into the field slots the form can show it in.
 *
 * The route answers a schema failure with `{ errors: { sku: ["..."] } }` and a
 * business refusal — a duplicate SKU, a missing category — with a plain
 * `error` string. Both arrive here; the first lands under its field, the
 * second above the buttons.
 */
function splitRefusal(error: unknown): { fields: FieldErrors; message: string | null } {
  const data = refusalPayload<{
    error?: string;
    errors?: Record<string, string[] | undefined>;
  }>(error);

  if (!data) {
    return { fields: {}, message: OFFLINE_MESSAGE };
  }

  const fields: FieldErrors = {};
  for (const [key, messages] of Object.entries(data.errors ?? {})) {
    const first = messages?.[0];
    if (typeof first === "string") {
      fields[key] = first;
    }
  }

  /*
   * A duplicate SKU is reported as prose because the route cannot know which
   * of the two unique columns the director was editing. It is worth pinning to
   * the field anyway: "Bu sku allaqachon band" above the buttons makes the
   * director scan twenty fields for the one it means.
   */
  const message = typeof data.error === "string" ? data.error : null;
  if (message !== null && Object.keys(fields).length === 0) {
    if (message.includes("sku")) {
      fields.sku = message;
    } else if (message.includes("slug")) {
      fields.slug = message;
    }
  }

  return {
    fields,
    message: Object.keys(fields).length > 0 && message === null ? null : message,
  };
}

const EMPTY: ProductWriteInput = {
  sku: "",
  slug: "",
  oemNumbers: [],
  name: { uz: "", ru: "", en: "" },
  description: { uz: "", ru: "", en: "" },
  price: null,
  stock: 0,
  minStock: 5,
  categoryId: "",
  brandId: "",
  compatibleModels: [],
  specs: [],
  imageLabels: [],
  isActive: true,
};

/** Section heading inside the modal — the same eyebrow the pages use. */
function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h3 className="type-eyebrow border-b border-border pb-2 text-muted">{title}</h3>
      {children}
    </section>
  );
}

export interface ProductFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Absent when creating; the form then POSTs instead of PATCHing. */
  productId?: string;
  initial?: ProductWriteInput;
  categories: readonly ReferenceOption[];
  brands: readonly ReferenceOption[];
}

/**
 * Add and edit a product, in a dialog over the catalogue.
 *
 * This used to be two routes — `/products/new` and `/products/[id]` — and the
 * cost was not the navigation, it was the context: a director reconciling a
 * delivery note against the list had to leave the list to correct one stock
 * count, and come back to a page scrolled to the top with their search gone.
 * The dialog keeps the list underneath, filters and scroll position intact.
 *
 * It is `xl` because the form is twenty fields. At `lg` the two columns are
 * narrow enough that the three-language name group wraps, which turns a scan
 * down one column into a scan down one-and-a-half.
 */
export function ProductFormModal({
  open,
  onOpenChange,
  productId,
  initial,
  categories,
  brands,
}: ProductFormModalProps) {
  const start = initial ?? EMPTY;

  const [form, setForm] = useState<ProductWriteInput>({
    ...start,
    categoryId: start.categoryId || categories[0]?.id || "",
    brandId: start.brandId || brands[0]?.id || "",
  });
  const [oem, setOem] = useState(listToLines(start.oemNumbers));
  const [models, setModels] = useState(listToLines(start.compatibleModels));
  const [images, setImages] = useState(listToLines(start.imageLabels));
  const [priceText, setPriceText] = useState(start.price === null ? "" : String(start.price));
  const [message, setMessage] = useState<string | null>(null);

  /*
   * Two mutations rather than one with a branch: the create and the update are
   * different verbs against different URLs, and both invalidate the catalogue
   * cache on success. That invalidation is what refills the table — there is
   * no optimistic row, because a created product's derived stock status and
   * category name come back from the write, and guessing them would show a row
   * that corrects itself a beat later.
   */
  const create = useCreateProduct();
  const update = useUpdateProduct();
  const saving = create.isPending || update.isPending;

  /*
   * The value the schema actually judges, rebuilt on every keystroke. The three
   * textareas and the price box are held as text because that is what a partly
   * typed list or a partly typed number *is* — turning "12" into 12 and back on
   * every render would fight the caret in the price field.
   */
  const payload: ProductWriteInput = {
    ...form,
    oemNumbers: linesToList(oem),
    compatibleModels: linesToList(models),
    imageLabels: linesToList(images),
    // Empty means "price not set", which the catalog renders as a contact
    // action. Coercing it to 0 would advertise a free part.
    price: priceText.trim() === "" ? null : Number(priceText),
  };

  const field = useFieldErrors(productWriteSchema, payload);

  const categoryOptions: ComboboxOption[] = categories.map((option) => ({
    value: option.id,
    label: option.label,
  }));
  const brandOptions: ComboboxOption[] = brands.map((option) => ({
    value: option.id,
    label: option.label,
  }));

  async function save() {
    setMessage(null);

    /*
     * Nothing is sent until the schema passes here. The route would refuse it
     * anyway, but a round trip to be told a required field is empty is a round
     * trip to learn something the browser already knew.
     */
    if (!field.touchAll()) {
      return;
    }

    try {
      await (productId
        ? update.mutateAsync({ id: productId, values: payload })
        : create.mutateAsync(payload));

      toast.success(productId ? "O'zgarishlar saqlandi" : "Mahsulot qo'shildi");
      onOpenChange(false);
    } catch (error) {
      /*
       * Awaited and caught here rather than handled in the hook: a refusal has
       * to land on the field it is about — a duplicate SKU under the SKU box —
       * and only this form knows which box that is. The hook stays silent on
       * failure for exactly this reason.
       */
      const refusal = splitRefusal(error);
      field.setServerErrors(refusal.fields);
      setMessage(refusal.message);
      if (refusal.message !== null) {
        toast.error(refusal.message);
      }
    }
  }

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      size="xl"
      title={productId ? "Mahsulotni tahrirlash" : "Yangi mahsulot qo'shish"}
      description={
        productId
          ? "O'zgarishlar saqlangach katalogda darhol ko'rinadi."
          : "Yulduzcha bilan belgilangan maydonlar to'ldirilishi shart."
      }
      submitLabel={productId ? "O'zgarishlarni saqlash" : "Mahsulot qo'shish"}
      onSubmit={save}
      busy={saving}
      error={message}
    >
      <Group title="Identifikatsiya">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="SKU" required error={field.errorFor("sku")}>
            <Input
              value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}
              onBlur={() => field.touch("sku")}
              className="font-mono"
              placeholder="DP-INJ-3126"
            />
          </FormField>
          <FormField
            label="Slug (URL)"
            required
            hint="Saytdagi manzil: /products/…"
            error={field.errorFor("slug")}
          >
            <Input
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              onBlur={() => field.touch("slug")}
              className="font-mono"
              placeholder="cat-fuel-injector-3126"
            />
          </FormField>
        </div>
      </Group>

      <Group title="Nomi">
        <div className="grid gap-4 sm:grid-cols-3">
          {(
            [
              ["uz", "O'zbekcha", "Caterpillar 3126 yoqilg'i injektori"],
              ["ru", "Ruscha", "Топливная форсунка Caterpillar 3126"],
              ["en", "Inglizcha", "Caterpillar 3126 fuel injector"],
            ] as const
          ).map(([lang, label, example]) => (
            <FormField
              key={lang}
              label={label}
              required
              error={field.errorFor("name." + lang)}
            >
              <Input
                value={form.name[lang]}
                onChange={(e) => setForm({ ...form, name: { ...form.name, [lang]: e.target.value } })}
                onBlur={() => field.touch("name." + lang)}
                placeholder={example}
              />
            </FormField>
          ))}
        </div>
      </Group>

      <Group title="Tavsif">
        <div className="grid gap-4 sm:grid-cols-3">
          {(
            [
              ["uz", "O'zbekcha"],
              ["ru", "Ruscha"],
              ["en", "Inglizcha"],
            ] as const
          ).map(([lang, label]) => (
            <FormField
              key={lang}
              label={label}
              required
              multiline
              error={field.errorFor("description." + lang)}
            >
              <Textarea
                value={form.description[lang]}
                onChange={(e) =>
                  setForm({ ...form, description: { ...form.description, [lang]: e.target.value } })
                }
                onBlur={() => field.touch("description." + lang)}
                rows={4}
                placeholder="Nima uchun ishlatiladi, qanday texnikaga mos keladi."
              />
            </FormField>
          ))}
        </div>
      </Group>

      <Group title="Narx va zaxira">
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField
            label="Narx"
            /* The suffix carries the unit, so the label does not have to. A
               label reading "Narx (so'm)" and a box reading "1 200 000" say the
               currency twice and align it nowhere. */
            suffix="so'm"
            hint={`Bo'sh qoldirilsa — "so'rov bo'yicha"`}
            error={field.errorFor("price")}
          >
            <Input
              inputMode="numeric"
              value={priceText}
              onChange={(e) => setPriceText(e.target.value)}
              onBlur={() => field.touch("price")}
              className="font-mono tabular-nums"
              placeholder="1 200 000"
            />
          </FormField>
          <FormField label="Qoldiq" required suffix="dona" error={field.errorFor("stock")}>
            <Input
              inputMode="numeric"
              min={0}
              value={String(form.stock)}
              onChange={(e) => setForm({ ...form, stock: Number(e.target.value) || 0 })}
              onBlur={() => field.touch("stock")}
              className="font-mono tabular-nums"
              placeholder="24"
            />
          </FormField>
          <FormField
            label="Minimal qoldiq"
            required
            suffix="dona"
            hint={'Shu chegarada "kam qoldi" deb belgilanadi'}
            error={field.errorFor("minStock")}
          >
            <Input
              inputMode="numeric"
              min={0}
              value={String(form.minStock)}
              onChange={(e) => setForm({ ...form, minStock: Number(e.target.value) || 0 })}
              onBlur={() => field.touch("minStock")}
              className="font-mono tabular-nums"
              placeholder="5"
            />
          </FormField>
        </div>
      </Group>

      <Group title="Tasnif">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Kategoriya" required error={field.errorFor("categoryId")}>
            {/* A combobox and not a select: the catalogue is a tree of parts
                families, and finding "Yoqilg'i tizimi" in it by scrolling is
                the slowest thing in this form. */}
            <Combobox
              options={categoryOptions}
              value={form.categoryId}
              onChange={(categoryId) => setForm({ ...form, categoryId })}
              onClose={() => field.touch("categoryId")}
              placeholder="Kategoriyani tanlang"
              searchPlaceholder="Kategoriya nomi"
            />
          </FormField>
          <FormField label="Brend" required error={field.errorFor("brandId")}>
            <Combobox
              options={brandOptions}
              value={form.brandId}
              onChange={(brandId) => setForm({ ...form, brandId })}
              onClose={() => field.touch("brandId")}
              placeholder="Brendni tanlang"
              searchPlaceholder="Brend nomi"
            />
          </FormField>
        </div>

        {/* The label names the field; how to fill it is the hint's job. */}
        <FormField
          label="OEM raqamlar"
          hint="Har biri yangi qatorda"
          multiline
          error={field.errorFor("oemNumbers")}
        >
          <Textarea
            value={oem}
            onChange={(e) => setOem(e.target.value)}
            onBlur={() => field.touch("oemNumbers")}
            rows={3}
            className="font-mono"
            placeholder={"10R-7225\n387-9427"}
          />
        </FormField>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="Mos texnika"
            hint="Har biri yangi qatorda"
            multiline
            error={field.errorFor("compatibleModels")}
          >
            <Textarea
              value={models}
              onChange={(e) => setModels(e.target.value)}
              onBlur={() => field.touch("compatibleModels")}
              rows={3}
              placeholder={"Caterpillar 3126\nCaterpillar C7"}
            />
          </FormField>

          <FormField
            label="Rasm yorliqlari"
            hint="Har biri yangi qatorda"
            multiline
            error={field.errorFor("imageLabels")}
          >
            <Textarea
              value={images}
              onChange={(e) => setImages(e.target.value)}
              onBlur={() => field.touch("imageLabels")}
              rows={3}
              placeholder={"Old ko'rinish\nO'rnatilgan holda"}
            />
          </FormField>
        </div>
      </Group>

      <CheckboxField
        label="Katalogda ko'rinsin"
        hint="Belgi olib tashlansa mahsulot saytdan yo'qoladi, lekin eski buyurtmalarda qoladi."
        checked={form.isActive}
        onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
      />
    </FormModal>
  );
}
