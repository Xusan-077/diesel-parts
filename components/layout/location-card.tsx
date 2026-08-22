import { ExternalLink, MapPin } from "lucide-react";
import { Icon } from "@/components/ui/icon";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  formatCoordinates,
  googleMapsUrl,
  yandexMapsUrl,
  type GeoPoint,
} from "@/lib/map-links";
import type { Dictionary } from "@/lib/i18n/dictionaries";

interface LocationCardProps {
  /** Street address, shown as the human-readable half of the pin. */
  address: string;
  point: GeoPoint;
  footer: Dictionary["footer"];
  className?: string;
}

/**
 * The address, its coordinates, and a way out to either map service.
 *
 * The embed below it is a picture: it cannot start a route, and on a phone the
 * useful move is handing the point to the installed maps app. Both services
 * are here because which one is installed splits roughly evenly locally, and
 * both links carry coordinates rather than a search string so neither has to
 * guess at a transliterated street name.
 */
export function LocationCard({ address, point, footer, className }: LocationCardProps) {
  const coordinates = formatCoordinates(point);

  const destinations = [
    { key: "yandex", href: yandexMapsUrl(point), label: footer.yandexCta, variant: "default" as const },
    { key: "google", href: googleMapsUrl(point), label: footer.googleCta, variant: "outline" as const },
  ];

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-surface p-5",
        "flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6",
        className
      )}
    >
      <div className="flex gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent-strong">
          <Icon icon={MapPin} size="md" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{address}</p>
          {/*
            Tabular figures keep the two coordinates from jittering against
            each other, and the label makes the number pair mean something to
            a screen reader arriving at it cold.
          */}
          <p className="mt-1 text-xs text-muted">
            <span className="text-foreground">{footer.coordinatesLabel}: </span>
            <span className="font-mono tabular-nums">{coordinates}</span>
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 sm:shrink-0">
        {destinations.map((destination) => (
          <a
            key={destination.key}
            href={destination.href}
            target="_blank"
            rel="noreferrer"
            className={cn(buttonVariants({ variant: destination.variant, size: "sm" }))}
          >
            {destination.label}
            <Icon icon={ExternalLink} size="xs" />
          </a>
        ))}
      </div>
    </div>
  );
}
