"use client";

import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import { clampFrame, isBrowsable, stepFrame, swipeDelta } from "@/lib/card-gallery";
import type { Dictionary } from "@/lib/i18n/dictionaries";

/**
 * The picture at the top of a catalog card, and a way through the rest.
 *
 * A part is bought on what it looks like from more than one side — the thread
 * on a fitting, what is actually in the box — so a card that shows only the
 * first frame makes every visitor open the page to find out. This shows all of
 * them without leaving the grid.
 *
 * One frame draws no markers and no arrows: a control that cannot move is
 * worse than no control. Two or more draws both, and takes a swipe.
 *
 * The catalog stores captions rather than photographs (`imageLabels`), so each
 * frame is a placeholder tile bearing its caption. The frame count, the markers
 * and the gestures are all real today; the day photographs arrive, only what is
 * *inside* the frame changes.
 */
export function CardGallery({
  frames,
  alt,
  dict,
  className,
}: {
  /** One caption per frame. Today's stand-in for the photographs. */
  frames: readonly string[];
  /** Names the picture, e.g. the part's own name. */
  alt: string;
  dict: Dictionary["product"];
  className?: string;
}) {
  const [active, setActive] = useState(0);
  const start = useRef<{ x: number; y: number } | null>(null);

  const browsable = isBrowsable(frames);
  // The list can change under the index — a card is reused as a carousel
  // scrolls, and React Query can swap the row beneath it.
  const current = clampFrame(active, frames.length);

  function step(delta: 1 | -1) {
    setActive(stepFrame(current, frames.length, delta));
  }

  return (
    <div
      className={cn(
        "group/gallery relative flex aspect-4/3 items-center justify-center overflow-hidden bg-linear-to-br from-surface-hover to-transparent",
        className
      )}
      onPointerDown={(event) => {
        // Mouse drags are handled too, but a mouse has arrows; this is mainly
        // touch, and `pointer` covers both without two sets of handlers.
        start.current = { x: event.clientX, y: event.clientY };
      }}
      onPointerUp={(event) => {
        const from = start.current;
        start.current = null;
        if (from === null || !browsable) {
          return;
        }

        const delta = swipeDelta(event.clientX - from.x, event.clientY - from.y);
        if (delta !== null) {
          // A swipe is a decision about the card, not a click through to the
          // page the stretched title link would otherwise take.
          event.preventDefault();
          step(delta);
        }
      }}
    >
      <span
        role="img"
        aria-label={`${alt} — ${frames[current]}`}
        className="text-sm text-muted"
      >
        {frames[current]}
      </span>

      {browsable ? (
        <>
          {/*
            The arrows sit above the card's stretched title link, and stay
            invisible until the card is hovered or one of them is focused —
            on a phone the swipe is the control, and two chevrons parked on
            every tile in a grid would be noise on a surface that is mostly
            picture.
          */}
          {(
            [
              { delta: -1 as const, icon: ChevronLeft, label: dict.imagePrev, side: "left-2" },
              { delta: 1 as const, icon: ChevronRight, label: dict.imageNext, side: "right-2" },
            ]
          ).map(({ delta, icon, label, side }) => (
            <button
              key={label}
              type="button"
              aria-label={label}
              title={label}
              onClick={(event) => {
                event.preventDefault();
                step(delta);
              }}
              className={cn(
                "absolute top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-surface/90 text-muted opacity-0 backdrop-blur-sm transition-opacity hover:text-accent-strong focus-visible:opacity-100 group-hover/gallery:opacity-100",
                side
              )}
            >
              <Icon icon={icon} size="xs" />
            </button>
          ))}

          {/* Bottom-right, because the card corners its availability badge
              bottom-left and a centred row of markers collided with it on a
              two-up phone grid.

              Dashes rather than dots, matching the hero: they lie along the
              axis the frames move on, and against a photograph a 2px rule
              reads as a mark on the picture where a filled circle reads as a
              speck of dirt on it. */}
          <div className="absolute bottom-2 right-2 z-10 flex items-center gap-1">
            {frames.map((frame, index) => (
              <button
                key={frame}
                type="button"
                aria-label={dict.imageDot.replace("{n}", String(index + 1))}
                aria-current={index === current ? "true" : undefined}
                onClick={(event) => {
                  event.preventDefault();
                  setActive(index);
                }}
                className={cn(
                  // A 16px-tall hit area around a 2px dash: the dash is the
                  // mark, the padding is what makes it tappable.
                  "flex h-4 items-center px-0.5 transition-opacity",
                  index === current ? "opacity-100" : "opacity-60 hover:opacity-90"
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "block h-0.5 rounded-full transition-all duration-300",
                    index === current ? "w-4 bg-foreground" : "w-2 bg-border-strong"
                  )}
                />
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
