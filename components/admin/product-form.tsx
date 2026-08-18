"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

const FIELD = "border-l-2 border-border pl-4 transition-colors focus-within:border-accent-strong";

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
      const response = await fetch(
        productId ? "/api/v1/products/" + productId : "/api/v1/products",
        {
          method: productId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      const data = (await response.json()) as {
        success: boolean;
        errors?: Record<string, string[] | undefined>;
      };

      if (!data.success) {
        const first = data.errors?._root?.[0] ?? Object.entries(data.errors ?? {})[0];
        setError(
          typeof first === "string"
            ? first
            : Array.isArray(first)
              ? first[0] + ": " + (first[1] as unknown as string[])?.[0]
              : "Saqlanmadi. Maydonlarni tekshiring.",
        );
        setSaving(false);
        return;
      }

      router.push("/admin/director/products");
      router.refresh();
    } catch {
      setError("Ulanmadi. Qayta urinib ko'ring.");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="mt-8 max-w-3xl space-y-10" noValidate>
      <section className="space-y-5">
        <h2 className="font-mono text-[0.6875rem] uppercase tracking-[0.15em] text-muted">
          Identifikatsiya
        </h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className={FIELD}>
            <Label htmlFor="sku">SKU</Label>
            <Input
              id="sku"
              value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}
              className="mt-1.5 border-0 px-0 font-mono focus:border-0"
              required
            />
          </div>
          <div className={FIELD}>
            <Label htmlFor="slug">Slug (URL)</Label>
            <Input
              id="slug"
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              className="mt-1.5 border-0 px-0 font-mono focus:border-0"
              placeholder="cat-fuel-injector-3126"
              required
            />
          </div>
        </div>
      </section>

      <section className="space-y-5">
        <h2 className="font-mono text-[0.6875rem] uppercase tracking-[0.15em] text-muted">
          Nomi
        </h2>
        {(["uz", "ru", "en"] as const).map((lang) => (
          <div key={lang} className={FIELD}>
            <Label htmlFor={"name-" + lang}>{lang.toUpperCase()}</Label>
            <Input
              id={"name-" + lang}
              value={form.name[lang]}
              onChange={(e) => setForm({ ...form, name: { ...form.name, [lang]: e.target.value } })}
              className="mt-1.5 border-0 px-0 focus:border-0"
              required
            />
          </div>
        ))}
      </section>

      <section className="space-y-5">
        <h2 className="font-mono text-[0.6875rem] uppercase tracking-[0.15em] text-muted">
          Tavsif
        </h2>
        {(["uz", "ru", "en"] as const).map((lang) => (
          <div key={lang} className={FIELD}>
            <Label htmlFor={"desc-" + lang}>{lang.toUpperCase()}</Label>
            <Textarea
              id={"desc-" + lang}
              value={form.description[lang]}
              onChange={(e) =>
                setForm({ ...form, description: { ...form.description, [lang]: e.target.value } })
              }
              rows={2}
              className="mt-1.5 border-0 px-0 focus:border-0"
              required
            />
          </div>
        ))}
      </section>

      <section className="space-y-5">
        <h2 className="font-mono text-[0.6875rem] uppercase tracking-[0.15em] text-muted">
          Narx va zaxira
        </h2>
        <div className="grid gap-5 sm:grid-cols-3">
          <div className={FIELD}>
            <Label htmlFor="price">Narx (so&apos;m)</Label>
            <Input
              id="price"
              inputMode="numeric"
              value={priceText}
              onChange={(e) => setPriceText(e.target.value)}
              className="mt-1.5 border-0 px-0 font-mono tabular-nums focus:border-0"
              placeholder="belgilanmagan"
            />
            <p className="mt-1 text-xs text-muted">Bo&apos;sh qoldirilsa — &quot;so&apos;rov bo&apos;yicha&quot;</p>
          </div>
          <div className={FIELD}>
            <Label htmlFor="stock">Qoldiq</Label>
            <Input
              id="stock"
              inputMode="numeric"
              value={String(form.stock)}
              onChange={(e) => setForm({ ...form, stock: Number(e.target.value) || 0 })}
              className="mt-1.5 border-0 px-0 font-mono tabular-nums focus:border-0"
            />
          </div>
          <div className={FIELD}>
            <Label htmlFor="minStock">Minimal qoldiq</Label>
            <Input
              id="minStock"
              inputMode="numeric"
              value={String(form.minStock)}
              onChange={(e) => setForm({ ...form, minStock: Number(e.target.value) || 0 })}
              className="mt-1.5 border-0 px-0 font-mono tabular-nums focus:border-0"
            />
            <p className="mt-1 text-xs text-muted">Shu chegarada &quot;kam qoldi&quot; deb belgilanadi</p>
          </div>
        </div>
      </section>

      <section className="space-y-5">
        <h2 className="font-mono text-[0.6875rem] uppercase tracking-[0.15em] text-muted">
          Tasnif
        </h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className={FIELD}>
            <Label htmlFor="categoryId">Kategoriya</Label>
            <select
              id="categoryId"
              value={form.categoryId}
              onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              className="mt-1.5 h-10 w-full bg-transparent text-sm text-foreground"
            >
              {categories.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className={FIELD}>
            <Label htmlFor="brandId">Brend</Label>
            <select
              id="brandId"
              value={form.brandId}
              onChange={(e) => setForm({ ...form, brandId: e.target.value })}
              className="mt-1.5 h-10 w-full bg-transparent text-sm text-foreground"
            >
              {brands.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className={FIELD}>
          <Label htmlFor="oem">OEM raqamlar — har biri yangi qatorda</Label>
          <Textarea
            id="oem"
            value={oem}
            onChange={(e) => setOem(e.target.value)}
            rows={3}
            className="mt-1.5 border-0 px-0 font-mono focus:border-0"
          />
        </div>

        <div className={FIELD}>
          <Label htmlFor="models">Mos texnika — har biri yangi qatorda</Label>
          <Textarea
            id="models"
            value={models}
            onChange={(e) => setModels(e.target.value)}
            rows={3}
            className="mt-1.5 border-0 px-0 focus:border-0"
          />
        </div>

        <div className={FIELD}>
          <Label htmlFor="images">Rasm yorliqlari — har biri yangi qatorda</Label>
          <Textarea
            id="images"
            value={images}
            onChange={(e) => setImages(e.target.value)}
            rows={2}
            className="mt-1.5 border-0 px-0 focus:border-0"
          />
        </div>
      </section>

      <section className={FIELD}>
        <label className="flex items-center gap-3 text-sm text-foreground">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            className="h-4 w-4 accent-[var(--accent)]"
          />
          Katalogda ko&apos;rinsin
        </label>
        <p className="mt-1 text-xs text-muted">
          Belgi olib tashlansa mahsulot saytdan yo&apos;qoladi, lekin eski buyurtmalarda qoladi.
        </p>
      </section>

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
