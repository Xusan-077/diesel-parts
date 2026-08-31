"use client";

import { usePathname } from "next/navigation";
import { Breadcrumb } from "@/components/breadcrumb";
import { buildBreadcrumbs } from "@/lib/breadcrumb";
import { Container } from "@/components/ui/container";

/**
 * The layout's breadcrumb, for every route whose path names itself.
 *
 * This is the only part of the trail that has to be a Client Component, and
 * only because the pathname is not available to a layout on the server in the
 * App Router. The labels are resolved on the server and passed in, so no
 * dictionary is shipped to the browser for it.
 *
 * It renders nothing for the home page (no trail) and nothing for a route it
 * cannot fully name — a product, a brand, a category, a blog post. Those pages
 * know the real names and render their own trail with `<Breadcrumb>` directly,
 * so this staying quiet is what keeps a page from showing two.
 */
export function RouteBreadcrumb({
  homeLabel,
  label,
  labels,
}: {
  homeLabel: string;
  label: string;
  labels: Record<string, string>;
}) {
  const pathname = usePathname();
  const items = buildBreadcrumbs({ pathname, homeLabel, labels });

  if (items === null || items.length === 0) {
    return null;
  }

  return (
    <Container className="pt-6">
      <Breadcrumb items={items} label={label} />
    </Container>
  );
}
