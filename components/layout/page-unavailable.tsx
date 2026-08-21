import { Container } from "@/components/ui/container";
import { DataUnavailable } from "@/components/ui/data-unavailable";

/**
 * A whole page's worth of content that could not be read.
 *
 * Used where the failed read carried the page's identity — a product looked up
 * by slug, the category row a listing is named after. There is nothing left to
 * put a notice *beside*, so the notice becomes the page.
 *
 * Rendered on the server, inside the site layout: the header, the catalog menu
 * and the footer need no database, so the visitor still has somewhere to go and
 * sees a finished page rather than the blank shell an uncaught server error
 * leaves behind until the browser has hydrated.
 *
 * Deliberately not `notFound()`. A 404 says "this product does not exist",
 * which is a lie during an outage, and one that a crawler will believe.
 */
export function PageUnavailable({ title, message }: { title: string; message: string }) {
  return (
    <Container as="main" size="narrow" className="pb-24 pt-12">
      <h1 className="text-3xl font-semibold text-foreground">{title}</h1>
      <DataUnavailable className="mt-8" message={message} />
    </Container>
  );
}
