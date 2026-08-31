/**
 * Links to the office pin on the two map services people here actually use.
 *
 * The two services disagree about coordinate order — Yandex takes
 * `longitude,latitude`, Google takes `latitude,longitude` — and getting that
 * backwards drops the pin in the Indian Ocean rather than failing loudly. So a
 * point is stored as named fields and every URL is built here, never inline at
 * a call site.
 */
export interface GeoPoint {
  /** Latitude, degrees north. */
  lat: number;
  /** Longitude, degrees east. */
  lon: number;
}

/** Street-level zoom: the building is identifiable, the district still fits. */
export const MAP_ZOOM = 15;

/**
 * Both services accept far more precision than a doorway needs. Six decimals
 * is ~0.1 m, and pinning the string form here keeps the rendered coordinates
 * identical to the ones in the links.
 */
const PRECISION = 6;

function lonLat(point: GeoPoint): string {
  return `${point.lon.toFixed(PRECISION)},${point.lat.toFixed(PRECISION)}`;
}

function latLon(point: GeoPoint): string {
  return `${point.lat.toFixed(PRECISION)},${point.lon.toFixed(PRECISION)}`;
}

/** Human-readable coordinates, in the conventional latitude-first order. */
export function formatCoordinates(point: GeoPoint): string {
  return `${point.lat.toFixed(PRECISION)}, ${point.lon.toFixed(PRECISION)}`;
}

/**
 * The full Yandex Maps site. `ll` centres the view, `pt` draws the marker —
 * without `pt` the map opens on the right spot with nothing marked on it.
 */
export function yandexMapsUrl(point: GeoPoint, zoom: number = MAP_ZOOM): string {
  const params = new URLSearchParams({
    ll: lonLat(point),
    pt: lonLat(point),
    z: String(zoom),
  });
  return `https://yandex.uz/maps/?${params}`;
}

/**
 * The embeddable widget build of the same view. `pm2rdm` is Yandex's red
 * medium placemark; the widget draws no marker at all if the style is omitted.
 */
export function yandexEmbedUrl(point: GeoPoint, zoom: number = MAP_ZOOM): string {
  const params = new URLSearchParams({
    ll: lonLat(point),
    pt: `${lonLat(point)},pm2rdm`,
    z: String(zoom),
  });
  return `https://yandex.uz/map-widget/v1/?${params}`;
}

/**
 * Google's documented cross-platform search URL. It hands off to the native
 * app on a phone, which is the whole reason to link coordinates rather than a
 * transliterated street name Google may not resolve.
 */
export function googleMapsUrl(point: GeoPoint): string {
  const params = new URLSearchParams({ api: "1", query: latLon(point) });
  return `https://www.google.com/maps/search/?${params}`;
}
