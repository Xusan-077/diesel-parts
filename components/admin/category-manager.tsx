"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  useAdminCategories,
  useCreateCategory,
  useDeleteCategory,
  useUpdateCategory,
} from "@/hooks/admin/use-admin-categories";
import type { CatalogAdminRow } from "@/lib/api/catalog-repository";
import { requestErrorMessage } from "@/lib/api/request-error";
import { slugify } from "@/lib/catalog-tree";
import { CATALOG_ICON_KEYS, type CatalogIconKey } from "@/lib/data/catalog-menu";
import { CatalogIcon } from "@/components/catalog/catalog-icon";
import { Button } from "@/components/ui/button";
import { ConfirmModal, FormModal } from "@/components/ui/form-modal";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useFieldErrors } from "@/lib/forms/use-field-errors";
import { categoryWriteSchema } from "@/lib/schemas";
import type { LocalizedText } from "@/lib/types";

export interface CategoryView {
  id: string;
  slug: string;
  name: LocalizedText;
  type: string;
  order: number;
  icon: CatalogIconKey | null;
  parentId: string | null;
  /** Products hanging directly off this category. */
  productCount: number;
  childCount: number;
}

interface CategoryFormValues {
  name: LocalizedText;
  slug: string;
  type: string;
  parentId: string | null;
  order: number;
  icon: CatalogIconKey | null;
}

const TYPES_LIST_ID = "category-type-suggestions";

function emptyValues(parentId: string | null, type: string): CategoryFormValues {
  return {
    name: { uz: "", ru: "", en: "" },
    slug: "",
    type,
    parentId,
    order: 0,
    icon: null,
  };
}

/**
 * The one form behind both "add" and "edit".
 *
 * Two copies of six fields would drift the moment one of them gained a rule the
 * other did not — the panel has been bitten by that before (see PageHeader).
 */
function CategoryForm({
  open,
  onOpenChange,
  title,
  values: initial,
  roots,
  types,
  submitLabel,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  values: CategoryFormValues;
  /** Categories that may be chosen as a parent — top-level ones, minus self. */
  roots: CategoryView[];
  types: string[];
  submitLabel: string;
  onSubmit: (values: CategoryFormValues) => Promise<string | null>;
}) {
  const [form, setForm] = useState(initial);
  /*
   * The slug follows the Uzbek name until someone types a slug of their own.
   * After that it is theirs: silently rewriting a hand-picked slug on the next
   * keystroke in the name field would change a URL the director had chosen.
   */
  const [slugEdited, setSlugEdited] = useState(initial.slug.length > 0);
  const [typeEdited, setTypeEdited] = useState(initial.type.length > 0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const field = useFieldErrors(categoryWriteSchema, form);

  function setNameUz(value: string) {
    setForm((current) => ({
      ...current,
      name: { ...current.name, uz: value },
      slug: slugEdited ? current.slug : slugify(value),
    }));
  }

  function setParent(parentId: string | null) {
    const parent = roots.find((root) => root.id === parentId);
    setForm((current) => ({
      ...current,
      parentId,
      // A column and everything in it share one part family, so the child
      // inherits it rather than asking the director to retype it.
      type: typeEdited || parent === undefined ? current.type : parent.type,
    }));
  }

  async function submit() {
    if (!field.touchAll()) {
      return;
    }

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
      description="Menyudagi o'rni va nomi. Slug nomdan avtomatik to'ldiriladi."
      submitLabel={submitLabel}
      onSubmit={submit}
      busy={busy}
      error={error}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Nomi (uz)" required error={field.errorFor("name.uz")}>
          <Input
            value={form.name.uz}
            onChange={(e) => setNameUz(e.target.value)}
            onBlur={() => field.touch("name.uz")}
            placeholder="Tormoz tizimi"
          />
        </FormField>
        <FormField label="Nomi (ru)" required error={field.errorFor("name.ru")}>
          <Input
            value={form.name.ru}
            onChange={(e) => setForm({ ...form, name: { ...form.name, ru: e.target.value } })}
            onBlur={() => field.touch("name.ru")}
            placeholder="Тормозная система"
          />
        </FormField>
        <FormField label="Nomi (en)" required error={field.errorFor("name.en")}>
          <Input
            value={form.name.en}
            onChange={(e) => setForm({ ...form, name: { ...form.name, en: e.target.value } })}
            onBlur={() => field.touch("name.en")}
            placeholder="Brake system"
          />
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
            placeholder="tormoz-tizimi"
          />
        </FormField>
        <FormField
          label="Ustun"
          hint="Bo'sh qoldirilsa — menyuda alohida ustun bo'ladi."
          error={field.errorFor("parentId")}
        >
          <Select
            value={form.parentId ?? ""}
            onChange={(e) => setParent(e.target.value || null)}
            onBlur={() => field.touch("parentId")}
          >
            <option value="">— Yuqori bosqich (ustun) —</option>
            {roots.map((root) => (
              <option key={root.id} value={root.id}>
                {root.name.uz}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField
          label="Toifa"
          required
          hint="Qism oilasi: engine, brakes, filters. Ustun bilan bir xil."
          error={field.errorFor("type")}
        >
          <Input
            value={form.type}
            onChange={(e) => {
              setTypeEdited(true);
              setForm({ ...form, type: e.target.value });
            }}
            onBlur={() => field.touch("type")}
            className="font-mono"
            list={TYPES_LIST_ID}
            placeholder="engine"
          />
        </FormField>
        <FormField
          label="Tartib"
          hint="Kichik raqam oldinda turadi."
          error={field.errorFor("order")}
        >
          <Input
            inputMode="numeric"
            min={0}
            value={String(form.order)}
            onChange={(e) => setForm({ ...form, order: Number(e.target.value) || 0 })}
            onBlur={() => field.touch("order")}
            className="font-mono tabular-nums"
            placeholder="0"
          />
        </FormField>
        <FormField label="Belgi" hint="Menyuda nom yonida chiziladi.">
          <Select
            value={form.icon ?? ""}
            onChange={(e) =>
              setForm({ ...form, icon: (e.target.value || null) as CatalogIconKey | null })
            }
          >
            <option value="">— yo&apos;q —</option>
            {CATALOG_ICON_KEYS.map((key) => (
              <option key={key} value={key}>
                {key}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      <datalist id={TYPES_LIST_ID}>
        {types.map((type) => (
          <option key={type} value={type} />
        ))}
      </datalist>
    </FormModal>
  );
}

/**
 * What a delete would take with it, said before it is asked for.
 *
 * The API refuses a category that still holds children or products, and this
 * says so in place rather than letting the director click into a refusal: the
 * counts are already on screen, so the answer is knowable without a round trip.
 *
 * Returns `null` when nothing is in the way, which is also how the dialog
 * decides whether its confirm button is live.
 */
function deletionBlockage(category: CategoryView): string | null {
  const parts: string[] = [];

  if (category.childCount > 0) {
    parts.push(`ichida ${category.childCount} ta pastki bo'lim bor`);
  }
  if (category.productCount > 0) {
    parts.push(`${category.productCount} ta mahsulot bog'langan`);
  }

  if (parts.length === 0) {
    return null;
  }

  // Sentence-cased here rather than in the template, so the two clauses can be
  // joined in either order without one of them starting mid-sentence.
  const joined = parts.join(", ");
  return joined[0].toLocaleUpperCase() + joined.slice(1) + ". Avval ularni ko'chiring.";
}

function CategoryRow({
  category,
  child,
  onEdit,
  onAddChild,
  onAskDelete,
}: {
  category: CategoryView;
  child: boolean;
  onEdit: () => void;
  onAddChild?: () => void;
  onAskDelete: () => void;
}) {
  return (
    <div className={child ? "py-2 pl-6" : "py-3"}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        {category.icon ? (
          <span className="self-center text-accent-strong">
            <CatalogIcon icon={category.icon} />
          </span>
        ) : null}
        <span className={child ? "text-sm text-foreground" : "text-sm font-semibold text-foreground"}>
          {category.name.uz}
        </span>
        <span className="font-mono text-xs text-muted">/{category.slug}</span>
        <span className="font-mono text-xs text-muted">{category.type}</span>
        <span className="font-mono text-xs tabular-nums text-muted">#{category.order}</span>
        <span className="text-xs text-muted">
          {category.productCount} ta mahsulot
          {child ? "" : ` · ${category.childCount} ta bo'lim`}
        </span>

        <span className="ml-auto flex items-center gap-3">
          {onAddChild ? (
            <button
              type="button"
              onClick={onAddChild}
              className="text-xs text-muted underline-offset-4 transition-colors hover:text-foreground hover:underline"
            >
              Bo&apos;lim qo&apos;shish
            </button>
          ) : null}
          <button
            type="button"
            onClick={onEdit}
            className="text-xs text-muted underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            Tahrirlash
          </button>
          <button
            type="button"
            onClick={onAskDelete}
            className="text-xs text-muted underline-offset-4 transition-colors hover:text-danger hover:underline"
          >
            O&apos;chirish
          </button>
        </span>
      </div>
    </div>
  );
}

/**
 * The catalog menu, as the director edits it.
 *
 * Laid out as the tree rather than as a flat table: the thing being edited is a
 * shape — which column an entry sits in and in what order — and a table sorted
 * by name would hide exactly that.
 *
 * Every write happens in a dialog over that tree. The forms used to open inline,
 * replacing the row they belonged to, which meant editing the third column
 * pushed the fourth off the fold and the shape being edited disappeared behind
 * the editor for it.
 */
export function CategoryManager({ initialData }: { initialData?: CatalogAdminRow[] }) {
  const [creating, setCreating] = useState<{ parentId: string | null } | null>(null);
  const [editing, setEditing] = useState<CategoryView | null>(null);
  const [deleting, setDeleting] = useState<CategoryView | null>(null);

  const list = useAdminCategories(initialData);

  function close() {
    setCreating(null);
    setEditing(null);
    setDeleting(null);
  }

  /*
   * Three mutations, one closing behaviour. Each invalidates the tree — and the
   * public catalog menu with it — so the columns below redraw from the API
   * rather than from a `router.refresh()` that reran the whole route.
   */
  const createCategory = useCreateCategory(close);
  const updateCategory = useUpdateCategory(close);
  const removeCategory = useDeleteCategory(close);

  /**
   * The dialogs print their own refusals, so both writes hand the message back
   * to the form instead of letting it become a toast: a rejected slug belongs
   * under the slug box.
   */
  async function create(values: CategoryFormValues): Promise<string | null> {
    try {
      await createCategory.mutateAsync(values);
      return null;
    } catch (error) {
      return requestErrorMessage(error, "Saqlanmadi. Maydonlarni tekshiring.");
    }
  }

  async function update(id: string, values: CategoryFormValues): Promise<string | null> {
    try {
      await updateCategory.mutateAsync({ id, values });
      return null;
    } catch (error) {
      return requestErrorMessage(error, "Saqlanmadi. Maydonlarni tekshiring.");
    }
  }

  const removeError = removeCategory.isError
    ? requestErrorMessage(removeCategory.error, "Saqlanmadi. Maydonlarni tekshiring.")
    : null;

  if (list.isPending) {
    return <CategoriesSkeleton />;
  }

  if (list.isError) {
    return (
      <div className="panel">
        <p className="type-body text-muted">
          {requestErrorMessage(list.error, "Kategoriyalar yuklanmadi.")}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => void list.refetch()}
        >
          Qayta urinish
        </Button>
      </div>
    );
  }

  const categories = list.data;
  const roots = categories.filter((category) => category.parentId === null);
  const types = [...new Set(categories.map((category) => category.type))].sort();
  const byParent = new Map<string, CategoryView[]>();

  for (const category of categories) {
    if (category.parentId !== null) {
      byParent.set(category.parentId, [...(byParent.get(category.parentId) ?? []), category]);
    }
  }

  const blockage = deleting === null ? null : deletionBlockage(deleting);

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted">
          {roots.length} ta ustun · {categories.length} ta kategoriya
        </p>
        <Button type="button" size="sm" onClick={() => setCreating({ parentId: null })}>
          Kategoriya qo&apos;shish
        </Button>
      </div>

      {roots.length === 0 ? (
        <p className="panel mt-4 type-body text-muted">
          Menyu hali bo&apos;sh. Birinchi ustunni qo&apos;shing — u katalogda alohida ustun bo&apos;lib
          chiqadi.
        </p>
      ) : (
        <ul className="mt-4 space-y-4">
          {roots.map((root) => (
            <li key={root.id} className="panel">
              <CategoryRow
                category={root}
                child={false}
                onEdit={() => setEditing(root)}
                onAddChild={() => setCreating({ parentId: root.id })}
                onAskDelete={() => {
                  removeCategory.reset();
                  setDeleting(root);
                }}
              />

              <ul className="border-t border-border">
                {(byParent.get(root.id) ?? []).map((child) => (
                  <li key={child.id} className="border-b border-border last:border-0">
                    <CategoryRow
                      category={child}
                      child
                      onEdit={() => setEditing(child)}
                      onAskDelete={() => {
                        removeCategory.reset();
                        setDeleting(child);
                      }}
                    />
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}

      {/*
        * Both forms are mounted only while open, and keyed on what they are
        * editing. A dialog that stays mounted keeps the previous category's
        * values in `useState`, so the next one opens showing the last one.
        */}
      {creating !== null ? (
        <CategoryForm
          key={"create-" + (creating.parentId ?? "root")}
          open
          onOpenChange={() => setCreating(null)}
          title={
            creating.parentId === null
              ? "Yangi ustun"
              : `Yangi bo'lim — ${roots.find((root) => root.id === creating.parentId)?.name.uz ?? ""}`
          }
          values={emptyValues(
            creating.parentId,
            roots.find((root) => root.id === creating.parentId)?.type ?? "",
          )}
          roots={roots}
          types={types}
          submitLabel="Qo'shish"
          onSubmit={create}
        />
      ) : null}

      {editing !== null ? (
        <CategoryForm
          key={"edit-" + editing.id}
          open
          onOpenChange={() => setEditing(null)}
          title={`${editing.name.uz} — tahrirlash`}
          values={{
            name: editing.name,
            slug: editing.slug,
            type: editing.type,
            parentId: editing.parentId,
            order: editing.order,
            icon: editing.icon,
          }}
          // A category cannot be its own parent, and the panel should not offer it.
          roots={roots.filter((root) => root.id !== editing.id)}
          types={types}
          submitLabel="Saqlash"
          onSubmit={(values) => update(editing.id, values)}
        />
      ) : null}

      <ConfirmModal
        open={deleting !== null}
        onOpenChange={() => setDeleting(null)}
        title="Kategoriya o'chirilsinmi?"
        subject={deleting === null ? "" : deleting.name.uz + " · /" + deleting.slug}
        warning={
          blockage ??
          "Kategoriya menyudan butunlay yo'qoladi. Buni qaytarib bo'lmaydi."
        }
        /* The button is named for what it does even when it cannot do it: a
           blocked delete is refused with a reason above it, not disguised as a
           different action. */
        /* Distinct from the row's own "O'chirish" trigger, which is still on
           the page behind the dialog. */
        confirmLabel="Kategoriyani o'chirish"
        confirmDisabled={blockage !== null}
        busy={removeCategory.isPending}
        error={removeError}
        onConfirm={() => {
          if (deleting !== null && blockage === null) {
            removeCategory.mutate(deleting.id);
          }
        }}
      />
    </div>
  );
}

/**
 * The tree's shape before its first answer.
 *
 * Only reached when the page's own read failed and left no seed. Three column
 * blocks, because the resting state of this screen is a row of columns and a
 * single wide bar would be a promise the layout does not keep.
 */
function CategoriesSkeleton() {
  return (
    <div aria-busy="true">
      <span className="sr-only">Yuklanmoqda...</span>
      <div aria-hidden="true" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="h-56 animate-pulse rounded-lg bg-surface-muted" />
        ))}
      </div>
    </div>
  );
}
