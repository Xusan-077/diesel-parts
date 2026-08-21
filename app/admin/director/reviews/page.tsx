import Link from "next/link";
import { listAllReviews } from "@/lib/api/review-repository";
import { PageHeader } from "@/components/admin/page-header";
import { ReviewQueue } from "@/components/admin/review-queue";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

function firstParam(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

export default async function DirectorReviewsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number.parseInt(firstParam(params.page), 10) || 1);

  const result = await listAllReviews(page, PAGE_SIZE);
  const hidden = result.items.filter((review) => !review.isApproved).length;

  return (
    <div>
      <PageHeader
        eyebrow="Direktor paneli"
        title="Sharhlar"
        description="Sharhlar yozilishi bilan saytda chiqadi — telefon raqami SMS orqali allaqachon tasdiqlangan. Nomaqbulini shu yerdan yashiring yoki o'chiring."
      />

      {result.total > 0 ? (
        <p className="mt-6 font-mono text-xs tabular-nums text-muted">
          Jami {result.total} ta
          {hidden > 0 ? ` · shu sahifada ${hidden} tasi yashirilgan` : ""}
        </p>
      ) : null}

      <ReviewQueue reviews={result.items} />

      {/*
        Links rather than a client paginator: this page has no other client
        state to keep in step, so a plain `?page=` is one fewer bundle and
        leaves the position in the browser's own history.
      */}
      {result.totalPages > 1 ? (
        <nav aria-label="Sahifalar" className="mt-8 flex items-center gap-3">
          {result.page > 1 ? (
            <Link
              href={`/admin/director/reviews?page=${result.page - 1}`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Oldingi
            </Link>
          ) : null}

          <span className="font-mono text-xs tabular-nums text-muted">
            {result.page} / {result.totalPages}
          </span>

          {result.page < result.totalPages ? (
            <Link
              href={`/admin/director/reviews?page=${result.page + 1}`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Keyingi
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
