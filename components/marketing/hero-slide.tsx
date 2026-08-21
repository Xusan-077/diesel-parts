import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Icon } from "@/components/ui/icon";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import type { HeroSlide as Slide } from "@/lib/data/hero-slides";
import { HeroLamp } from "./hero-lamp";

/**
 * One hero: a headline, two buttons, and — when the slide names one — a
 * photograph behind them.
 *
 * The inspection grid stays on top of the picture rather than being replaced
 * by it. The grid is the thing that makes this hero *this* site's hero, and a
 * photograph with a headline over it is every other supplier's. Reading the
 * ruled module over a real workshop is the point: the part is being measured,
 * not merchandised.
 *
 * A Server Component. The copy is the largest paint on the page and belongs in
 * the HTML; only `HeroLamp` ships any JavaScript.
 */
export function HeroSlide({
  slide,
  home,
  lang,
  /** Only the first slide is worth preloading; the rest are five seconds away. */
  priority = false,
}: {
  slide?: Slide;
  home: Dictionary["home"];
  lang: Locale;
  priority?: boolean;
}) {
  const eyebrow = slide?.eyebrow?.[lang] ?? home.heroEyebrow;
  const title = slide?.title?.[lang] ?? home.heroTitle;
  const subtitle = slide?.subtitle?.[lang] ?? home.heroSubtitle;
  const ctaLabel = slide?.cta?.label[lang] ?? home.heroCtaCatalog;
  const ctaHref = slide?.cta?.href ?? "/products";
  const hasImage = slide !== undefined;

  return (
    <section className="relative isolate flex min-h-full flex-col overflow-hidden bg-linear-to-b from-surface-muted via-background to-background">
      {hasImage ? (
        <>
          <Image
            src={`/hero/${slide.image}`}
            alt={slide.alt[lang]}
            fill
            priority={priority}
            sizes="100vw"
            className="-z-10 object-cover"
          />
          {/*
            The scrim is a gradient rather than a flat wash: the copy is
            centred and the picture should stay a picture at the edges. Two
            layers, because one dark enough for white text over a bright
            workshop would grey out the whole frame.
          */}
          <div
            aria-hidden
            className="absolute inset-0 -z-10 bg-background/70 backdrop-blur-[2px]"
          />
          <div
            aria-hidden
            className="absolute inset-0 -z-10 bg-linear-to-b from-background/80 via-background/40 to-background"
          />
        </>
      ) : null}

      <HeroLamp />

      <Container className="relative flex flex-1 flex-col justify-center py-20 text-center sm:py-28">
        <p
          className="hero-rise font-mono text-xs uppercase tracking-[0.2em] text-accent-strong"
          style={{ animationDelay: "60ms" }}
        >
          {eyebrow}
        </p>

        <h1
          className="hero-rise mx-auto mt-5 max-w-3xl text-balance text-4xl font-semibold tracking-tight text-foreground sm:text-6xl"
          style={{ animationDelay: "140ms" }}
        >
          {title}
        </h1>

        <p
          className="hero-rise mx-auto mt-6 max-w-2xl text-pretty text-lg text-muted"
          style={{ animationDelay: "220ms" }}
        >
          {subtitle}
        </p>

        <div
          className="hero-rise mt-10 flex flex-wrap items-center justify-center gap-4"
          style={{ animationDelay: "300ms" }}
        >
          <Link
            href={ctaHref}
            className="group inline-flex h-12 items-center gap-2 rounded-md bg-accent px-6 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/90"
          >
            {ctaLabel}
            <Icon
              icon={ArrowRight}
              className="transition-transform duration-200 group-hover:translate-x-0.5"
            />
          </Link>
          <Link
            href="/request-quote"
            className="inline-flex h-12 items-center rounded-md border border-border bg-surface/60 px-6 text-sm font-medium text-foreground backdrop-blur-sm transition-colors hover:bg-surface-hover"
          >
            {home.heroCtaQuote}
          </Link>
        </div>
      </Container>
    </section>
  );
}
