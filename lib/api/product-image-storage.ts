import "server-only";
import { randomUUID } from "node:crypto";
import { del, put } from "@vercel/blob";

/**
 * Vercel Blob storage for director-uploaded product photos.
 *
 * This app's root deploy is Vercel (see docs/deploy-checklist.md) — a
 * serverless platform, not a persistent host. A function instance's
 * filesystem is ephemeral outside `/tmp`, and `public/` is published as an
 * immutable snapshot at build time, so a runtime `writeFile` into
 * `public/uploads/...` never becomes reachable in production even when it
 * momentarily succeeds. That mismatch (an earlier version of this file
 * assumed a persistent Railway-style host) was root-caused as the reason
 * product photos rendered locally but 404'd in production — see the
 * 2026-08-24 incident notes in docs/deploy-checklist.md.
 *
 * Blob works identically from `next dev` and from Vercel, so there is no
 * longer a local/production split to account for.
 *
 * Pure validation is exported separately from the network-touching functions
 * so it can be tested without a live token, the same split `product-csv.ts`
 * uses.
 */

const UPLOAD_PREFIX = "products/";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export class InvalidImageError extends Error {}

export type ImageValidation =
  | { ok: true; extension: string }
  | { ok: false; message: string };

/** No I/O — checks the two things a route can know before uploading. */
export function validateImageFile(file: File): ImageValidation {
  const extension = ALLOWED_TYPES[file.type];
  if (!extension) {
    return { ok: false, message: "Rasm JPEG, PNG yoki WebP formatida bo'lishi kerak." };
  }
  if (file.size === 0) {
    return { ok: false, message: "Rasm fayli bo'sh." };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { ok: false, message: "Rasm hajmi 5 MB dan oshmasligi kerak." };
  }
  return { ok: true, extension };
}

/** Only a URL Blob actually issued is safe to hand back to `del()`. */
function isManagedBlobUrl(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith(".public.blob.vercel-storage.com");
  } catch {
    return false;
  }
}

/**
 * Uploads the file to the public Blob store and returns the URL a `<img>`
 * tag can use directly. Throws `InvalidImageError` on a rejected file — the
 * route maps that to a 400 rather than a 500.
 */
export async function saveProductImage(file: File): Promise<string> {
  const validation = validateImageFile(file);
  if (!validation.ok) {
    throw new InvalidImageError(validation.message);
  }

  const pathname = UPLOAD_PREFIX + randomUUID() + "." + validation.extension;
  const blob = await put(pathname, file, {
    access: "public",
    addRandomSuffix: false,
  });

  return blob.url;
}

/**
 * Best-effort cleanup of a replaced or archived product's old photo.
 *
 * Silent on any failure, including "already gone": deleting the blob is a
 * storage-space nicety, never something a write should fail over. Scoped to
 * this project's Blob store on purpose, so a URL pointing anywhere else — a
 * seed photo under `/seed-images`, or a pre-migration relative
 * `/uploads/products/...` path left over in the database — is left alone
 * rather than passed to `del()`.
 */
export async function deleteProductImage(imageUrl: string | null | undefined): Promise<void> {
  if (!imageUrl || !isManagedBlobUrl(imageUrl)) {
    return;
  }

  try {
    await del(imageUrl);
  } catch {
    // Already gone, or never existed — nothing to do.
  }
}
