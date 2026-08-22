import { notFound } from "next/navigation";

/**
 * The same catch-all for the panel, so a stale `/admin/...` address gets the
 * panel's own 404 and not the storefront's. Without it the site's catch-all
 * would claim those URLs — route groups add no path segment, so its pattern
 * covers `/admin/...` too — and staff would land on a marketing screen.
 */
export default function UnmatchedPanelRoute(): never {
  notFound();
}
