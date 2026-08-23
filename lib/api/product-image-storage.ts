import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Disk storage for director-uploaded product photos.
 *
 * Local disk rather than S3/MinIO: neither is configured for this project (see
 * .env.example), and the app runs as a persistent Railway service rather than
 * on serverless functions, so a file written here survives to answer the next
 * request. Revisit this the day the app moves to a host with an ephemeral or
 * read-only filesystem — at that point these are the only two functions that
 * would need to change.
 *
 * Pure validation is exported separately from the disk-touching functions so
 * it can be tested without a filesystem, the same split `product-csv.ts` uses.
 */

/** Relative to `public/`, so the saved path is also the public URL's path. */
const UPLOAD_DIR = "uploads/products";

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

/** No I/O — checks the two things a route can know before touching disk. */
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

/**
 * Writes the file under `public/uploads/products` and returns the URL a
 * `<img>` tag can use directly. Throws `InvalidImageError` on a rejected file
 * — the route maps that to a 400 rather than a 500.
 */
export async function saveProductImage(file: File): Promise<string> {
  const validation = validateImageFile(file);
  if (!validation.ok) {
    throw new InvalidImageError(validation.message);
  }

  const dir = path.join(process.cwd(), "public", UPLOAD_DIR);
  await mkdir(dir, { recursive: true });

  const filename = randomUUID() + "." + validation.extension;
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, filename), bytes);

  return "/" + UPLOAD_DIR + "/" + filename;
}

/**
 * Best-effort cleanup of a replaced or archived product's old photo.
 *
 * Silent on any failure, including "already gone": deleting the file is a
 * disk-space nicety, never something a write should fail over. Scoped to
 * `UPLOAD_DIR` on purpose, so a URL pointing anywhere else — a seed photo
 * under `/seed-images`, or a stray value from before this feature existed —
 * is left alone rather than unlinked.
 */
export async function deleteProductImage(imageUrl: string | null | undefined): Promise<void> {
  if (!imageUrl || !imageUrl.startsWith("/" + UPLOAD_DIR + "/")) {
    return;
  }

  const filename = path.basename(imageUrl);
  const filePath = path.join(process.cwd(), "public", UPLOAD_DIR, filename);

  try {
    await unlink(filePath);
  } catch {
    // Already gone, or never existed — nothing to do.
  }
}
