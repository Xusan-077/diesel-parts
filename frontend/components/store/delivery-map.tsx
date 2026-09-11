"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, MapPin } from "lucide-react";
import { loadYandexMaps, yandexMapsEnabled, type Ymaps3 } from "@/lib/yandex-maps/loader";
import type { ResolvedAddress } from "@/lib/yandex-maps/geocode";
import { SITE_LOCATION } from "@/lib/site-config";
import { cn } from "@/lib/utils";
import type { Locale } from "@/lib/i18n/locales";

/** `[longitude, latitude]` — the order every ymaps3 API takes. */
type LngLat = [number, number];

interface YMapInstance {
  addChild(child: unknown): YMapInstance;
  update(update: { location: { center: LngLat; zoom?: number; duration?: number } }): void;
  destroy(): void;
}
interface YMapMarkerInstance {
  update(update: { coordinates: LngLat }): void;
}

/** The handful of `ymaps3` constructors this component uses, typed just enough
 *  to build the map — the global itself is otherwise untyped (see loader.ts). */
type YMapCtor = new (container: HTMLElement, props: object) => YMapInstance;
type LayerCtor = new (props: object) => object;
type MarkerCtor = new (props: object, element: HTMLElement) => YMapMarkerInstance;
type ListenerCtor = new (props: object) => object;

export interface DeliveryMapProps {
  lang: Locale;
  /** Fired after the pin settles and the point reverse-geocodes. `address` is
   *  null when the geocoder had nothing to say about that spot. */
  onPointResolved: (result: { point: LngLat; address: ResolvedAddress | null }) => void;
  labels: {
    /** Instruction above the map. */
    hint: string;
    /** While the script is loading. */
    loading: string;
    /** Shown in place of the map if it cannot load — the address fields below
     *  it still work, so this is information, not an error. */
    error: string;
    /** Accessible name of the draggable pin. */
    pin: string;
  };
  className?: string;
}

type Status = "loading" | "ready" | "error";

const INITIAL_ZOOM = 13;

/**
 * The draggable pin the checkout delivery step uses to place an order on the
 * map. Starts centred on the showroom (a sensible "somewhere in Tashkent"),
 * and every drag or tap moves the pin and hands the new point up so the parent
 * can reverse-geocode it into the street/house fields.
 *
 * It renders a short notice instead of the map when no API key is configured
 * or the script fails — the parent keeps showing its manual address fields,
 * which is the whole fallback. The single shared `<script>` and the
 * double-`ready` guard live in `lib/yandex-maps/loader.ts`; the guard here is
 * against React re-running the effect (Strict Mode, a fast remount) and
 * leaving a second `YMap` bound to the same node — `cancelled` drops the
 * in-flight init and `destroy()` clears the finished one.
 */
export function DeliveryMap({ lang, onPointResolved, labels, className }: DeliveryMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<YMapInstance | null>(null);
  const markerRef = useRef<YMapMarkerInstance | null>(null);
  const [status, setStatus] = useState<Status>(yandexMapsEnabled ? "loading" : "error");

  // Keep the latest callback without making it an effect dependency — the map
  // is built once, and re-running that on every parent render would be the
  // double-init this component exists to avoid.
  const onResolvedRef = useRef(onPointResolved);
  useEffect(() => {
    onResolvedRef.current = onPointResolved;
  }, [onPointResolved]);

  useEffect(() => {
    if (!yandexMapsEnabled || !containerRef.current) {
      return;
    }

    let cancelled = false;
    const container = containerRef.current;

    const movePin = (point: LngLat) => {
      markerRef.current?.update({ coordinates: point });
      mapRef.current?.update({ location: { center: point, duration: 200 } });
      void reverseGeocode(point).then((address) => {
        if (!cancelled) {
          onResolvedRef.current({ point, address });
        }
      });
    };

    loadYandexMaps(lang)
      .then((ymaps3: Ymaps3) => {
        if (cancelled || mapRef.current) {
          return;
        }

        const YMap = ymaps3.YMap as unknown as YMapCtor;
        const YMapDefaultSchemeLayer = ymaps3.YMapDefaultSchemeLayer as unknown as LayerCtor;
        const YMapDefaultFeaturesLayer = ymaps3.YMapDefaultFeaturesLayer as unknown as LayerCtor;
        const YMapMarker = ymaps3.YMapMarker as unknown as MarkerCtor;
        const YMapListener = ymaps3.YMapListener as unknown as ListenerCtor;

        const start: LngLat = [SITE_LOCATION.lon, SITE_LOCATION.lat];

        const map = new YMap(container, { location: { center: start, zoom: INITIAL_ZOOM } });
        map.addChild(new YMapDefaultSchemeLayer({}));
        map.addChild(new YMapDefaultFeaturesLayer({}));

        const marker = new YMapMarker(
          {
            coordinates: start,
            draggable: true,
            mapFollowsOnDrag: true,
            onDragEnd: (coords: LngLat) => movePin(coords),
          },
          pinElement(labels.pin),
        );
        map.addChild(marker);

        map.addChild(
          new YMapListener({
            layer: "any",
            onClick: (_object: unknown, event: { coordinates?: LngLat }) => {
              if (event.coordinates) {
                movePin(event.coordinates);
              }
            },
          }),
        );

        mapRef.current = map;
        markerRef.current = marker;
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          console.warn(
            "[delivery-map] Yandex Maps unavailable, falling back to manual entry:",
            error,
          );
          setStatus("error");
        }
      });

    return () => {
      cancelled = true;
      mapRef.current?.destroy();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, [lang, labels.pin]);

  // No key configured at all: stay silent — the address fields below are the
  // whole experience, and a permanent warning on every delivery checkout would
  // only be noise. A key that is set but fails (a bad key, a blocked network)
  // does get the notice, so a misconfiguration is visible where it matters.
  if (!yandexMapsEnabled) {
    return null;
  }

  if (status === "error") {
    return (
      <div
        className={cn(
          "flex items-center gap-2.5 rounded-lg border border-border bg-surface-muted px-4 py-3 text-xs text-muted",
          className,
        )}
      >
        <AlertTriangle aria-hidden className="size-4 shrink-0 text-warning" />
        <span>{labels.error}</span>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <p className="flex items-center gap-1.5 text-xs text-muted">
        <MapPin aria-hidden className="size-3.5 shrink-0 text-accent-strong" />
        {labels.hint}
      </p>
      <div className="relative h-64 overflow-hidden rounded-lg border border-border bg-surface-muted md:h-72">
        <div ref={containerRef} className="absolute inset-0" />
        {status === "loading" ? (
          <p className="absolute inset-0 flex items-center justify-center text-xs text-muted">
            {labels.loading}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/** The pin dropped on the map — an accent teardrop with a soft ground shadow,
 *  drawn from tokens so it matches whichever accent the storefront is set to.
 *  The markup is a static literal; only `label` is dynamic and it is set as an
 *  attribute, never interpolated into the HTML. */
function pinElement(label: string): HTMLElement {
  const el = document.createElement("div");
  el.setAttribute("role", "img");
  el.setAttribute("aria-label", label);
  el.style.cssText =
    "transform:translate(-50%,-100%);width:28px;height:28px;filter:drop-shadow(0 2px 3px rgb(0 0 0/0.35))";
  el.innerHTML =
    '<svg viewBox="0 0 24 24" width="28" height="28" fill="var(--accent)" stroke="var(--accent-edge)" stroke-width="1">' +
    '<path d="M12 2c-3.87 0-7 3.13-7 7 0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7Z"/>' +
    '<circle cx="12" cy="9" r="2.5" fill="var(--accent-foreground)" stroke="none"/></svg>';
  return el;
}

async function reverseGeocode(point: LngLat): Promise<ResolvedAddress | null> {
  try {
    const response = await fetch(`/api/geo/reverse?lat=${point[1]}&lon=${point[0]}`);
    if (!response.ok) {
      return null;
    }
    const data = (await response.json()) as { address?: ResolvedAddress | null };
    return data.address ?? null;
  } catch {
    return null;
  }
}
