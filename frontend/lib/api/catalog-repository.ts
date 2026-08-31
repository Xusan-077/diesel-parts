import "server-only";
import { cache } from "react";
import { BackendApiError, backendRequest } from "./backend-client";
import { getStaffSession } from "@/lib/auth/staff-session";
import { isCatalogIconKey } from "@/lib/data/catalog-menu";
import {
  buildCatalogTree,
  scopeFromTree,
  type CatalogNode,
  type CatalogRow,
  type CatalogScope,
} from "@/lib/catalog-tree";
import type { CategoryWriteInput } from "@/lib/schemas";

/** One category row as backend/'s `/catalog/categories` and `/categories` return it. */
interface BackendCategoryRow {
  id: string;
  slug: string;
  nameUz: string;
  nameRu: string;
  nameEn: string;
  type: string;
  order: number;
  icon: string | null;
  parentId: string | null;
}

/** backend/'s public `/catalog/categories` tree node — `findTree`'s nested shape. */
interface BackendCategoryTreeNode extends BackendCategoryRow {
  children: BackendCategoryTreeNode[];
}

/** backend/'s staff-authed `/categories` row, with the admin listing's aggregate counts. */
interface BackendCategoryAdminRow extends BackendCategoryRow {
  _count: { children: number; products: number };
}

async function accessToken(): Promise<string | undefined> {
  const session = await getStaffSession();
  return session?.accessToken;
}

function toRow(record: BackendCategoryRow): CatalogRow {
  return {
    id: record.id,
    slug: record.slug,
    name: { uz: record.nameUz, ru: record.nameRu, en: record.nameEn },
    type: record.type,
    order: record.order,
    // An icon key with no component behind it — left over from an older key
    // list, say — is dropped rather than rendered as a gap.
    icon: isCatalogIconKey(record.icon) ? record.icon : null,
    parentId: record.parentId,
  };
}

/** Flattens backend/'s nested category tree back to the flat list `buildCatalogTree` nests itself. */
function flattenCategoryTree(nodes: readonly BackendCategoryTreeNode[]): CatalogRow[] {
  const flat: CatalogRow[] = [];
  for (const node of nodes) {
    const { children, ...row } = node;
    flat.push(toRow(row));
    flat.push(...flattenCategoryTree(children));
  }
  return flat;
}

/**
 * The whole menu, roots first.
 *
 * backend/'s only public endpoint returns a pre-nested tree; flattened here
 * and handed to `buildCatalogTree`, which expects a flat list it nests itself
 * (it also owns the sibling-ordering rule, so re-nesting here would be a
 * second opinion about the same question).
 */
export const getCatalogTree = cache(async (): Promise<CatalogNode[]> => {
  const tree = await backendRequest<BackendCategoryTreeNode[]>("/catalog/categories");
  return buildCatalogTree(flattenCategoryTree(tree));
});

/**
 * Resolves `/products?group=…` / `?category=…` against the menu.
 *
 * `cache` matters here: `generateMetadata` and the page body both ask, and
 * without it every catalog page would read the tree twice per request.
 */
export const getCatalogScope = cache(
  async (params: { group?: string; category?: string }): Promise<CatalogScope | null> => {
    if (!params.group && !params.category) {
      return null;
    }

    return scopeFromTree(await getCatalogTree(), params);
  },
);

/* ── Director panel ───────────────────────────────────────────────────────── */

export interface CatalogAdminRow extends CatalogRow {
  /** Products hanging directly off this category — not off its children. */
  productCount: number;
  childCount: number;
}

/** Every category with the two counts that decide whether it can be deleted. */
export async function listCatalogRows(): Promise<CatalogAdminRow[]> {
  const rows = await backendRequest<BackendCategoryAdminRow[]>("/categories", {
    accessToken: await accessToken(),
  });

  return rows.map((row) => ({
    ...toRow(row),
    productCount: row._count.products,
    childCount: row._count.children,
  }));
}

export type CategoryWriteRefusal =
  | "duplicate_slug"
  | "not_found"
  | "parent_not_found"
  | "parent_not_root"
  | "has_children"
  | "has_products";

export type CategoryWriteResult =
  | { ok: true; id: string }
  | { ok: false; reason: CategoryWriteRefusal };

const KNOWN_REFUSALS: readonly CategoryWriteRefusal[] = [
  "duplicate_slug",
  "not_found",
  "parent_not_found",
  "parent_not_root",
  "has_children",
  "has_products",
];

function isCategoryWriteRefusal(code: string): code is CategoryWriteRefusal {
  return (KNOWN_REFUSALS as readonly string[]).includes(code);
}

/**
 * Turns a write's `BackendApiError` into a typed refusal.
 *
 * A plain 404 (the category itself missing) carries no custom `error` field
 * — backend/ leaves that path as Nest's default `NotFoundException` body,
 * since 404 is unambiguous and nothing else in this domain uses it. Every
 * other refusal comes back as a 400/409 with `.code` set to one of this
 * file's own six reason strings (Part A used the exact same strings), so
 * those are read off `.code` instead. A code that matches neither is a bug
 * in backend/, not a case to guess at — it is rethrown rather than mapped.
 */
function toWriteResult(error: BackendApiError): CategoryWriteResult {
  if (error.status === 404) {
    return { ok: false, reason: "not_found" };
  }

  if (isCategoryWriteRefusal(error.code)) {
    return { ok: false, reason: error.code };
  }

  throw error;
}

function writeBody(input: CategoryWriteInput) {
  return {
    slug: input.slug,
    nameUz: input.name.uz,
    nameRu: input.name.ru,
    nameEn: input.name.en,
    type: input.type,
    order: input.order,
    icon: input.icon,
    parentId: input.parentId,
  };
}

/**
 * `_actorId` is not sent to backend/: `POST /categories` takes the actor from
 * the caller's own access token via `@CurrentUser('id')`, never a body field
 * (the parameter stays here only because every route handler already passes
 * `guard.user.id`, and that id is always the same session's own).
 */
export async function createCategory(
  input: CategoryWriteInput,
  _actorId: string,
): Promise<CategoryWriteResult> {
  try {
    const created = await backendRequest<{ id: string }>("/categories", {
      method: "POST",
      accessToken: await accessToken(),
      body: writeBody(input),
    });
    return { ok: true, id: created.id };
  } catch (error) {
    if (error instanceof BackendApiError) {
      return toWriteResult(error);
    }
    throw error;
  }
}

export async function updateCategory(
  id: string,
  input: CategoryWriteInput,
  _actorId: string,
): Promise<CategoryWriteResult> {
  try {
    const updated = await backendRequest<{ id: string }>(`/categories/${id}`, {
      method: "PATCH",
      accessToken: await accessToken(),
      body: writeBody(input),
    });
    return { ok: true, id: updated.id };
  } catch (error) {
    if (error instanceof BackendApiError) {
      return toWriteResult(error);
    }
    throw error;
  }
}

/**
 * Deletes a category, or explains why it cannot be.
 *
 * Both refusals exist because the alternative is worse than a message:
 * cascading would take a whole column of the menu down with one click, and the
 * product reference would be refused by Postgres anyway — as a foreign-key
 * error the panel could only report as "something went wrong". backend/ (Part
 * A) now enforces both guards server-side; this only translates the result.
 */
export async function deleteCategory(id: string, _actorId: string): Promise<CategoryWriteResult> {
  try {
    await backendRequest(`/categories/${id}`, {
      method: "DELETE",
      accessToken: await accessToken(),
    });
    return { ok: true, id };
  } catch (error) {
    if (error instanceof BackendApiError) {
      return toWriteResult(error);
    }
    throw error;
  }
}
