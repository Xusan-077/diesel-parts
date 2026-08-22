import {
  Carousel,
  CarouselContent,
  CarouselDots,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Container } from "@/components/ui/container";
import { heroSlides } from "@/lib/data/hero-slides";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import { cn } from "@/lib/utils";
import { HeroSlide } from "./hero-slide";

/**
 * The home page hero.
 *
 * Three shapes from one list, so the site works before a single photograph is
 * uploaded and improves as they arrive:
 *
 *  - no slides — the copy over the inspection grid, exactly as before
 *  - one slide — the same, with that photograph behind it
 *  - two or more — a carousel
 *
 * Only the third case ships carousel JavaScript. The first two stay entirely
 * server-rendered, which matters because the headline is this page's largest
 * paint.
 */

/*
 * The frame.
 *
 * The hero used to run edge to edge and end in a hairline rule, which is the
 * arrangement that reads as "this photograph is the top of the site". It is
 * now a card on the page instead: same gutter as every section below it, a
 * real border on all four sides, and the page's white showing round it.
 *
 * That trade is deliberate. A full-bleed hero owns the first screen and the
 * header floats on top of it; a framed one hands the first screen back to the
 * page, so the white header plate above it and the trust badges below it read
 * as one document rather than as chrome wrapped around a poster.
 *
 * Losing the viewport as a height source means the frame has to name one, and
 * it names a floor rather than a fixed height — a long headline in Russian
 * makes the hero taller instead of clipping.
 *
 * `flex` matters: `items-stretch` on the track equalises the *items*, and a
 * block child does not fill the item it sits in. The slide is a flex child of
 * the frame (or of the carousel item) so the stretch reaches it.
 */
const FRAME =
  "relative flex overflow-hidden rounded-xl border border-border min-h-[26rem] sm:min-h-[30rem] lg:min-h-[34rem]";

/** Matches the slide's own gutter, so the controls line up with the copy. */
const FRAME_GUTTER = "px-6 sm:px-10 lg:px-14";

export function Hero({
  home,
  common,
  lang,
}: {
  home: Dictionary["home"];
  common: Dictionary["common"];
  lang: Locale;
}) {
  if (heroSlides.length <= 1) {
    return (
      <Container className="pt-6 sm:pt-8">
        <div className={FRAME}>
          <HeroSlide slide={heroSlides[0]} home={home} lang={lang} priority />
        </div>
      </Container>
    );
  }

  return (
    <Container className="pt-6 sm:pt-8">
      <Carousel
        labels={{
          region: home.heroCarouselLabel,
          prev: common.carouselPrev,
          next: common.carouselNext,
          slide: common.carouselSlide,
        }}
        opts={{ loop: true, align: "start" }}
        className={FRAME}
      >
        {/* `items-stretch` so every slide is as tall as the tallest — otherwise
            the frame's height changes each time a shorter headline comes round.
            The viewport is a flex child of the frame and the track a flex child
            of the viewport, so the frame's floor reaches the slides. */}
        <CarouselContent className="ml-0 h-full w-full items-stretch" viewportClassName="w-full">
          {heroSlides.map((slide, index) => (
            <CarouselItem key={slide.image} className="flex pl-0">
              <HeroSlide slide={slide} home={home} lang={lang} priority={index === 0} />
            </CarouselItem>
          ))}
        </CarouselContent>

        {/*
          Controls sit inside the hero on its bottom edge rather than floating
          over the middle of the picture, where they would land on the headline
          at some viewport width. The markers lead, because on a phone they are
          both the only control that says how many slides there are and the only
          way to reach one directly; the arrows are for pointer and keyboard
          users and appear from `sm` up.
        */}
        <div
          className={cn(
            "pointer-events-none absolute inset-x-0 bottom-6 flex items-center justify-between gap-4",
            FRAME_GUTTER
          )}
        >
          <CarouselDots className="pointer-events-auto" />
          <div className="pointer-events-auto hidden items-center gap-2 sm:flex">
            <CarouselPrevious />
            <CarouselNext />
          </div>
        </div>
      </Carousel>
    </Container>
  );
}
