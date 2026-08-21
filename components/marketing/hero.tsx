import {
  Carousel,
  CarouselAutoplayToggle,
  CarouselContent,
  CarouselDots,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Container } from "@/components/ui/container";
import { HERO_AUTOPLAY_DELAY, heroSlides } from "@/lib/data/hero-slides";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
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
      <div className="border-b border-border">
        <HeroSlide slide={heroSlides[0]} home={home} lang={lang} priority />
      </div>
    );
  }

  return (
    <Carousel
      labels={{
        region: home.heroCarouselLabel,
        prev: common.carouselPrev,
        next: common.carouselNext,
        pause: common.carouselPause,
        play: common.carouselPlay,
        slide: common.carouselSlide,
      }}
      autoplay
      autoplayDelay={HERO_AUTOPLAY_DELAY}
      opts={{ loop: true, align: "start" }}
      className="border-b border-border"
    >
      {/* `items-stretch` so every slide is as tall as the tallest — otherwise
          the page height changes each time a shorter headline comes round. */}
      <CarouselContent className="ml-0 items-stretch">
        {heroSlides.map((slide, index) => (
          <CarouselItem key={slide.image} className="pl-0">
            <HeroSlide slide={slide} home={home} lang={lang} priority={index === 0} />
          </CarouselItem>
        ))}
      </CarouselContent>

      {/*
        Controls sit inside the hero on its bottom edge rather than floating
        over the middle of the picture, where they would land on the headline
        at some viewport width. Dots lead, because on a phone they are the only
        control that says how many slides there are; the arrows and the stop
        button are for pointer and keyboard users and appear from `sm` up.
      */}
      <Container className="pointer-events-none absolute inset-x-0 bottom-6 flex items-center justify-between gap-4">
        <CarouselDots className="pointer-events-auto" />
        <div className="pointer-events-auto hidden items-center gap-2 sm:flex">
          <CarouselAutoplayToggle />
          <CarouselPrevious />
          <CarouselNext />
        </div>
      </Container>
    </Carousel>
  );
}
