import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
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
 * left is darkened enough to set light type on, and the right is left alone, so
 * the part stays a photograph of a part.
 *
 * The scrim DARKENS. It used to lighten — two layers ramping to `--background`,
 * which was a cream and is now #ffffff, so the photograph was covered by an
 * opaque white veil on its left and an 80% one across the middle. That is the
 * difference between a scrim and a bleach: darkening a photograph keeps every
 * hue in it and only lowers the value, while a white veil desaturates towards
 * grey and takes the picture with it. The type reads either way; only one of
 * them still has a photograph underneath.
 *
 * The grid does not run over a photograph either. It is the *substitute* for
 * one — see the no-photograph case above — and laying ruled lines and a soft
 * radial mask over a real image is the haze this hero was carrying.
 *
 * A Server Component. The copy is the largest paint on the page and belongs in
 * the HTML; only `HeroLamp` ships any JavaScript, and only on the slides that
 * have no photograph.
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
    // Flat `bg-background`, not a gradient down from `background-subtle`. That
    // gradient put #f6f7f8 across the top of the first screen, so the page read
    // as grey at the fold however white the body underneath it was.
    //
    // `w-full` and no height of its own: the slide is a flex child of the
    // frame in hero.tsx (or of a carousel item inside it), so the frame's
    // height floor is what stretches it. It used to carry `min-h-full`, back
    // when it was the full-bleed hero and there was nothing above it to
    // measure against.
    <section className="relative isolate flex w-full flex-col overflow-hidden bg-background">
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
            One layer, one job: carry the type. A left-to-right ramp in the
            chrome's own near-black, heavy where the words are and gone before
            the subject. Nothing fades the photograph into the page at the
            bottom any more — that second layer ramped to white and was half of
            what bleached the picture; the hero's own bottom border ends it.
          */}
          <div
            aria-hidden
            className="absolute inset-0 -z-10 bg-linear-to-r from-chrome/95 via-chrome/70 to-transparent"
          />
        </>
      ) : (
        <HeroLamp />
      )}

      {/* The frame supplies the page gutter now, so this is the slide's own
          inset from the border rather than a second `Container`, which inside
          one would have re-applied `max-w-7xl` and centred the copy in a
          narrower column than the picture behind it. The values match
          `FRAME_GUTTER` in hero.tsx, which is what the carousel controls are
          aligned to. */}
      <div
        className={cn(
          // Mobile keeps this compact — a phone pays for every line of this
          // block in scroll before it reaches the carousel controls, let alone
          // the page below. `sm` and up restore the original roomier rhythm.
          // The bottom keeps more room than the top: the dot markers sit
          // `bottom-6` inside the frame (see FRAME_GUTTER in hero.tsx), and a
          // symmetric squeeze would run the CTA row straight into them.
          "relative flex flex-1 flex-col justify-center px-5 pt-6 pb-14 sm:px-10 sm:py-20 lg:px-14",
          // Centred on the grid, left over a photograph. `items-start` so the
          // buttons sit under the type rather than spanning the frame.
          hasImage ? "items-start text-left" : "text-center"
        )}
      >
        {/*
          Two colourways for one block of copy. On the grid the hero is part of
          the white page and takes the page's own foregrounds; over a photograph
          it sits on the darkened scrim and takes the chrome's, which are the
          same values the header and footer are set in and are already measured
          against that near-black. Nothing here is a one-off tint.
        */}
        <p
          className={cn(
            "hero-rise font-mono text-xs uppercase tracking-[0.2em]",
            hasImage ? "text-chrome-accent" : "text-accent-strong"
          )}
          style={{ animationDelay: "60ms" }}
        >
          {eyebrow}
        </p>

        <h1
          className={cn(
            "hero-rise mt-3 max-w-3xl text-balance text-3xl font-semibold tracking-tight sm:mt-5 sm:text-5xl lg:text-6xl",
            // The photograph slides cap the measure tighter: the right half of
            // the frame belongs to the part, so the type has to clear it.
            hasImage ? "max-w-xl text-chrome-foreground lg:max-w-2xl" : "mx-auto text-foreground"
          )}
          style={{ animationDelay: "140ms" }}
        >
          {title}
        </h1>

        <p
          className={cn(
            "hero-rise mt-3 max-w-2xl text-pretty text-base sm:mt-6 sm:text-lg",
            hasImage ? "max-w-lg text-chrome-secondary" : "mx-auto text-muted"
          )}
          style={{ animationDelay: "220ms" }}
        >
          {subtitle}
        </p>

        <div
          className={cn(
            "hero-rise mt-6 flex flex-wrap items-center gap-4 sm:mt-10",
            hasImage ? "justify-start" : "justify-center"
          )}
          style={{ animationDelay: "300ms" }}
        >
          <Link
            href={ctaHref}
            className="group inline-flex h-12 items-center gap-2 rounded-md bg-accent px-6 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover active:bg-accent-active"
          >
            {ctaLabel}
            <Icon
              icon={ArrowRight}
              className="transition-transform duration-200 group-hover:translate-x-0.5"
            />
          </Link>
          {/*
            The secondary action follows the copy. On the scrim it is an
            outline in the chrome's palette rather than a white block, which
            over a photograph would read as a second primary button.
          */}
          <Link
            href="/request-quote"
            className={cn(
              "inline-flex h-12 items-center rounded-md border px-6 text-sm font-medium transition-colors",
              hasImage
                ? "border-chrome-border-strong text-chrome-foreground hover:bg-chrome-hover"
                : "border-border-strong bg-surface text-foreground hover:bg-surface-hover"
            )}
          >
            {home.heroCtaQuote}
          </Link>
        </div>
      </div>
    </section>
  );
}
