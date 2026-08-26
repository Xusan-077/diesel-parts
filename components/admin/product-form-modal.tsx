"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Plus, Sparkles, X } from "lucide-react";
import {
  useAiFillProduct,
  useAiGenerateProductImage,
  useCreateProduct,
  useReplaceProductImage,
  useUpdateProduct,
} from "@/hooks/admin/use-admin-products";
import { OFFLINE_MESSAGE, refusalPayload, requestErrorMessage } from "@/lib/api/request-error";
import { useFieldErrors, type FieldErrors } from "@/lib/forms/use-field-errors";
import { productWriteSchema, type ProductWriteInput } from "@/lib/schemas";
import { CheckboxField } from "@/components/ui/checkbox";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { FormField } from "@/components/ui/form-field";
import { FormModal } from "@/components/ui/form-modal";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { ProductImageField } from "@/components/admin/product-image-field";

/** The field keys `aiWarnings` can name — mirrors `aiFillWarnableFields`. */
type AiWarnableField =
  | "sku"
  | "slug"
  | "name"
  | "description"
  | "categoryId"
  | "brandId"
  | "compatibleModels"
  | "specs";

/** Decodes the AI image endpoint's base64 payload into a `File` the picker already knows how to stage. */
function base64ToFile(base64: string, mimeType: string, filename: string): File {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new File([bytes], filename, { type: mimeType });
}

function extensionForMime(mimeType: string): string {
  if (mimeType.includes("png")) return "png";
  if (mimeType.includes("webp")) return "webp";
  return "jpg";
}

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

const EMPTY: ProductWriteInput & { imageUrl: string | null } = {
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
  isActive: true,
  imageUrl: null,
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
  initial?: ProductWriteInput & { imageUrl?: string | null };
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

  /*
   * "Qo'lda" vs "OEM raqam bilan (AI)" — only offered while creating; editing
   * an existing row always uses the plain form. `aiReady` is what actually
   * gates the OEM-input sub-view: once a fill has landed, both tabs show the
   * same editable fields, so switching back to "AI" after that is just
   * "keep reviewing", not "start over".
   */
  const [activeTab, setActiveTab] = useState<"manual" | "ai">("manual");
  const [aiOem, setAiOem] = useState("");
  const [aiCategory, setAiCategory] = useState("");
  const [aiReady, setAiReady] = useState(false);
  const [aiWarnings, setAiWarnings] = useState<ReadonlySet<AiWarnableField>>(new Set());
  const [aiMessage, setAiMessage] = useState<string | null>(null);

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
  const aiFill = useAiFillProduct();
  const aiImage = useAiGenerateProductImage();
  const saving = create.isPending || update.isPending || replaceImage.isPending;
  const aiBusy = aiFill.isPending || aiImage.isPending;
  const showAiInput = !productId && activeTab === "ai" && !aiReady;

  /**
   * Runs the OEM lookup, then the photo generation, then opens the same
   * fields the manual tab uses — pre-filled, still entirely editable, and
   * not sent anywhere until "Tasdiqlash va qo'shish" is pressed.
   */
  async function runAiFill() {
    setAiMessage(null);
    if (!aiOem.trim()) {
      return;
    }

    let result: Awaited<ReturnType<typeof aiFill.mutateAsync>>;
    try {
      result = await aiFill.mutateAsync({
        oemNumber: aiOem.trim(),
        category: aiCategory.trim() || undefined,
      });
    } catch (error) {
      setAiMessage(requestErrorMessage(error, "AI orqali ma'lumot topilmadi."));
      return;
    }

    setForm((current) => ({
      ...current,
      sku: result.sku,
      slug: result.slug,
      name: result.name,
      description: result.description,
      categoryId: result.categoryId ?? current.categoryId,
      brandId: result.brandId ?? current.brandId,
      specs: result.specs,
      isActive: true,
    }));
    setOem(listToLines(result.oemNumbers));
    setModels(listToLines(result.compatibleModels));
    setPriceText("");
    setAiWarnings(new Set(result.warnings));
    setAiReady(true);

    try {
      const image = await aiImage.mutateAsync({
        productName: result.name.uz || result.name.en || result.sku,
        oemNumber: aiOem.trim(),
      });
      const filename = (result.slug || "mahsulot") + "." + extensionForMime(image.mimeType);
      setImageFile(base64ToFile(image.base64, image.mimeType, filename));
    } catch (error) {
      toast.error(requestErrorMessage(error, "Rasm generatsiya qilinmadi — rasmni qo'lda yuklashingiz mumkin."));
    }
  }

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

  /** AI-sourced data can't quietly become "price on request" — the director has to type a number. */
  const aiPriceMissing = aiReady && priceText.trim() === "";
  /** A row with some but not all of its four fields filled — the schema will refuse it, so say why up front. */
  const specsIncomplete = form.specs.some((spec) => {
    const filled = [spec.label.uz, spec.label.ru, spec.label.en, spec.value].filter((v) => v.trim());
    return filled.length > 0 && filled.length < 4;
  });
  const isWarned = (fieldName: AiWarnableField) => aiReady && aiWarnings.has(fieldName);

  function warnedLabel(text: string, fieldName: AiWarnableField) {
    if (!isWarned(fieldName)) return text;
    return (
      <span className="inline-flex items-center gap-1">
        {text}
        <Icon
          icon={AlertTriangle}
          size="xs"
          className="text-warning"
          aria-label="AI taxminiy to'ldirdi — tekshiring"
        />
      </span>
    );
  }

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
      submitLabel={
        productId ? "O'zgarishlarni saqlash" : activeTab === "ai" ? "Tasdiqlash va qo'shish" : "Mahsulot qo'shish"
      }
      onSubmit={save}
      busy={saving}
      submitDisabled={showAiInput || aiPriceMissing || specsIncomplete}
      error={message}
    >
      {productId ? null : (
        /* Segmented control — same treatment as the catalogue page's sort chips. */
        <nav
          aria-label="To'ldirish usuli"
          className="flex items-center gap-1 rounded-md border border-border bg-surface-muted p-1"
        >
          {(
            [
              ["manual", "Qo'lda to'ldirish"],
              ["ai", "OEM raqam bilan (AI)"],
            ] as const
          ).map(([tab, label]) => (
            <button
              key={tab}
              type="button"
              aria-current={activeTab === tab ? "true" : undefined}
              onClick={() => setActiveTab(tab)}
              className={
                "inline-flex h-8 flex-1 items-center justify-center gap-2 rounded-sm px-3 text-xs transition-colors " +
                (activeTab === tab
                  ? "border border-border bg-surface font-medium text-foreground shadow-xs"
                  : "border border-transparent text-muted hover:bg-surface-hover hover:text-foreground")
              }
            >
              {tab === "ai" ? <Icon icon={Sparkles} size="xs" /> : null}
              {label}
            </button>
          ))}
        </nav>
      )}

      {showAiInput ? (
        <section className="space-y-4">
          <p className="text-sm text-muted">
            {
              "OEM raqamini kiriting — AI internetdan qidirib, mahsulot nomi, tavsifi, mos texnika va xususiyatlarini taxmin qiladi. Natijani ko'rib chiqib, kerak bo'lsa tuzatib, so'ng qo'shishingiz mumkin."
            }
          </p>

          <FormField label="OEM raqami" required hint="Ishlab chiqaruvchining original raqami">
            <Input
              value={aiOem}
              onChange={(e) => setAiOem(e.target.value)}
              className="font-mono"
              placeholder="10R-7225"
              disabled={aiBusy}
            />
          </FormField>

          <FormField label="Kategoriya (ixtiyoriy)" hint="AI taxminini aniqlashtirish uchun">
            <Input
              value={aiCategory}
              onChange={(e) => setAiCategory(e.target.value)}
              placeholder="Yoqilg'i tizimi"
              disabled={aiBusy}
            />
          </FormField>

          <div aria-live="polite" className="empty:hidden">
            {aiMessage ? (
              <p
                role="alert"
                className="flex items-start gap-2 rounded-md border border-danger bg-danger-surface px-3 py-2 text-sm text-danger"
              >
                <Icon icon={AlertTriangle} className="mt-1 shrink-0" />
                <span>{aiMessage}</span>
              </p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => void runAiFill()}
            disabled={aiBusy || !aiOem.trim()}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-accent-edge bg-accent px-4 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover disabled:pointer-events-none disabled:opacity-50"
          >
            {aiBusy ? (
              <>
                <Spinner />
                {aiFill.isPending ? "Qidirilmoqda…" : "Rasm yaratilmoqda…"}
              </>
            ) : (
              <>
                <Icon icon={Sparkles} size="sm" />
                Generatsiya qilish
              </>
            )}
          </button>
        </section>
      ) : (
        <>
          {aiReady ? (
            <p className="flex items-start gap-2 rounded-md border border-border bg-surface-muted px-3 py-2 text-sm text-muted">
              <Icon icon={Sparkles} className="mt-1 shrink-0 text-accent" />
              <span>
                {
                  "AI orqali to'ldirildi — sariq belgili maydonlar taxminiy, tekshirib tuzating. Narx va qoldiqni to'ldirish majburiy."
                }
              </span>
            </p>
          ) : null}

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
          <FormField label={warnedLabel("SKU", "sku")} required error={field.errorFor("sku")}>
            <Input
              value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}
              onBlur={() => field.touch("sku")}
              className="font-mono"
              placeholder="DP-INJ-3126"
            />
          </FormField>
          <FormField
            label={warnedLabel("Slug (URL)", "slug")}
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

      <Group title={warnedLabel("Nomi", "name")}>
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

      <Group title={warnedLabel("Tavsif", "description")}>
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
            required={aiReady}
            /* The suffix carries the unit, so the label does not have to. A
               label reading "Narx (so'm)" and a box reading "1 200 000" say the
               currency twice and align it nowhere. */
            suffix="so'm"
            hint={aiReady ? "AI orqali to'ldirilganda narx kiritish majburiy" : `Bo'sh qoldirilsa — "so'rov bo'yicha"`}
            error={field.errorFor("price") ?? (aiPriceMissing ? "Narxni kiriting" : null)}
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
          <FormField label={warnedLabel("Kategoriya", "categoryId")} required error={field.errorFor("categoryId")}>
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
          <FormField label={warnedLabel("Brend", "brandId")} required error={field.errorFor("brandId")}>
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
          label={warnedLabel("Mos texnika", "compatibleModels")}
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

      <Group title={warnedLabel("Texnik xususiyatlari", "specs")}>
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
        </>
      )}
    </FormModal>
  );
}
