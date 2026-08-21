"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import { MessageSquareText, ShoppingCart } from "lucide-react";
import { AuthDialog } from "@/components/account/auth-dialog";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useAuthHint } from "@/hooks/use-auth-hint";
import { requestErrorMessage } from "@/lib/api/request-error";
import type { Page } from "@/lib/api/product-query";
import {
  mergeOwnReview,
  REVIEWS_PAGE_SIZE,
  type PublicReview,
} from "@/lib/reviews";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { ReviewForm } from "./review-form";
import { ReviewList } from "./review-list";

type ReviewPage = Page<PublicReview>;

interface ProductReviewsProps {
  productId: string;
  /** First page, read on the server, so the log is in the HTML. */
  initialPage: ReviewPage;
  /** This reader's existing review, read on the server by phone. */
  initialOwn: PublicReview | null;
  /**
   * Whether this reader has a completed order for this part.
   *
   * Read on the server, because it is a fact about orders the browser has no
   * way to know. It decides what stands in the form's place here; the rule
   * itself is kept by `POST /api/reviews`, which checks it again.
   */
  canReview: boolean;
  dict: Dictionary["reviews"];
  productDict: Dictionary["product"];
  account: Dictionary["account"];
  closeLabel: string;
}

export function ProductReviews({
  productId,
  initialPage,
  initialOwn,
  canReview,
  dict,
  productDict,
  account,
  closeLabel,
}: ProductReviewsProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const signedIn = useAuthHint();

  const [own, setOwn] = useState<PublicReview | null>(initialOwn);
  const [submitting, setSubmitting] = useState(false);

  const queryKey = ["reviews", productId] as const;

  const { data, isError, isFetchingNextPage, fetchNextPage, hasNextPage, refetch } =
    useInfiniteQuery({
      queryKey,
      initialPageParam: 1,
      queryFn: async ({ pageParam }): Promise<ReviewPage> => {
        const { data } = await axios.get<ReviewPage>("/api/reviews", {
          params: { productId, page: pageParam, pageSize: REVIEWS_PAGE_SIZE },
        });
        return data;
      },
      getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
      // The server already rendered page one; without this the section would
      // flash empty on entry and fill in a moment later.
      initialData: { pages: [initialPage], pageParams: [1] },
    });

  const pages = data?.pages ?? [];
  const reviews = pages.flatMap((page) => page.items);
  const total = pages[0]?.total ?? initialPage.total;
  const remaining = Math.max(0, total - reviews.length);

  /**
   * Writes the review and puts it on screen without a reload.
   *
   * Two updates, because two different things are stale and they are owned by
   * different renderers. The list is React Query's, so the saved row is folded
   * into the first page immediately — that is what makes it appear at once —
   * and then invalidated, so the server's own ordering wins a moment later.
   * The average and the review count above are a Server Component's, read
   * straight from Postgres, so only `router.refresh()` can recompute them.
   *
   * The two cannot disagree: the merge applies exactly the rule the server
   * applies (`mergeOwnReview` mirrors the upsert), and both are replaced by
   * server data as soon as it lands.
   */
  async function submit(draft: {
    rating: number;
    body: string;
    authorName: string;
  }): Promise<boolean> {
    const editing = own !== null;
    setSubmitting(true);

    try {
      const { data: saved } = await axios.post<PublicReview>("/api/reviews", {
        productId,
        ...draft,
      });

      setOwn(saved);

      queryClient.setQueryData<{ pages: ReviewPage[]; pageParams: unknown[] }>(
        queryKey,
        (current) => {
          if (!current) return current;
          const [first, ...rest] = current.pages;
          const items = mergeOwnReview(first.items, saved);

          return {
            ...current,
            pages: [
              {
                ...first,
                items,
                // A rewrite does not add a row; only a first review does.
                total: editing ? first.total : first.total + 1,
              },
              ...rest,
            ],
          };
        },
      );

      void queryClient.invalidateQueries({ queryKey });
      router.refresh();

      toast.success(editing ? dict.toastUpdated : dict.toastCreated);
      return true;
    } catch (error) {
      toast.error(requestErrorMessage(error, dict.errorGeneric));
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section aria-labelledby="reviews-title">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border pb-4">
        <h2 id="reviews-title" className="text-lg font-semibold text-foreground">
          {dict.title}
        </h2>
        {total > 0 ? (
          <p className="text-sm tabular-nums text-muted">
            {dict.count.replace("{count}", String(total))}
          </p>
        ) : null}
      </div>

      {isError ? (
        <div className="py-10 text-center">
          <p className="text-sm text-muted">{dict.loadError}</p>
          <Button type="button" variant="outline" size="sm" className="mt-4" onClick={() => refetch()}>
            {dict.retry}
          </Button>
        </div>
      ) : reviews.length === 0 ? (
        /* An empty log is an invitation, not a shrug: it says who should write
           and what would be worth saying. The form is directly below it. */
        <div className="flex flex-col items-center py-12 text-center">
          <Icon icon={MessageSquareText} size="xl" className="text-muted" />
          <p className="mt-4 max-w-sm text-pretty text-sm text-muted">{dict.empty}</p>
        </div>
      ) : (
        <>
          <div className="mt-6">
            <ReviewList reviews={reviews} dict={dict} productDict={productDict} />
          </div>

          {hasNextPage ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isFetchingNextPage}
              onClick={() => fetchNextPage()}
            >
              {isFetchingNextPage
                ? dict.submitting
                : dict.showMore.replace("{count}", String(Math.min(remaining, REVIEWS_PAGE_SIZE)))}
            </Button>
          ) : null}
        </>
      )}

      <div className="mt-10 border-t border-border pt-8">
        {signedIn && !canReview && own === null ? (
          /*
            Signed in, but this part has not been bought. Saying so — and
            saying when the form will appear — is the difference between a
            rule and a dead end.

            `own === null` guards it: someone who reviewed a part and then had
            the order cancelled still owns their words, and must be able to
            reach the form that edits them.
          */
          <div className="flex items-start gap-3">
            <Icon icon={ShoppingCart} size="md" className="mt-0.5 shrink-0 text-muted" />
            <div>
              <p className="text-sm font-medium text-foreground">{dict.purchasePrompt}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted">{dict.purchaseNote}</p>
            </div>
          </div>
        ) : signedIn ? (
          <ReviewForm own={own} dict={dict} submitting={submitting} onSubmit={submit} />
        ) : (
          /*
            The dialog rather than a link to /account/login: signing in is a
            detour from the thing they are doing, and a detour should return
            them to it. `router.refresh()` is what re-reads the session on the
            server so their own review, if they already left one, seeds the
            form the moment they are back.
          */
          <div className="flex flex-wrap items-center gap-4">
            <p className="text-sm text-muted">{dict.signInPrompt}</p>
            <AuthDialog dict={account} closeLabel={closeLabel} onVerified={() => router.refresh()}>
              <Button type="button" variant="outline" size="sm">
                {dict.signInCta}
              </Button>
            </AuthDialog>
          </div>
        )}
      </div>
    </section>
  );
}
