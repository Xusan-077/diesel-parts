"use client";

import { useState } from "react";
import { toast } from "sonner";
import { StarRatingInput } from "./star-rating-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { fieldRail } from "@/components/ui/field-styles";
import {
  REVIEW_AUTHOR_MAX,
  REVIEW_BODY_MAX,
  REVIEW_BODY_MIN,
  validateReviewDraft,
  type PublicReview,
  type ReviewProblem,
} from "@/lib/reviews";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/utils";

/**
 * Writing, or rewriting, this person's review of this part.
 *
 * There is only ever one — the database holds one row per person per part — so
 * this is a single form that seeds from whatever they wrote before and says
 * "update" instead of "post" when it did. Presenting a second, refused form to
 * someone who already reviewed the part would be a dead end in a control they
 * are looking at.
 */
export function ReviewForm({
  own,
  dict,
  submitting,
  onSubmit,
}: {
  /** This person's existing review, when they have one. */
  own: PublicReview | null;
  dict: Dictionary["reviews"];
  submitting: boolean;
  onSubmit: (draft: { rating: number; body: string; authorName: string }) => Promise<boolean>;
}) {
  const editing = own !== null;

  const [rating, setRating] = useState(own?.rating ?? 0);
  const [body, setBody] = useState(own?.body ?? "");
  const [authorName, setAuthorName] = useState(own?.authorName ?? "");
  /*
   * Complaints appear only after the first attempt. Marking a form red before
   * anyone has typed in it tells the reader they are wrong for arriving.
   */
  const [problems, setProblems] = useState<ReviewProblem[] | null>(null);

  const has = (problem: ReviewProblem) => problems?.includes(problem) ?? false;
  const bodyLength = body.trim().length;

  const messages: Record<ReviewProblem, string> = {
    rating: dict.errorRating,
    body_short: dict.errorBodyShort.replace("{min}", String(REVIEW_BODY_MIN)),
    body_long: dict.errorBodyLong.replace("{max}", String(REVIEW_BODY_MAX)),
    name: dict.errorName,
  };

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const draft = { rating, body, authorName };
    const found = validateReviewDraft(draft);
    setProblems(found);

    if (found.length > 0) {
      // One toast naming the first problem, rather than four stacked ones. The
      // fields carry the rest, and they are on screen.
      toast.error(messages[found[0]]);
      return;
    }

    const saved = await onSubmit(draft);
    if (saved && !editing) {
      // A first review clears back to an editable copy of what was just
      // written, which the parent hands back as `own`. Nothing to reset here.
      setProblems(null);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      <h3 className="text-base font-semibold text-foreground">
        {editing ? dict.formTitleEditing : dict.formTitle}
      </h3>

      <div>
        <StarRatingInput
          value={rating}
          onChange={(next) => setRating(next)}
          label={dict.ratingLabel}
          optionLabel={dict.ratingOption}
          invalid={has("rating")}
          describedBy={has("rating") ? "review-rating-error" : undefined}
          disabled={submitting}
        />
        {has("rating") ? (
          <p id="review-rating-error" role="alert" className="mt-2 text-sm text-danger">
            {messages.rating}
          </p>
        ) : null}
      </div>

      <div className={fieldRail({ invalid: has("name") })}>
        <Label htmlFor="review-name">{dict.nameLabel}</Label>
        <Input
          id="review-name"
          variant="rail"
          className="mt-2"
          maxLength={REVIEW_AUTHOR_MAX}
          value={authorName}
          disabled={submitting}
          placeholder={dict.namePlaceholder}
          aria-invalid={has("name") || undefined}
          aria-describedby={has("name") ? "review-name-error" : undefined}
          onChange={(event) => setAuthorName(event.target.value)}
        />
        {has("name") ? (
          <p id="review-name-error" role="alert" className="mt-1 text-sm text-danger">
            {messages.name}
          </p>
        ) : null}
      </div>

      <div className={fieldRail({ invalid: has("body_short") || has("body_long") })}>
        <div className="flex items-baseline justify-between gap-4">
          <Label htmlFor="review-body">{dict.bodyLabel}</Label>
          {/*
            A live count rather than a silent `maxLength` that swallows
            keystrokes. `aria-hidden` because the same numbers are announced by
            the error text when they matter; a screen reader does not want a
            running tally on every keypress.
          */}
          <span
            aria-hidden
            className={cn(
              "text-xs tabular-nums",
              bodyLength > REVIEW_BODY_MAX ? "text-danger" : "text-muted"
            )}
          >
            {dict.bodyCounter
              .replace("{count}", String(bodyLength))
              .replace("{max}", String(REVIEW_BODY_MAX))}
          </span>
        </div>
        <Textarea
          id="review-body"
          variant="rail"
          rows={4}
          className="mt-2 min-h-0"
          value={body}
          disabled={submitting}
          placeholder={dict.bodyPlaceholder}
          aria-invalid={has("body_short") || has("body_long") || undefined}
          aria-describedby={
            has("body_short") || has("body_long") ? "review-body-error" : undefined
          }
          onChange={(event) => setBody(event.target.value)}
        />
        {has("body_short") || has("body_long") ? (
          <p id="review-body-error" role="alert" className="mt-1 text-sm text-danger">
            {has("body_short") ? messages.body_short : messages.body_long}
          </p>
        ) : null}
      </div>

      <Button type="submit" disabled={submitting}>
        {submitting ? dict.submitting : editing ? dict.submitEditing : dict.submit}
      </Button>
    </form>
  );
}
