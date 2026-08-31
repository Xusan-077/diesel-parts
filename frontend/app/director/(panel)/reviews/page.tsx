import { listAllReviews } from "@/lib/api/review-repository";
import { safeRead } from "@/lib/api/safe-read";
import { REVIEWS_MODERATION_PAGE_SIZE } from "@/lib/reviews";
import { PageHeader } from "@/components/admin/page-header";
import { ReviewQueue } from "@/components/admin/review-queue";

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

  /*
   * Seeds the list below, which owns it from there: hiding or deleting a review
   * invalidates that cache rather than re-running this route. The read is
   * wrapped because an unreachable database should cost this page its list, not
   * its heading and the navigation around it.
   */
  const result = await safeRead(
    "admin review list",
    () => listAllReviews(page, REVIEWS_MODERATION_PAGE_SIZE),
    undefined,
  );

  return (
    <div>
      <PageHeader
        eyebrow="Direktor paneli"
        title="Sharhlar"
        description="Sharhlar yozilishi bilan saytda chiqadi — telefon raqami SMS orqali allaqachon tasdiqlangan. Nomaqbulini shu yerdan yashiring yoki o'chiring."
      />

      {/*
        The tally and the pager live inside the list now: both are derived from
        the same page of reviews as the rows, and a count left behind on the
        server would disagree with the list the moment one is deleted.
      */}
      <ReviewQueue page={page} initialData={result.data} />
    </div>
  );
}
