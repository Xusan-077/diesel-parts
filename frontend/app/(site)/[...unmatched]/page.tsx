import { notFound } from "next/navigation";

/**
 * Every URL under the storefront that matches nothing else.
 *
 * Without this, a typed or stale address falls past the App Router's tree
 * entirely and Next answers with its own bare 404 document — no header, no
 * footer, none of the site's own. A catch-all is the lowest-priority match
 * there is, so every real route still wins; what reaches here is only what
 * would otherwise have left the site's rendering behind.
 *
 * It exists because the app has three root layouts (storefront, panel, and
 * the panel's door), which is the one arrangement in which a root
 * `app/not-found.tsx` has no layout to render inside.
 */
export default function UnmatchedSiteRoute(): never {
  notFound();
}
