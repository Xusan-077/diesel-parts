import Link from "next/link";

/**
 * The page stepper the finance tables share. Each table passes `hrefFor`,
 * which already knows that tab's route and its other filter params.
 */
export function FinancePager({
  page,
  totalPages,
  hrefFor,
}: {
  page: number;
  totalPages: number;
  hrefFor: (page: number) => string;
}) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <nav aria-label="Sahifalar" className="mt-6 flex items-center gap-3 text-sm">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className="text-muted transition-colors hover:text-foreground">
          ← Oldingi
        </Link>
      ) : null}
      <span className="font-mono text-xs text-muted">
        {page} / {totalPages}
      </span>
      {page < totalPages ? (
        <Link href={hrefFor(page + 1)} className="text-muted transition-colors hover:text-foreground">
          Keyingi →
        </Link>
      ) : null}
    </nav>
  );
}
