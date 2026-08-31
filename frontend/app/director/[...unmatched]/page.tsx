import { notFound } from "next/navigation";

/**
 * The same catch-all as the admin panel's (app/admin/[...unmatched]), so a
 * stale `/director/...` address gets this panel's own 404 and not the
 * storefront's or the admin panel's — route groups add no path segment, but
 * this root has no route group above it to worry about either way; this
 * exists for the same reason theirs does, in case a segment is ever added
 * back that would otherwise claim these paths.
 */
export default function UnmatchedDirectorRoute(): never {
  notFound();
}
