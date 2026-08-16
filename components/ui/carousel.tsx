"use client";

import * as React from "react";
import useEmblaCarousel, { type UseEmblaCarouselType } from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { Icon } from "./icon";

type CarouselApi = UseEmblaCarouselType[1];
type EmblaOptions = Parameters<typeof useEmblaCarousel>[0];

export interface CarouselLabels {
  /** Names the region, e.g. "Popular products". */
  region: string;
  prev: string;
  next: string;
  /** Shown while autoplay is running — the button stops it. */
  pause: string;
  /** Shown while autoplay is stopped — the button starts it. */
  play: string;
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
  /** Advance on a timer. Stops on hover, focus and any manual interaction. */
  autoplay?: boolean;
  /** Milliseconds between automatic advances. */
  autoplayDelay?: number;
  setApi?: (api: CarouselApi) => void;
}

export function Carousel({
  opts,
  labels,
  autoplay = false,
  autoplayDelay = 5000,
  setApi,
  className,
  children,
  ...props
}: CarouselProps) {
  /*
   * The plugin instance has to survive re-renders — a fresh one each render
   * would restart the timer and make the track stutter. A lazy `useState`
   * initialiser builds it exactly once and is safe to read while rendering,
   * which a ref is not.
   */
  const [autoplayPlugin] = React.useState(() =>
    Autoplay({
      delay: autoplayDelay,
      stopOnMouseEnter: true,
      stopOnFocusIn: true,
      // Once the reader takes over, stay out of their way for good.
      stopOnInteraction: true,
    })
  );

  const plugins = React.useMemo(
    () => (autoplay ? [autoplayPlugin] : []),
    [autoplay, autoplayPlugin]
  );

  const [carouselRef, api] = useEmblaCarousel(
    { align: "start", containScroll: "trimSnaps", ...opts },
    plugins
  );

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

export function CarouselContent({ className, ...props }: React.ComponentProps<"div">) {
  const { carouselRef } = useCarousel();
  return (
    // `overflow-hidden` clips the track; the negative margin pairs with the
    // padding on each item so the first card still lines up with the gutter.
    <div ref={carouselRef} className="overflow-hidden">
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
 * Explicit stop/start for the autoplay timer. Required whenever motion starts
 * on its own: hover and focus pauses do not help a reader who is neither
 * hovering nor tabbing, and reduced-motion users need a way to end it outright.
 */
export function CarouselAutoplayToggle({
  className,
  ...props
}: React.ComponentProps<"button">) {
  const { api, labels } = useCarousel();

  const subscribe = React.useCallback(
    (onChange: () => void) => {
      if (!api) return () => {};
      api.on("autoplay:play", onChange).on("autoplay:stop", onChange).on("reInit", onChange);
      return () => {
        api.off("autoplay:play", onChange).off("autoplay:stop", onChange).off("reInit", onChange);
      };
    },
    [api]
  );

  const isPlaying = React.useSyncExternalStore(
    subscribe,
    () => api?.plugins()?.autoplay?.isPlaying() ?? false,
    () => false
  );

  function toggle() {
    const autoplayApi = api?.plugins()?.autoplay;
    if (!autoplayApi) return;
    if (autoplayApi.isPlaying()) {
      autoplayApi.stop();
    } else {
      autoplayApi.play();
    }
  }

  if (!api?.plugins()?.autoplay) {
    return null;
  }

  return (
    <button
      type="button"
      aria-label={isPlaying ? labels.pause : labels.play}
      onClick={toggle}
      className={cn(navButtonClass, className)}
      {...props}
    >
      <Icon icon={isPlaying ? Pause : Play} size="md" />
    </button>
  );
}

export type { CarouselApi };
