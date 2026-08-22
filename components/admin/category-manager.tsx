"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import axios, { type Method } from "axios";
import { toast } from "sonner";
import { requestErrorMessage } from "@/lib/api/request-error";
import { slugify } from "@/lib/catalog-tree";
import { CATALOG_ICON_KEYS, type CatalogIconKey } from "@/lib/data/catalog-menu";
import { CatalogIcon } from "@/components/catalog/catalog-icon";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
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

/** Resolves to the message to print, or to null when the write went through. */
async function send(url: string, method: Method, body?: unknown): Promise<string | null> {
  try {
    await axios.request({ url, method, data: body });
    return null;
  } catch (error) {
    return requestErrorMessage(error, "Saqlanmadi. Maydonlarni tekshiring.");
  }
}

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
  title,
  values: initial,
  roots,
  types,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  title: string;
  values: CategoryFormValues;
  /** Categories that may be chosen as a parent — top-level ones, minus self. */
  roots: CategoryView[];
  types: string[];
  submitLabel: string;
  onSubmit: (values: CategoryFormValues) => Promise<string | null>;
  onCancel: () => void;
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

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    const message = await onSubmit(form);
    setBusy(false);

    if (message) {
      setError(message);
      toast.error(message);
      return;
    }
  }

  return (
    <form onSubmit={submit} className="panel mt-4 max-w-3xl" noValidate>
      <h2 className="type-title text-foreground">{title}</h2>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <FormField label="Nomi (uz)">
          <Input value={form.name.uz} onChange={(e) => setNameUz(e.target.value)} required />
        </FormField>
        <FormField label="Nomi (ru)">
          <Input
            value={form.name.ru}
            onChange={(e) => setForm({ ...form, name: { ...form.name, ru: e.target.value } })}
            required
          />
        </FormField>
        <FormField label="Nomi (en)">
          <Input
            value={form.name.en}
            onChange={(e) => setForm({ ...form, name: { ...form.name, en: e.target.value } })}
            required
          />
        </FormField>
        <FormField label="Slug" hint="Havolada ko'rinadi. Nomdan avtomatik, tahrirlash mumkin.">
          <Input
            value={form.slug}
            onChange={(e) => {
              setSlugEdited(true);
              setForm({ ...form, slug: e.target.value });
            }}
            className="font-mono"
            placeholder="tormoz-tizimi"
            required
          />
        </FormField>
        <FormField label="Ustun" hint="Bo'sh qoldirilsa — menyuda alohida ustun bo'ladi.">
          <Select
            value={form.parentId ?? ""}
            onChange={(e) => setParent(e.target.value || null)}
          >
            <option value="">— Yuqori bosqich (ustun) —</option>
            {roots.map((root) => (
              <option key={root.id} value={root.id}>
                {root.name.uz}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Toifa" hint="Qism oilasi: engine, brakes, filters. Ustun bilan bir xil.">
          <Input
            value={form.type}
            onChange={(e) => {
              setTypeEdited(true);
              setForm({ ...form, type: e.target.value });
            }}
            className="font-mono"
            list={TYPES_LIST_ID}
            placeholder="engine"
            required
          />
        </FormField>
        <FormField label="Tartib" hint="Kichik raqam oldinda turadi.">
          <Input
            inputMode="numeric"
            value={String(form.order)}
            onChange={(e) => setForm({ ...form, order: Number(e.target.value) || 0 })}
            className="font-mono tabular-nums"
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

      <div aria-live="polite" className="min-h-5">
        {error ? (
          <p role="alert" className="mt-4 text-sm text-danger">
            {error}
          </p>
        ) : null}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? "Saqlanmoqda…" : submitLabel}
        </Button>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-muted transition-colors hover:text-foreground"
        >
          Bekor qilish
        </button>
      </div>
    </form>
  );
}

/**
 * What a delete would take with it, before it is asked for.
 *
 * The API refuses a category that still holds children or products, and this
 * says so in place rather than letting the director click into a refusal: the
 * counts are already on screen, so the answer is knowable without a round trip.
 */
function DeleteConfirm({
  category,
  onCancel,
  onConfirm,
}: {
  category: CategoryView;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const blocked = category.childCount > 0 || category.productCount > 0;

  return (
    <div className="mt-2 rounded-md border border-border bg-surface-muted p-3">
      {blocked ? (
        <p className="text-sm text-warning">
          {category.childCount > 0
            ? `Ichida ${category.childCount} ta pastki bo'lim bor. `
            : ""}
          {category.productCount > 0 ? `${category.productCount} ta mahsulot bog'langan. ` : ""}
          Avval ularni ko&apos;chiring — shundan keyin o&apos;chirish mumkin.
        </p>
      ) : (
        <p className="text-sm text-foreground">
          &laquo;{category.name.uz}&raquo; o&apos;chirilsinmi? Buni qaytarib bo&apos;lmaydi.
        </p>
      )}

      <div className="mt-3 flex items-center gap-3">
        <Button type="button" size="sm" onClick={onConfirm} disabled={blocked}>
          O&apos;chirish
        </Button>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-muted transition-colors hover:text-foreground"
        >
          Bekor qilish
        </button>
      </div>
    </div>
  );
}

function CategoryRow({
  category,
  child,
  onEdit,
  onAddChild,
  onAskDelete,
  onConfirmDelete,
  confirming,
  onCancelDelete,
}: {
  category: CategoryView;
  child: boolean;
  onEdit: () => void;
  onAddChild?: () => void;
  onAskDelete: () => void;
  onConfirmDelete: () => void;
  confirming: boolean;
  onCancelDelete: () => void;
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

      {confirming ? (
        <DeleteConfirm category={category} onCancel={onCancelDelete} onConfirm={onConfirmDelete} />
      ) : null}
    </div>
  );
}

/**
 * The catalog menu, as the director edits it.
 *
 * Laid out as the tree rather than as a flat table: the thing being edited is a
 * shape — which column an entry sits in and in what order — and a table sorted
 * by name would hide exactly that.
 */
export function CategoryManager({ categories }: { categories: CategoryView[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState<{ parentId: string | null } | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  const roots = categories.filter((category) => category.parentId === null);
  const types = [...new Set(categories.map((category) => category.type))].sort();
  const byParent = new Map<string, CategoryView[]>();

  for (const category of categories) {
    if (category.parentId !== null) {
      byParent.set(category.parentId, [...(byParent.get(category.parentId) ?? []), category]);
    }
  }

  function done() {
    setCreating(null);
    setEditing(null);
    setConfirming(null);
    router.refresh();
  }

  async function create(values: CategoryFormValues): Promise<string | null> {
    const message = await send("/api/v1/categories", "POST", values);
    if (message === null) {
      toast.success("Kategoriya qo'shildi");
      done();
    }
    return message;
  }

  async function update(id: string, values: CategoryFormValues): Promise<string | null> {
    const message = await send(`/api/v1/categories/${id}`, "PATCH", values);
    if (message === null) {
      toast.success("Kategoriya saqlandi");
      done();
    }
    return message;
  }

  async function remove(id: string) {
    const message = await send(`/api/v1/categories/${id}`, "DELETE");
    if (message !== null) {
      toast.error(message);
      return;
    }
    toast.success("Kategoriya o'chirildi");
    done();
  }

  function editFormFor(category: CategoryView) {
    return (
      <CategoryForm
        title={`${category.name.uz} — tahrirlash`}
        values={{
          name: category.name,
          slug: category.slug,
          type: category.type,
          parentId: category.parentId,
          order: category.order,
          icon: category.icon,
        }}
        // A category cannot be its own parent, and the panel should not offer it.
        roots={roots.filter((root) => root.id !== category.id)}
        types={types}
        submitLabel="Saqlash"
        onSubmit={(values) => update(category.id, values)}
        onCancel={() => setEditing(null)}
      />
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted">
          {roots.length} ta ustun · {categories.length} ta kategoriya
        </p>
        {creating === null ? (
          <Button type="button" size="sm" onClick={() => setCreating({ parentId: null })}>
            Kategoriya qo&apos;shish
          </Button>
        ) : null}
      </div>

      {creating !== null ? (
        <CategoryForm
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
          onCancel={() => setCreating(null)}
        />
      ) : null}

      {roots.length === 0 ? (
        <p className="panel mt-4 type-body text-muted">
          Menyu hali bo&apos;sh. Birinchi ustunni qo&apos;shing — u katalogda alohida ustun bo&apos;lib
          chiqadi.
        </p>
      ) : (
        <ul className="mt-4 space-y-4">
          {roots.map((root) => (
            <li key={root.id} className="panel">
              {editing === root.id ? (
                editFormFor(root)
              ) : (
                <CategoryRow
                  category={root}
                  child={false}
                  onEdit={() => setEditing(root.id)}
                  onAddChild={() => setCreating({ parentId: root.id })}
                  onAskDelete={() => setConfirming(root.id)}
                  onConfirmDelete={() => void remove(root.id)}
                  confirming={confirming === root.id}
                  onCancelDelete={() => setConfirming(null)}
                />
              )}

              <ul className="border-t border-border">
                {(byParent.get(root.id) ?? []).map((child) => (
                  <li key={child.id} className="border-b border-border last:border-0">
                    {editing === child.id ? (
                      editFormFor(child)
                    ) : (
                      <CategoryRow
                        category={child}
                        child
                        onEdit={() => setEditing(child.id)}
                        onAskDelete={() => setConfirming(child.id)}
                        onConfirmDelete={() => void remove(child.id)}
                        confirming={confirming === child.id}
                        onCancelDelete={() => setConfirming(null)}
                      />
                    )}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
