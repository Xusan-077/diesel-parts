import { LocationCard } from "@/components/layout/location-card";
import { Container } from "@/components/ui/container";
import { SITE_LOCATION } from "@/lib/site-config";
import { yandexEmbedUrl } from "@/lib/map-links";
import type { Dictionary } from "@/lib/i18n/dictionaries";

const MAP_EMBED_URL = yandexEmbedUrl(SITE_LOCATION);

interface LocationSectionProps {
  footer: Dictionary["footer"];
}

/**
 * Where the shop is, as its own band directly above the footer.
 *
 * It used to be a block inside the footer, which buried a 256px map under the
 * nav and contact columns and pushed the copyright line a screen further down.
 * Out here it reads as the closing section of the page — the last thing a
 * visitor sees before the small print — and the footer goes back to being the
 * short chrome strip it is meant to be. It carries the site palette rather
 * than the footer's `chrome-*` tokens for the same reason: it is page content
 * now, not chrome.
 */
export function LocationSection({ footer }: LocationSectionProps) {
  return (
    <section aria-labelledby="location-heading" className="border-t border-border bg-background">
      <Container className="py-12 md:py-16">
        <h2
          id="location-heading"
          className="text-xl font-semibold tracking-tight text-foreground"
        >
          {footer.mapTitle}
        </h2>

        <LocationCard
          className="mt-5"
          address={footer.address}
          point={SITE_LOCATION}
          footer={footer}
        />

        {/*
          The address sits behind the iframe, so a map that fails to load
          (blocked network, offline) leaves something useful rather than a
          blank rectangle.
        */}
        <div className="relative mt-4 h-64 overflow-hidden rounded-lg border border-border bg-surface md:h-80">
          <p className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-muted">
            {footer.address}
          </p>
          <iframe
            src={MAP_EMBED_URL}
            title={footer.mapAlt}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="relative h-full w-full border-0"
          />
        </div>
      </Container>
    </section>
  );
}
