"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  useAdminBrands,
  useCreateBrand,
  useDeleteBrand,
  useUpdateBrand,
} from "@/hooks/admin/use-admin-brands";
import type { BrandRow } from "@/lib/api/brand-repository";
import { requestErrorMessage } from "@/lib/api/request-error";
import { slugify } from "@/lib/catalog-tree";
import { Button } from "@/components/ui/button";
import { ConfirmModal, FormModal } from "@/components/ui/form-modal";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { useFieldErrors } from "@/lib/forms/use-field-errors";
import { AI_LOCALES, brandWriteSchema, type AiLocale, type AiTranslateResult } from "@/lib/schemas";
import { AiBadge, AiTranslatePanel } from "@/components/admin/ai-translate-panel";

interface BrandFormValues {
  name: string;
  sourceLocale: AiLocale;
  translationUz: string;
  translationRu: string;
  translationEn: string;
  translationZh: string;
  slug: string;
  logoUrl: string;
}

const LOCALE_KEY = {
  uz: "translationUz",
  ru: "translationRu",
  en: "translationEn",
  zh: "translationZh",
} as const;

function emptyValues(): BrandFormValues {
  return {
    name: "",
    sourceLocale: "uz",
    translationUz: "",
    translationRu: "",
    translationEn: "",
    translationZh: "",
    slug: "",
    logoUrl: "",
  };
}

function toWriteInput(form: BrandFormValues) {
  const translation = (value: string) => (value.trim() ? { name: value } : undefined);
  return {
    slug: form.slug,
    name: form.name,
    logoUrl: form.logoUrl.trim() || null,
    sourceLocale: form.sourceLocale,
    translationUz: translation(form.translationUz),
    translationRu: translation(form.translationRu),
    translationEn: translation(form.translationEn),
    translationZh: translation(form.translationZh),
  };
}

function BrandForm({
  open,
  onOpenChange,
  title,
  values: initial,
  initialTranslationStatus,
  submitLabel,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  values: BrandFormValues;
  /** The brand's translationStatus as last saved — absent for "add". */
  initialTranslationStatus?: "PENDING" | "COMPLETE" | "FAILED" | null;
  submitLabel: string;
  onSubmit: (values: BrandFormValues) => Promise<string | null>;
}) {
  const [form, setForm] = useState(initial);
  const [slugEdited, setSlugEdited] = useState(initial.slug.length > 0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [aiFilled, setAiFilled] = useState<Set<AiLocale>>(new Set());
  const [translationStatus, setTranslationStatus] = useState<"PENDING" | "COMPLETE" | "FAILED" | null>(
    initialTranslationStatus ?? null,
  );

  const field = useFieldErrors(brandWriteSchema, toWriteInput(form));

  function setLocaleName(locale: AiLocale, value: string) {
    setAiFilled((current) => {
      if (!current.has(locale)) return current;
      const next = new Set(current);
      next.delete(locale);
      return next;
    });
    setForm((current) => {
      const key = LOCALE_KEY[locale];
      const next = { ...current, [key]: value };
      if (locale === current.sourceLocale) {
        next.name = value;
        if (!slugEdited) next.slug = slugify(value);
      }
      return next;
    });
  }

  function applyAiResult(result: AiTranslateResult) {
    setTranslationStatus(result.status);
    setForm((current) => {
      const next = { ...current };
      const filled = new Set<AiLocale>();
      for (const locale of AI_LOCALES) {
        const value = result.locales[locale]?.name;
        if (value === undefined) continue;
        const key = LOCALE_KEY[locale];
        if (current[key] !== value) filled.add(locale);
        next[key] = value;
        if (locale === current.sourceLocale) next.name = value;
      }
      setAiFilled(filled);
      return next;
    });
  }

  async function submit() {
    if (!field.touchAll()) return;
    setBusy(true);
    const message = await onSubmit(form);
    setBusy(false);
    if (message) {
      setError(message);
      toast.error(message);
    }
  }

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={title}
      description="Brend nomi va logotipi. Slug nomdan avtomatik to'ldiriladi."
      submitLabel={submitLabel}
      onSubmit={submit}
      busy={busy}
      error={error}
    >
      <AiTranslatePanel
        entity="brands"
        sourceLocale={form.sourceLocale}
        onSourceLocaleChange={(locale) =>
          setForm((current) => ({ ...current, sourceLocale: locale, name: current[LOCALE_KEY[locale]] }))
        }
        getFields={() => ({ name: form[LOCALE_KEY[form.sourceLocale]] })}
        getExisting={() => {
          const existing: Partial<Record<AiLocale, { name: string }>> = {};
          for (const locale of AI_LOCALES) {
            if (locale === form.sourceLocale) continue;
            const value = form[LOCALE_KEY[locale]];
            if (value.trim()) existing[locale] = { name: value };
          }
          return existing;
        }}
        onResult={applyAiResult}
        translationStatus={translationStatus}
        disabled={busy}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label={`Nomi (${form.sourceLocale})`} required error={field.errorFor("name")}>
          <div className="flex items-center gap-2">
            <Input
              value={form[LOCALE_KEY[form.sourceLocale]]}
              onChange={(e) => setLocaleName(form.sourceLocale, e.target.value)}
              onBlur={() => field.touch("name")}
              placeholder="Cummins"
            />
            {aiFilled.has(form.sourceLocale) ? <AiBadge /> : null}
          </div>
        </FormField>
        <FormField
          label="Slug"
          required
          hint="Havolada ko'rinadi. Nomdan avtomatik, tahrirlash mumkin."
          error={field.errorFor("slug")}
        >
          <Input
            value={form.slug}
            onChange={(e) => {
              setSlugEdited(true);
              setForm({ ...form, slug: e.target.value });
            }}
            onBlur={() => field.touch("slug")}
            className="font-mono"
            placeholder="cummins"
          />
        </FormField>
        <FormField label="Logotip URL" error={field.errorFor("logoUrl")}>
          <Input
            value={form.logoUrl}
            onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
            placeholder="https://..."
          />
        </FormField>
      </div>

      <div className="space-y-3">
        <h3 className="type-eyebrow border-b border-border pb-2 text-muted">
          Boshqa tillar {"(AI to'ldiradi, kerak bo'lsa tahrirlang)"}
        </h3>
        <div className="grid gap-4 sm:grid-cols-3">
          {AI_LOCALES.filter((locale) => locale !== form.sourceLocale).map((locale) => (
            <FormField key={locale} label={`Nomi (${locale})`}>
              <div className="flex items-center gap-2">
                <Input value={form[LOCALE_KEY[locale]]} onChange={(e) => setLocaleName(locale, e.target.value)} />
                {aiFilled.has(locale) ? <AiBadge /> : null}
              </div>
            </FormField>
          ))}
        </div>
      </div>
    </FormModal>
  );
}

export function BrandManager({
  initialData,
  canDelete,
}: {
  initialData?: BrandRow[];
  canDelete: boolean;
}) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<BrandRow | null>(null);
  const [deleting, setDeleting] = useState<BrandRow | null>(null);

  const list = useAdminBrands(initialData);

  function close() {
    setCreating(false);
    setEditing(null);
    setDeleting(null);
  }

  const createBrand = useCreateBrand(close);
  const updateBrand = useUpdateBrand(close);
  const removeBrand = useDeleteBrand(close);

  async function create(values: BrandFormValues): Promise<string | null> {
    try {
      await createBrand.mutateAsync(toWriteInput(values));
      return null;
    } catch (error) {
      return requestErrorMessage(error, "Saqlanmadi. Maydonlarni tekshiring.");
    }
  }

  async function update(id: string, values: BrandFormValues): Promise<string | null> {
    try {
      await updateBrand.mutateAsync({ id, values: toWriteInput(values) });
      return null;
    } catch (error) {
      return requestErrorMessage(error, "Saqlanmadi. Maydonlarni tekshiring.");
    }
  }

  const removeError = removeBrand.isError
    ? requestErrorMessage(removeBrand.error, "O'chirilmadi.")
    : null;

  if (list.isPending) {
    return <div aria-busy="true" className="panel h-56 animate-pulse" />;
  }

  if (list.isError) {
    return (
      <div className="panel">
        <p className="type-body text-muted">{requestErrorMessage(list.error, "Brendlar yuklanmadi.")}</p>
        <Button type="button" variant="outline" size="sm" className="mt-4" onClick={() => void list.refetch()}>
          Qayta urinish
        </Button>
      </div>
    );
  }

  const brands = list.data;

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted">{brands.length} ta brend</p>
        <Button type="button" size="sm" onClick={() => setCreating(true)}>
          Brend qo&apos;shish
        </Button>
      </div>

      {brands.length === 0 ? (
        <p className="panel mt-4 type-body text-muted">
          Hali brend qo&apos;shilmagan. Birinchi brendni qo&apos;shing.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-border panel">
          {brands.map((brand) => (
            <li key={brand.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3">
              <span className="text-sm font-semibold text-foreground">{brand.name}</span>
              <span className="font-mono text-xs text-muted">/{brand.slug}</span>
              {brand.translationStatus === "FAILED" ? (
                <span className="text-xs text-danger">Tarjima amalga oshmadi</span>
              ) : null}
              <span className="ml-auto flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setEditing(brand)}
                  className="text-xs text-muted underline-offset-4 transition-colors hover:text-foreground hover:underline"
                >
                  Tahrirlash
                </button>
                {canDelete ? (
                  <button
                    type="button"
                    onClick={() => {
                      removeBrand.reset();
                      setDeleting(brand);
                    }}
                    className="text-xs text-muted underline-offset-4 transition-colors hover:text-danger hover:underline"
                  >
                    O&apos;chirish
                  </button>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}

      {creating ? (
        <BrandForm
          key="create"
          open
          onOpenChange={() => setCreating(false)}
          title="Yangi brend"
          values={emptyValues()}
          submitLabel="Qo'shish"
          onSubmit={create}
        />
      ) : null}

      {editing !== null ? (
        <BrandForm
          key={"edit-" + editing.id}
          open
          onOpenChange={() => setEditing(null)}
          title={`${editing.name} — tahrirlash`}
          initialTranslationStatus={editing.translationStatus}
          values={(() => {
            const byLocale = {
              uz: editing.nameUz,
              ru: editing.nameRu,
              en: editing.nameEn,
              zh: editing.nameZh ?? "",
            };
            return {
              name: byLocale[editing.sourceLocale],
              sourceLocale: editing.sourceLocale,
              translationUz: editing.nameUz,
              translationRu: editing.nameRu,
              translationEn: editing.nameEn,
              translationZh: editing.nameZh ?? "",
              slug: editing.slug,
              logoUrl: editing.logoUrl ?? "",
            };
          })()}
          submitLabel="Saqlash"
          onSubmit={(values) => update(editing.id, values)}
        />
      ) : null}

      <ConfirmModal
        open={deleting !== null}
        onOpenChange={() => setDeleting(null)}
        title="Brend o'chirilsinmi?"
        subject={deleting === null ? "" : deleting.name + " · /" + deleting.slug}
        warning="Bu brendga bog'langan mahsulotlar bo'lsa, o'chirish rad etiladi."
        confirmLabel="Brendni o'chirish"
        busy={removeBrand.isPending}
        error={removeError}
        onConfirm={() => {
          if (deleting !== null) removeBrand.mutate(deleting.id);
        }}
      />
    </div>
  );
}
