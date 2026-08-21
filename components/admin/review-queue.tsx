"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import axios from "axios";
import { toast } from "sonner";
import { requestErrorMessage } from "@/lib/api/request-error";
import { formatReviewDate } from "@/lib/reviews";
import type { ModeratedReview } from "@/lib/api/review-repository";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  const router = useRouter();
  const [busy, setBusy] = useState<"visibility" | "delete" | null>(null);
  const [confirming, setConfirming] = useState(false);

  async function run(
    kind: "visibility" | "delete",
    request: () => Promise<unknown>,
    done: string,
    failed: string,
  ) {
    setBusy(kind);
    try {
      await request();
      toast.success(done);
      router.refresh();
    } catch (error) {
      toast.error(requestErrorMessage(error, failed));
    } finally {
      setBusy(null);
    }
  }

  const toggleVisibility = () =>
    run(
      "visibility",
      () =>
        axios.patch(`/api/v1/reviews/${review.id}`, { isApproved: !review.isApproved }),
      review.isApproved ? "Sharh yashirildi" : "Sharh qaytarildi",
      "Holatni o'zgartirib bo'lmadi.",
    );

  const remove = () =>
    run(
      "delete",
      () => axios.delete(`/api/v1/reviews/${review.id}`),
      "Sharh o'chirildi",
      "O'chirib bo'lmadi.",
    );

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
          disabled={busy !== null}
          onClick={toggleVisibility}
        >
          {busy === "visibility"
            ? "…"
            : review.isApproved
              ? "Saytdan yashirish"
              : "Saytga qaytarish"}
        </Button>

        {/*
          Two clicks rather than a `confirm()`: a browser dialog blocks the page
          and reads as a system error rather than a decision. Same pattern as
          retiring a product.
        */}
        {confirming ? (
          <>
            <p className="text-xs text-muted">Butunlay o&apos;chirilsinmi?</p>
            <Button type="button" size="sm" disabled={busy !== null} onClick={remove}>
              {busy === "delete" ? "…" : "Ha, o'chirish"}
            </Button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="text-xs text-muted transition-colors hover:text-foreground"
            >
              Bekor qilish
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="text-xs text-muted transition-colors hover:text-danger"
          >
            O&apos;chirish
          </button>
        )}
      </div>
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
export function ReviewQueue({ reviews }: { reviews: ModeratedReview[] }) {
  if (reviews.length === 0) {
    return (
      <div className="mt-8">
        <p className="type-body text-foreground">Hozircha sharh yo&apos;q.</p>
        <p className="mt-1 text-xs text-muted">
          Xaridorlar mahsulot sahifasida sharh qoldirganda shu yerda ko&apos;rinadi.
        </p>
      </div>
    );
  }

  return (
    <ul className="mt-8 divide-y divide-border">
      {reviews.map((review) => (
        <ReviewRow key={review.id} review={review} />
      ))}
    </ul>
  );
}
