import { Skeleton } from "@/components/ui/skeleton";

/**
 * Placeholder rows for the cart, wishlist and compare screens.
 *
 * The id count comes from localStorage and is known before the request, so the
 * skeleton matches the eventual row count exactly and nothing shifts on arrival.
 * All three screens use the stacked form: compare renders a table once loaded,
 * but a table outline is not a useful thing to show for a few hundred
 * milliseconds.
 */
export function ResolvedProductsSkeleton({ count }: { count: number }) {
  return (
    <ul className="mt-6 flex flex-col gap-4" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <li key={index}>
          <Skeleton className="h-28 rounded-lg border border-border" />
        </li>
      ))}
    </ul>
  );
}
