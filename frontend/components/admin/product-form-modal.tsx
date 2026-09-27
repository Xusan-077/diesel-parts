"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Plus, Sparkles, X } from "lucide-react";
import {
  useCreateProduct,
  useReplaceProductImage,
  useUpdateProduct,
} from "@/hooks/admin/use-admin-products";
import { useAiTranslate } from "@/hooks/admin/use-ai-translate";
import { OFFLINE_MESSAGE, refusalPayload } from "@/lib/api/request-error";
import { useFieldErrors, type FieldErrors } from "@/lib/forms/use-field-errors";
import { AI_LOCALES, productWriteSchema, type AiLocale, type AiTranslateResult, type ProductWriteInput } from "@/lib/schemas";
import { AiBadge, AiTranslatePanel } from "@/components/admin/ai-translate-panel";
import { CheckboxField } from "@/components/ui/checkbox";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { FormField } from "@/components/ui/form-field";
import { FormModal } from "@/components/ui/form-modal";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ProductImageField } from "@/components/admin/product-image-field";

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

const EMPTY: ProductWriteInput & { imageUrl: string | null; translationStatus?: null } = {
  sku: "",
  slug: "",
  oemNumbers: [],
  name: { uz: "", ru: "", en: "" },
  description: { uz: "", ru: "", en: "" },
  sourceLocale: "uz",
  price: null,
  stock: 0,
  minStock: 5,
  categoryId: "",
  brandId: "",
  compatibleModels: [],
  specs: [],
  isActive: true,
  imageUrl: null,
  translationStatus: null,
};

const LOCALE_LABEL: Record<AiLocale, string> = {
  uz: "O'zbekcha",
  ru: "Ruscha",
  en: "Inglizcha",
  zh: "Xitoycha",
};

/** Section heading inside the modal — the same eyebrow the pages use. */
function Group({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
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
  initial?: ProductWriteInput & {
    imageUrl?: string | null;
    translationStatus?: "PENDING" | "COMPLETE" | "FAILED" | null;
  };
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
  const [priceText, setPriceText] = useState(start.price === null ? "" : String(start.price));
  const [message, setMessage] = useState<string | null>(null);
  /** Staged locally until save; never sent unless the director actually picked one. */
  const [imageFile, setImageFile] = useState<File | null>(null);
  /** Locales whose name/description on screen still ARE the AI's own output,
   *  untouched since the last "AI bilan tekshirish" run — cleared the moment
   *  the director edits that locale's boxes themselves. */
  const [aiFilled, setAiFilled] = useState<Set<AiLocale>>(new Set());
  const [translationStatus, setTranslationStatus] = useState(start.translationStatus ?? null);

  function clearAiBadge(locale: AiLocale) {
    setAiFilled((current) => {
      if (!current.has(locale)) return current;
      const next = new Set(current);
      next.delete(locale);
      return next;
    });
  }

  function applyAiResult(result: AiTranslateResult) {
    setTranslationStatus(result.status);
    setForm((current) => {
      const filled = new Set<AiLocale>();
      const name = { ...current.name };
      const description = { ...current.description };
      for (const locale of AI_LOCALES) {
        const value = result.locales[locale];
        if (value === undefined) continue;
        if (name[locale] !== value.name || description[locale] !== (value.description ?? "")) {
          filled.add(locale);
        }
        name[locale] = value.name;
        description[locale] = value.description ?? description[locale] ?? "";
      }
      setAiFilled(filled);
      return { ...current, name, description };
    });
  }

  /** "Qayta tarjima" — forces a re-translate of one already-filled locale,
   *  called from that locale's own field group rather than the main panel. */
  const retranslate = useAiTranslate("products");
  async function retranslateLocale(locale: AiLocale) {
    const result = await retranslate.mutateAsync({
      sourceLocale: form.sourceLocale ?? "uz",
      fields: {
        name: form.name[form.sourceLocale ?? "uz"] ?? "",
        description: form.description[form.sourceLocale ?? "uz"] || undefined,
      },
      existing: Object.fromEntries(
        AI_LOCALES.filter((l) => l !== (form.sourceLocale ?? "uz") && l !== locale).map((l) => [
          l,
          { name: form.name[l] ?? "", description: form.description[l] || undefined },
        ]),
      ),
      force: true,
      forceLocales: [locale],
    });
    applyAiResult(result);
  }

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
  const replaceImage = useReplaceProductImage();
  const saving = create.isPending || update.isPending || replaceImage.isPending;

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
    // Empty means "price not set", which the catalog renders as a contact
    // action. Coercing it to 0 would advertise a free part.
    price: priceText.trim() === "" ? null : Number(priceText),
    // A row left at "+ Xususiyat qo'shish" and never touched is not a spec,
    // it is a still-open blank — dropped here so it never blocks submission
    // the way a half-filled one legitimately should.
    specs: form.specs.filter(
      (spec) => spec.value.trim() || spec.label.uz.trim() || spec.label.ru.trim() || spec.label.en.trim(),
    ),
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

  /** A row with some but not all of its four fields filled — the schema will refuse it, so say why up front. */
  const specsIncomplete = form.specs.some((spec) => {
    const filled = [spec.label.uz, spec.label.ru, spec.label.en, spec.value].filter((v) => v.trim());
    return filled.length > 0 && filled.length < 4;
  });
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
      if (productId) {
        await update.mutateAsync({ id: productId, values: payload });
        // A separate request, sent only when a new photo was actually picked:
        // most saves touch none of the twenty fields' worth of text and would
        // otherwise re-upload a photo that never changed.
        if (imageFile) {
          await replaceImage.mutateAsync({ id: productId, image: imageFile });
        }
      } else {
        await create.mutateAsync({ values: payload, image: imageFile });
      }

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
      submitDisabled={specsIncomplete}
      error={message}
    >
      <Group title="Rasm">
        <div className="max-w-64">
          <ProductImageField
            currentUrl={start.imageUrl ?? null}
            file={imageFile}
            onFileChange={setImageFile}
            disabled={saving}
          />
        </div>
      </Group>

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

      <Group title="Nomi va tavsif">
        <AiTranslatePanel
          entity="products"
          sourceLocale={form.sourceLocale ?? "uz"}
          onSourceLocaleChange={(locale) => setForm({ ...form, sourceLocale: locale })}
          getFields={() => ({
            name: form.name[form.sourceLocale ?? "uz"] ?? "",
            description: form.description[form.sourceLocale ?? "uz"] || undefined,
          })}
          getExisting={() => {
            const existing: Partial<Record<AiLocale, { name: string; description?: string }>> = {};
            for (const locale of AI_LOCALES) {
              if (locale === (form.sourceLocale ?? "uz")) continue;
              const name = form.name[locale];
              if (name && name.trim()) {
                existing[locale] = { name, description: form.description[locale] || undefined };
              }
            }
            return existing;
          }}
          onResult={applyAiResult}
          translationStatus={translationStatus}
          disabled={saving}
        />

        {translationStatus === "FAILED" ? (
          <p className="text-xs text-danger">
            Oxirgi saqlashda tarjima amalga oshmadi — faqat kiritilgan til saqlangan. Yuqoridagi
            tugma bilan qayta urining.
          </p>
        ) : null}

        <div className="space-y-1">
          <p className="type-eyebrow text-muted">Nomi</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {AI_LOCALES.map((lang) => (
              <FormField
                key={lang}
                label={
                  <span className="flex items-center gap-1">
                    {LOCALE_LABEL[lang]}
                    {aiFilled.has(lang) ? <AiBadge /> : null}
                  </span>
                }
                required={lang !== "zh"}
                error={field.errorFor("name." + lang)}
              >
                <div className="flex items-center gap-1">
                  <Input
                    value={form.name[lang] ?? ""}
                    onChange={(e) => {
                      clearAiBadge(lang);
                      setForm({ ...form, name: { ...form.name, [lang]: e.target.value } });
                    }}
                    onBlur={() => field.touch("name." + lang)}
                  />
                  {(form.name[lang] ?? "").trim() ? (
                    <button
                      type="button"
                      title="Qayta tarjima"
                      onClick={() => void retranslateLocale(lang)}
                      disabled={retranslate.isPending}
                      className="shrink-0 rounded-md p-1 text-muted hover:bg-surface-hover hover:text-foreground"
                    >
                      <Icon icon={Sparkles} size="xs" />
                    </button>
                  ) : null}
                </div>
              </FormField>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <p className="type-eyebrow text-muted">Tavsif</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {AI_LOCALES.map((lang) => (
              <FormField
                key={lang}
                label={
                  <span className="flex items-center gap-1">
                    {LOCALE_LABEL[lang]}
                    {aiFilled.has(lang) ? <AiBadge /> : null}
                  </span>
                }
                required={lang !== "zh"}
                multiline
                error={field.errorFor("description." + lang)}
              >
                <Textarea
                  value={form.description[lang] ?? ""}
                  onChange={(e) => {
                    clearAiBadge(lang);
                    setForm({ ...form, description: { ...form.description, [lang]: e.target.value } });
                  }}
                  onBlur={() => field.touch("description." + lang)}
                  rows={4}
                  placeholder="Nima uchun ishlatiladi, qanday texnikaga mos keladi."
                />
              </FormField>
            ))}
          </div>
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
      </Group>

      <Group title="Texnik xususiyatlari">
        <div className="space-y-3">
          {form.specs.map((spec, index) => (
            // Index is stable here: rows are only appended or removed, never
            // reordered, so React never confuses one row's inputs for another's.
            <div key={index} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_1fr_1fr_auto]">
              {(["uz", "ru", "en"] as const).map((lang) => (
                <Input
                  key={lang}
                  value={spec.label[lang]}
                  onChange={(e) => {
                    const specs = [...form.specs];
                    specs[index] = { ...spec, label: { ...spec.label, [lang]: e.target.value } };
                    setForm({ ...form, specs });
                  }}
                  placeholder={lang === "uz" ? "Diametri" : lang === "ru" ? "Диаметр" : "Diameter"}
                  className="text-sm"
                />
              ))}
              <Input
                value={spec.value}
                onChange={(e) => {
                  const specs = [...form.specs];
                  specs[index] = { ...spec, value: e.target.value };
                  setForm({ ...form, specs });
                }}
                placeholder="10 mm"
                className="text-sm"
              />
              <button
                type="button"
                onClick={() => setForm({ ...form, specs: form.specs.filter((_, i) => i !== index) })}
                aria-label="Xususiyatni o'chirish"
                className="inline-flex h-10 w-10 items-center justify-center rounded-md text-muted hover:bg-surface-hover hover:text-foreground"
              >
                <Icon icon={X} size="sm" />
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={() =>
              setForm({
                ...form,
                specs: [...form.specs, { label: { uz: "", ru: "", en: "" }, value: "" }],
              })
            }
            className="inline-flex items-center gap-2 text-sm text-accent-strong hover:underline"
          >
            <Icon icon={Plus} size="xs" />
            Xususiyat qo&apos;shish
          </button>

          {specsIncomplete ? (
            <p className="flex items-start gap-2 text-xs font-medium text-danger">
              <Icon icon={AlertTriangle} size="xs" className="mt-1 shrink-0" />
              {"Har bir xususiyat qatorida uchala til va qiymat to'ldirilishi kerak — yoki qatorni o'chiring."}
            </p>
          ) : null}
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
