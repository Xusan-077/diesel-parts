"use client";

import { useState } from "react";
import Link from "next/link";
import {
  useAdminReviews,
  useDeleteReview,
  useSetReviewApproval,
} from "@/hooks/admin/use-admin-reviews";
import type { AdminReviewPage } from "@/lib/api/admin/resources";
import { requestErrorMessage } from "@/lib/api/request-error";
import { formatReviewDate } from "@/lib/reviews";
import type { ModeratedReview } from "@/lib/api/review-repository";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { ConfirmModal } from "@/components/ui/form-modal";
import { cn } from "@/lib/utils";

/**
 * One review, and the two things a director can do about it.
 *
 * The words come first and at reading size, because they are the thing being
 * judged; the score, the name and the part are meta above them. Everything
 * else about the row is quiet — this screen is read down looking for the one
 * entry that should not be there.
 */
function ReviewRow({ review }: { review: ModeratedReview }) {
  const [confirming, setConfirming] = useState(false);

  const visibility = useSetReviewApproval();
  const remove = useDeleteReview(() => setConfirming(false));

  // Printed in the dialog rather than as a toast: a toast would appear behind
  // the still-open dialog that asked the question.
  const deleteError = remove.isError
    ? requestErrorMessage(remove.error, "O'chirib bo'lmadi.")
    : null;

  return (
    <li className="py-6">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-mono text-sm tabular-nums text-foreground">
          {review.rating}/5
        </span>
        <span className="type-body text-foreground">{review.authorName}</span>
        <span className="font-mono text-xs tabular-nums text-muted">
          {formatReviewDate(review.createdAt)}
        </span>
        {!review.isApproved ? <Badge>Yashirilgan</Badge> : null}
      </div>

      <Link
        href={`/products/${review.product.slug}`}
        target="_blank"
        rel="noreferrer"
        className="mt-1 inline-block text-xs text-muted underline decoration-border underline-offset-4 transition-colors hover:text-foreground"
      >
        {review.product.name}
      </Link>

      <p
        className={cn(
          "mt-3 max-w-prose whitespace-pre-line text-pretty type-body",
          // A hidden review stays legible — a director has to be able to read
          // what they took down in order to put it back — but stops competing
          // with the ones still on the site.
          review.isApproved ? "text-foreground" : "text-muted",
        )}
      >
        {review.body}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={visibility.isPending || remove.isPending}
          onClick={() => visibility.mutate({ id: review.id, isApproved: !review.isApproved })}
        >
          {visibility.isPending
            ? "…"
            : review.isApproved
              ? "Saytdan yashirish"
              : "Saytga qaytarish"}
        </Button>

        <button
          type="button"
          onClick={() => {
            remove.reset();
            setConfirming(true);
          }}
          className="text-xs text-muted transition-colors hover:text-danger"
        >
          O&apos;chirish
        </button>
      </div>

      {/*
        * Hiding is reversible and stays a one-click button above. Deleting is
        * not, so it goes through the panel's confirmation dialog — the same one
        * the catalogue and the staff list use, rather than this row growing its
        * own two-click sequence as it had before.
        */}
      <ConfirmModal
        open={confirming}
        onOpenChange={setConfirming}
        title="Sharh o'chirilsinmi?"
        subject={review.authorName + " · " + review.rating + "/5 · " + review.product.name}
        /* Named for the same action as the trigger, but specific enough that
           the two are not one ambiguous "O'chirish" to a screen reader
           listing the buttons on the page. */
        confirmLabel="Sharhni o'chirish"
        warning="Sharh butunlay o'chadi va uni qaytarib bo'lmaydi. Vaqtincha olib turish uchun «Saytdan yashirish» dan foydalaning."
        busy={remove.isPending}
        error={deleteError}
        onConfirm={() => remove.mutate(review.id)}
      />
    </li>
  );
}

/**
 * Every review on the site, newest first, visible and hidden together.
 *
 * Not a queue in the "awaiting approval" sense: reviews publish when they are
 * written, because the phone behind them was already verified by SMS and
 * holding an honest review for days is how a catalogue ends up with none. This
 * is the screen for taking one down afterwards — so it has to show what is
 * already up, not only what is waiting.
 */
export function ReviewQueue({
  page,
  initialData,
}: {
  /** Which page the URL asked for; also this list's cache key. */
  page: number;
  /** The page as the server read it, or `undefined` when that read failed. */
  initialData?: AdminReviewPage;
}) {
  const list = useAdminReviews(page, initialData);

  if (list.isPending) {
    return (
      <div aria-busy="true" className="mt-8">
        <span className="sr-only">Yuklanmoqda...</span>
        <div aria-hidden="true" className="flex flex-col gap-4">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="h-28 animate-pulse rounded-md bg-surface-muted" />
          ))}
        </div>
      </div>
    );
  }

  if (list.isError) {
    return (
      <div className="mt-8">
        <p className="type-body text-foreground">
          {requestErrorMessage(list.error, "Sharhlar yuklanmadi.")}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => void list.refetch()}
        >
          Qayta urinish
        </Button>
      </div>
    );
  }

  if (list.data.items.length === 0) {
    return (
      <div className="mt-8">
        <p className="type-body text-foreground">Hozircha sharh yo&apos;q.</p>
        <p className="mt-1 text-xs text-muted">
          Xaridorlar mahsulot sahifasida sharh qoldirganda shu yerda ko&apos;rinadi.
        </p>
      </div>
    );
  }

  const hidden = list.data.items.filter((review) => !review.isApproved).length;

  return (
    <>
      {/*
        * The tally moved here from the page header for the same reason the
        * catalogue's did: it counts the rows below it, and a count read from a
        * server render that a hide or a delete has since invalidated is a count
        * that disagrees with what is on screen.
        */}
      <p className="mt-6 font-mono text-xs tabular-nums text-muted">
        Jami {list.data.total} ta
        {hidden > 0 ? ` · shu sahifada ${hidden} tasi yashirilgan` : ""}
      </p>

      <ul className="mt-8 divide-y divide-border">
        {list.data.items.map((review) => (
          <ReviewRow key={review.id} review={review} />
        ))}
      </ul>

      {list.data.totalPages > 1 ? (
        <nav aria-label="Sahifalar" className="mt-8 flex items-center gap-3">
          {list.data.page > 1 ? (
            <Link
              href={`/admin/director/reviews?page=${list.data.page - 1}`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Oldingi
            </Link>
          ) : null}

          <span className="font-mono text-xs tabular-nums text-muted">
            {list.data.page} / {list.data.totalPages}
          </span>

          {list.data.page < list.data.totalPages ? (
            <Link
              href={`/admin/director/reviews?page=${list.data.page + 1}`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Keyingi
            </Link>
          ) : null}
        </nav>
      ) : null}
    </>
  );
}
