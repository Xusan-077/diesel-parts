import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Icon } from "@/components/ui/icon";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import { HeroLamp } from "./hero-lamp";

/**
 * Stays a server component. Only `HeroLamp` ships JavaScript, so the headline —
 * the largest paint on the page — is in the initial HTML and the entrance runs
 * on CSS keyframes rather than waiting for hydration.
 */
export function Hero({ lang, home }: { lang: Locale; home: Dictionary["home"] }) {
  return (
    <section className="relative isolate overflow-hidden border-b border-border bg-linear-to-b from-surface-muted via-background to-background">
      <HeroLamp />

      <Container className="relative py-20 text-center sm:py-28">
        <p
          className="hero-rise font-mono text-xs uppercase tracking-[0.2em] text-accent-strong"
          style={{ animationDelay: "60ms" }}
        >
          {home.heroEyebrow}
        </p>

        <h1
          className="hero-rise mx-auto mt-5 max-w-3xl text-balance text-4xl font-semibold tracking-tight text-foreground sm:text-6xl"
          style={{ animationDelay: "140ms" }}
        >
          {home.heroTitle}
        </h1>

        <p
          className="hero-rise mx-auto mt-6 max-w-2xl text-pretty text-lg text-muted"
          style={{ animationDelay: "220ms" }}
        >
          {home.heroSubtitle}
        </p>

        <div
          className="hero-rise mt-10 flex flex-wrap items-center justify-center gap-4"
          style={{ animationDelay: "300ms" }}
        >
          <Link
            href={`/${lang}/products`}
            className="group inline-flex h-12 items-center gap-2 rounded-md bg-accent px-6 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/90"
          >
            {home.heroCtaCatalog}
            <Icon
              icon={ArrowRight}
              className="transition-transform duration-200 group-hover:translate-x-0.5"
            />
          </Link>
          <Link
            href={`/${lang}/request-quote`}
            className="inline-flex h-12 items-center rounded-md border border-border bg-surface/60 px-6 text-sm font-medium text-foreground backdrop-blur-sm transition-colors hover:bg-surface-hover"
          >
            {home.heroCtaQuote}
          </Link>
        </div>
      </Container>
    </section>
  );
}
