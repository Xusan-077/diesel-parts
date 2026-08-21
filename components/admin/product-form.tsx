"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import axios from "axios";
import { toast } from "sonner";
import { OFFLINE_MESSAGE, refusalPayload } from "@/lib/api/request-error";
import { Button } from "@/components/ui/button";
import { CheckboxField } from "@/components/ui/checkbox";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ProductWriteInput } from "@/lib/schemas";

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
 * Unlike the rest of the panel this prints a field-level complaint when there is
 * no `_root` one, because a rejected product is usually one bad field out of
 * twenty and "check the fields" would leave the director hunting for it.
 */
function saveErrorMessage(error: unknown): string {
  const data = refusalPayload<{ errors?: Record<string, string[] | undefined> }>(error);

  if (!data) {
    return OFFLINE_MESSAGE;
  }

  const first = data.errors?._root?.[0] ?? Object.entries(data.errors ?? {})[0];

  return typeof first === "string"
    ? first
    : Array.isArray(first)
      ? first[0] + ": " + (first[1] as unknown as string[])?.[0]
      : "Saqlanmadi. Maydonlarni tekshiring.";
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

export function ProductForm({
  productId,
  initial,
  categories,
  brands,
}: {
  /** Absent when creating; the form then POSTs instead of PATCHing. */
  productId?: string;
  initial?: ProductWriteInput;
  categories: ReferenceOption[];
  brands: ReferenceOption[];
}) {
  const router = useRouter();
  const start = initial ?? EMPTY;

  const [form, setForm] = useState({
    ...start,
    categoryId: start.categoryId || categories[0]?.id || "",
    brandId: start.brandId || brands[0]?.id || "",
  });
  const [oem, setOem] = useState(listToLines(start.oemNumbers));
  const [models, setModels] = useState(listToLines(start.compatibleModels));
  const [images, setImages] = useState(listToLines(start.imageLabels));
  const [priceText, setPriceText] = useState(start.price === null ? "" : String(start.price));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);

    const payload: ProductWriteInput = {
      ...form,
      oemNumbers: linesToList(oem),
      compatibleModels: linesToList(models),
      imageLabels: linesToList(images),
      // Empty means "price not set", which the catalog renders as a contact
      // action. Coercing it to 0 would advertise a free part.
      price: priceText.trim() === "" ? null : Number(priceText),
    };

    try {
      await (productId
        ? axios.patch("/api/v1/products/" + productId, payload)
        : axios.post("/api/v1/products", payload));

      toast.success(productId ? "O'zgarishlar saqlandi" : "Mahsulot qo'shildi");
      router.push("/admin/director/products");
      router.refresh();
    } catch (error) {
      const message = saveErrorMessage(error);
      setError(message);
      toast.error(message);
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="mt-8 max-w-3xl space-y-8" noValidate>
      <section className="space-y-4">
        <h2 className="type-eyebrow text-muted">
          Identifikatsiya
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="SKU">
            <Input
              value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}
              className="font-mono"
              required
            />
          </FormField>
          <FormField label="Slug (URL)">
            <Input
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              className="font-mono"
              placeholder="cat-fuel-injector-3126"
              required
            />
          </FormField>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="type-eyebrow text-muted">
          Nomi
        </h2>
        {(["uz", "ru", "en"] as const).map((lang) => (
          <FormField key={lang} label={lang.toUpperCase()}>
            <Input
              value={form.name[lang]}
              onChange={(e) => setForm({ ...form, name: { ...form.name, [lang]: e.target.value } })}
              required
            />
          </FormField>
        ))}
      </section>

      <section className="space-y-4">
        <h2 className="type-eyebrow text-muted">
          Tavsif
        </h2>
        {(["uz", "ru", "en"] as const).map((lang) => (
          <FormField key={lang} label={lang.toUpperCase()}>
            <Textarea
              value={form.description[lang]}
              onChange={(e) =>
                setForm({ ...form, description: { ...form.description, [lang]: e.target.value } })
              }
              rows={3}
              required
            />
          </FormField>
        ))}
      </section>

      <section className="space-y-4">
        <h2 className="type-eyebrow text-muted">
          Narx va zaxira
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {/* No placeholder: the hint below already says what an empty box
              means, and saying it twice in two type sizes is not clearer. */}
          <FormField label="Narx (so'm)" hint={`Bo'sh qoldirilsa — "so'rov bo'yicha"`}>
            <Input
              inputMode="numeric"
              value={priceText}
              onChange={(e) => setPriceText(e.target.value)}
              className="font-mono tabular-nums"
            />
          </FormField>
          <FormField label="Qoldiq">
            <Input
              inputMode="numeric"
              value={String(form.stock)}
              onChange={(e) => setForm({ ...form, stock: Number(e.target.value) || 0 })}
              className="font-mono tabular-nums"
            />
          </FormField>
          <FormField label="Minimal qoldiq" hint={'Shu chegarada "kam qoldi" deb belgilanadi'}>
            <Input
              inputMode="numeric"
              value={String(form.minStock)}
              onChange={(e) => setForm({ ...form, minStock: Number(e.target.value) || 0 })}
              className="font-mono tabular-nums"
            />
          </FormField>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="type-eyebrow text-muted">
          Tasnif
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Kategoriya">
            <Select
              value={form.categoryId}
              onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
            >
              {categories.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Brend">
            <Select
              value={form.brandId}
              onChange={(e) => setForm({ ...form, brandId: e.target.value })}
            >
              {brands.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </Select>
          </FormField>
        </div>

        {/* The label names the field; how to fill it is the hint's job. */}
        <FormField label="OEM raqamlar" hint="Har biri yangi qatorda">
          <Textarea
            value={oem}
            onChange={(e) => setOem(e.target.value)}
            rows={3}
            className="font-mono"
          />
        </FormField>

        <FormField label="Mos texnika" hint="Har biri yangi qatorda">
          <Textarea value={models} onChange={(e) => setModels(e.target.value)} rows={3} />
        </FormField>

        <FormField label="Rasm yorliqlari" hint="Har biri yangi qatorda">
          <Textarea value={images} onChange={(e) => setImages(e.target.value)} rows={2} />
        </FormField>
      </section>

      <CheckboxField
        label="Katalogda ko'rinsin"
        hint="Belgi olib tashlansa mahsulot saytdan yo'qoladi, lekin eski buyurtmalarda qoladi."
        checked={form.isActive}
        onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
      />

      <div aria-live="polite" className="min-h-5">
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? "Saqlanmoqda…" : productId ? "O'zgarishlarni saqlash" : "Mahsulot qo'shish"}
        </Button>
        <Link
          href="/admin/director/products"
          className="text-sm text-muted transition-colors hover:text-foreground"
        >
          Bekor qilish
        </Link>
      </div>
    </form>
  );
}
