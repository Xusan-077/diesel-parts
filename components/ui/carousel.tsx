"use client";

import * as React from "react";
import useEmblaCarousel, { type UseEmblaCarouselType } from "embla-carousel-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Icon } from "./icon";

type CarouselApi = UseEmblaCarouselType[1];
type EmblaOptions = Parameters<typeof useEmblaCarousel>[0];

export interface CarouselLabels {
  /** Names the region, e.g. "Popular products". */
  region: string;
  prev: string;
  next: string;
  /** Template for a marker, e.g. "Slide {n}". Only needed where dots are shown. */
  slide?: string;
}

interface CarouselContextValue {
  carouselRef: ReturnType<typeof useEmblaCarousel>[0];
  api: CarouselApi;
  scrollPrev: () => void;
  scrollNext: () => void;
  canScrollPrev: boolean;
  canScrollNext: boolean;
  labels: CarouselLabels;
}

const CarouselContext = React.createContext<CarouselContextValue | null>(null);

function useCarousel() {
  const context = React.useContext(CarouselContext);
  if (!context) {
    throw new Error("Carousel parts must be used inside <Carousel>");
  }
  return context;
}

interface CarouselProps extends React.ComponentProps<"section"> {
  opts?: EmblaOptions;
  labels: CarouselLabels;
  setApi?: (api: CarouselApi) => void;
}

/**
 * A carousel here never moves on its own.
 *
 * It used to advance on a timer on the hero and the lead product row. A track
 * that changes under a reader who is still reading the slide they are on takes
 * the decision away from them — and the fix a timer needs (a stop button, a
 * hover pause, a focus pause, a reduced-motion escape) is four controls
 * standing in for one that should not have been there. Every move through a
 * carousel is now a press: an arrow, a marker, a drag, or an arrow key.
 */
export function Carousel({
  opts,
  labels,
  setApi,
  className,
  children,
  ...props
}: CarouselProps) {
  const [carouselRef, api] = useEmblaCarousel({
    align: "start",
    containScroll: "trimSnaps",
    ...opts,
  });

  const scrollPrev = React.useCallback(() => api?.scrollPrev(), [api]);
  const scrollNext = React.useCallback(() => api?.scrollNext(), [api]);

  /*
   * Embla owns the scroll position, so the arrows read it as an external store
   * rather than mirroring it into React state. That keeps the first paint in
   * sync without a set-state-inside-an-effect round trip.
   */
  const subscribe = React.useCallback(
    (onChange: () => void) => {
      if (!api) return () => {};
      api.on("select", onChange).on("reInit", onChange);
      return () => {
        api.off("select", onChange).off("reInit", onChange);
      };
    },
    [api]
  );

  const canScrollPrev = React.useSyncExternalStore(
    subscribe,
    () => api?.canScrollPrev() ?? false,
    () => false
  );
  const canScrollNext = React.useSyncExternalStore(
    subscribe,
    () => api?.canScrollNext() ?? false,
    () => false
  );

  React.useEffect(() => {
    setApi?.(api);
  }, [api, setApi]);

  function handleKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      scrollPrev();
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      scrollNext();
    }
  }

  const value: CarouselContextValue = {
    carouselRef,
    api,
    scrollPrev,
    scrollNext,
    canScrollPrev,
    canScrollNext,
    labels,
  };

  return (
    <CarouselContext.Provider value={value}>
      <section
        role="region"
        aria-roledescription="carousel"
        aria-label={labels.region}
        onKeyDown={handleKeyDown}
        className={cn("relative", className)}
        {...props}
      >
        {children}
      </section>
    </CarouselContext.Provider>
  );
}

export interface CarouselContentProps extends React.ComponentProps<"div"> {
  /**
   * Classes for the clipping viewport rather than the track inside it.
   *
   * Needed by a row that stops being a carousel at a breakpoint: the drag
   * cursor lives here, and a grid is not draggable.
   */
  viewportClassName?: string;
}

export function CarouselContent({ className, viewportClassName, ...props }: CarouselContentProps) {
  const { carouselRef } = useCarousel();
  return (
    // `overflow-hidden` clips the track; the negative margin pairs with the
    // padding on each item so the first card still lines up with the gutter.
    /*
      `cursor-grab` is the only thing that says the row can be dragged.
      Embla has taken mouse drags since it was added — the affordance was
      simply missing, so on a desktop the arrows looked like the only way
      through a row that is mostly off-screen.
    */
    <div
      ref={carouselRef}
      className={cn(
        "cursor-grab overflow-hidden active:cursor-grabbing",
        viewportClassName
      )}
    >
      <div className={cn("flex -ml-4", className)} {...props} />
    </div>
  );
}

export function CarouselItem({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      role="group"
      aria-roledescription="slide"
      className={cn("min-w-0 shrink-0 grow-0 basis-full pl-4", className)}
      {...props}
    />
  );
}

const navButtonClass =
  "inline-flex h-11 w-11 items-center justify-center rounded-md border border-border bg-surface text-foreground transition-colors hover:border-accent/60 hover:text-accent-strong disabled:pointer-events-none disabled:opacity-40";

export function CarouselPrevious({ className, ...props }: React.ComponentProps<"button">) {
  const { scrollPrev, canScrollPrev, labels } = useCarousel();
  return (
    <button
      type="button"
      aria-label={labels.prev}
      disabled={!canScrollPrev}
      onClick={scrollPrev}
      className={cn(navButtonClass, className)}
      {...props}
    >
      <Icon icon={ChevronLeft} size="md" />
    </button>
  );
}

export function CarouselNext({ className, ...props }: React.ComponentProps<"button">) {
  const { scrollNext, canScrollNext, labels } = useCarousel();
  return (
    <button
      type="button"
      aria-label={labels.next}
      disabled={!canScrollNext}
      onClick={scrollNext}
      className={cn(navButtonClass, className)}
      {...props}
    >
      <Icon icon={ChevronRight} size="md" />
    </button>
  );
}

/**
 * One marker per slide, for a carousel whose slides are whole screens rather
 * than a row of cards.
 *
 * A product row does not need these — the half-visible card at the edge
 * already says the row continues, and eleven markers under four parts is
 * noise. A hero does: each slide fills the viewport, so without them there is
 * nothing on screen to say another one exists.
 *
 * Dashes rather than dots. A dot is a bullet: it counts slides but says
 * nothing about them. A dash lies along the axis the track actually moves on,
 * so the row of them reads as the length of the hero with the reader's place
 * marked in it — and the current slide is the long one, which is the same
 * shape a progress bar uses to mean the same thing.
 *
 * Buttons rather than an indicator strip: a reader who can see there are five
 * slides will try to click the fifth.
 */
export function CarouselDots({ className, ...props }: React.ComponentProps<"div">) {
  const { api, labels } = useCarousel();

  const subscribe = React.useCallback(
    (onChange: () => void) => {
      if (!api) return () => {};
      api.on("select", onChange).on("reInit", onChange);
      return () => {
        api.off("select", onChange).off("reInit", onChange);
      };
    },
    [api]
  );

  const selected = React.useSyncExternalStore(
    subscribe,
    () => api?.selectedScrollSnap() ?? 0,
    () => 0
  );
  const count = React.useSyncExternalStore(
    subscribe,
    () => api?.scrollSnapList().length ?? 0,
    () => 0
  );

  if (count < 2) {
    return null;
  }

  return (
    <div className={cn("flex items-center gap-2", className)} {...props}>
      {Array.from({ length: count }, (_, index) => {
        const current = index === selected;
        return (
          <button
            key={index}
            type="button"
            aria-label={(labels.slide ?? "{n}").replace("{n}", String(index + 1))}
            aria-current={current ? "true" : undefined}
            onClick={() => api?.scrollTo(index)}
            // A 2px dash is a target nobody can hit. The button is the full
            // 24px tall and the dash inside it is the mark, which is the same
            // split the card gallery uses.
            className="group/dot flex h-6 items-center py-2"
          >
            <span
              aria-hidden
              className={cn(
                // The active marker stretches rather than swelling, so the row
                // keeps its baseline as the hero moves through it. Narrower on
                // a phone, where the strip sits centred under a full-bleed
                // banner rather than sharing the row with the arrows.
                "block h-0.5 rounded-full transition-all duration-300",
                current
                  ? "w-6 bg-accent sm:w-8"
                  : "w-3 bg-border-strong group-hover/dot:bg-muted sm:w-4"
              )}
            />
          </button>
        );
      })}
    </div>
  );
}

export type { CarouselApi };
