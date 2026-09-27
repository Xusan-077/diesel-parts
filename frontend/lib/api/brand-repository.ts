import "server-only";
import { BackendApiError, backendRequest } from "./backend-client";
import { getStaffSession } from "@/lib/auth/staff-session";
import type { AiLocale, BrandWriteInput } from "@/lib/schemas";

/**
 * The panel's own brand CRUD — new in Stage C. `/catalog/brands` (read by
 * `product-repository.ts`'s `listBrands`) stays the public, unauthenticated
 * listing; this one is the staff-authed write side, same split as
 * `catalog-repository.ts` keeps for categories.
 */

async function accessToken(): Promise<string | undefined> {
  const session = await getStaffSession();
  return session?.accessToken;
}

export interface BrandRow {
  id: string;
  slug: string;
  name: string;
  nameUz: string;
  nameRu: string;
  nameEn: string;
  nameZh: string | null;
  sourceLocale: AiLocale;
  translationStatus: "PENDING" | "COMPLETE" | "FAILED" | null;
  logoUrl: string | null;
}

interface BackendBrandRow {
  id: string;
  slug: string;
  nameUz: string | null;
  nameRu: string | null;
  nameEn: string | null;
  name: string;
  nameZh: string | null;
  sourceLocale: string | null;
  translationStatus: "PENDING" | "COMPLETE" | "FAILED" | null;
  logoUrl: string | null;
}

function toRow(row: BackendBrandRow): BrandRow {
  return {
    id: row.id,
    slug: row.slug,
    // `nameUz` is the per-locale column; the deprecated flat `name` column is
    // the fallback for a row backfilled before Stage C ever wrote nameUz.
    name: row.nameUz ?? row.name,
    nameUz: row.nameUz ?? row.name,
    nameRu: row.nameRu ?? row.name,
    nameEn: row.nameEn ?? row.name,
    nameZh: row.nameZh,
    sourceLocale: (row.sourceLocale ?? "uz") as AiLocale,
    translationStatus: row.translationStatus,
    logoUrl: row.logoUrl,
  };
}

export async function listBrandsForAdmin(): Promise<BrandRow[]> {
  const rows = await backendRequest<BackendBrandRow[]>("/brands", {
    accessToken: await accessToken(),
  });
  return rows.map(toRow);
}

export type BrandWriteRefusal = "duplicate_name" | "not_found";

export type BrandWriteResult =
  | { ok: true; id: string }
  | { ok: false; reason: BrandWriteRefusal };

/**
 * `BrandsService.assertNameFree` throws a plain `ConflictException` with no
 * structured `.code` — unlike categories/products, which set one — so a 409
 * here can only ever mean the one refusal that guard raises.
 */
function toWriteResult(error: BackendApiError): BrandWriteResult {
  if (error.status === 404) {
    return { ok: false, reason: "not_found" };
  }
  if (error.status === 409) {
    return { ok: false, reason: "duplicate_name" };
  }
  throw error;
}

function writeBody(input: BrandWriteInput) {
  return {
    slug: input.slug,
    name: input.name,
    logoUrl: input.logoUrl,
    sourceLocale: input.sourceLocale,
    translationUz: input.translationUz,
    translationRu: input.translationRu,
    translationEn: input.translationEn,
    translationZh: input.translationZh,
    force: input.force,
    forceLocales: input.forceLocales,
  };
}

export async function createBrand(input: BrandWriteInput): Promise<BrandWriteResult> {
  try {
    const created = await backendRequest<{ id: string }>("/brands", {
      method: "POST",
      accessToken: await accessToken(),
      body: writeBody(input),
    });
    return { ok: true, id: created.id };
  } catch (error) {
    if (error instanceof BackendApiError) return toWriteResult(error);
    throw error;
  }
}

export async function updateBrand(id: string, input: BrandWriteInput): Promise<BrandWriteResult> {
  try {
    await backendRequest(`/brands/${id}`, {
      method: "PATCH",
      accessToken: await accessToken(),
      body: writeBody(input),
    });
    return { ok: true, id };
  } catch (error) {
    if (error instanceof BackendApiError) return toWriteResult(error);
    throw error;
  }
}

export async function deleteBrand(id: string): Promise<BrandWriteResult> {
  try {
    await backendRequest(`/brands/${id}`, {
      method: "DELETE",
      accessToken: await accessToken(),
    });
    return { ok: true, id };
  } catch (error) {
    if (error instanceof BackendApiError) return toWriteResult(error);
    throw error;
  }
}
