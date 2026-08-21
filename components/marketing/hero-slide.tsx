import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import type { HeroSlide as Slide } from "@/lib/data/hero-slides";
import { HeroLamp } from "./hero-lamp";

/**
 * One hero: a headline, two buttons, and — when the slide names one — a
 * photograph behind them.
 *
 * The two cases are laid out differently, because they are different pictures.
 *
 * With no photograph, the inspection grid *is* the image and the copy is
 * centred on it: the grid is symmetrical, and the ruled module reading behind
 * centred type is what makes this hero this site's rather than every other
 * supplier's.
 *
 * With a photograph, the copy moves left. Every hero photograph here puts its
 * subject on the right — that is what `public/hero/README.md` asks for, because
 * a headline centred over a turbocharger is unreadable however the scrim is
 * tuned. So the scrim is a left-to-right gradient rather than a flat wash: the
 * left half is darkened enough to set white type on, and the right half is left
 * alone, so the part stays a photograph of a part.
 *
 * A Server Component. The copy is the largest paint on the page and belongs in
 * the HTML; only `HeroLamp` ships any JavaScript.
 */
export function HeroSlide({
  slide,
  home,
  lang,
  /** Only the first slide is worth preloading; the rest are six seconds away. */
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
            Two layers doing two jobs. The horizontal one carries the type: it
            is opaque at the left edge, where the words are, and gone by the
            middle. The vertical one is a thin wash that ties the picture into
            the page below it, and is far too light to grey out the subject.
          */}
          <div
            aria-hidden
            className="absolute inset-0 -z-10 bg-linear-to-r from-background via-background/80 to-transparent"
          />
          <div
            aria-hidden
            className="absolute inset-0 -z-10 bg-linear-to-b from-background/30 via-transparent to-background"
          />
        </>
      ) : null}

      <HeroLamp />

      <Container
        className={cn(
          "relative flex flex-1 flex-col justify-center py-20 sm:py-28",
          // Centred on the grid, left over a photograph. `items-start` so the
          // buttons sit under the type rather than spanning the frame.
          hasImage ? "items-start text-left" : "text-center"
        )}
      >
        <p
          className="hero-rise font-mono text-xs uppercase tracking-[0.2em] text-accent-strong"
          style={{ animationDelay: "60ms" }}
        >
          {eyebrow}
        </p>

        <h1
          className={cn(
            "hero-rise mt-5 max-w-3xl text-balance text-4xl font-semibold tracking-tight text-foreground sm:text-6xl",
            // The photograph slides cap the measure tighter: the right half of
            // the frame belongs to the part, so the type has to clear it.
            hasImage ? "max-w-xl lg:max-w-2xl" : "mx-auto"
          )}
          style={{ animationDelay: "140ms" }}
        >
          {title}
        </h1>

        <p
          className={cn(
            "hero-rise mt-6 max-w-2xl text-pretty text-lg text-muted",
            hasImage ? "max-w-lg" : "mx-auto"
          )}
          style={{ animationDelay: "220ms" }}
        >
          {subtitle}
        </p>

        <div
          className={cn(
            "hero-rise mt-10 flex flex-wrap items-center gap-4",
            hasImage ? "justify-start" : "justify-center"
          )}
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
