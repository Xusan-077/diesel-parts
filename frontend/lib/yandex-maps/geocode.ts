/**
 * Turning a Yandex HTTP-geocoder reply into the four fields the checkout
 * address form actually has.
 *
 * The reverse call goes through `/api/geo/reverse` (route.ts) rather than
 * straight to `geocode-maps.yandex.ru`: that endpoint sends no CORS headers, so
 * a browser `fetch` to it fails, and proxying also keeps the key out of the
 * page's network log. The parse is split out here so it can be unit-tested
 * without a live key.
 */

export interface ResolvedAddress {
  /** The whole line Yandex formatted, e.g. "Узбекистан, Ташкент, улица …, 12". */
  full: string;
  street?: string;
  house?: string;
  district?: string;
  city?: string;
}

/** One `{ kind, name }` entry of `GeocoderMetaData.Address.Components`. */
interface AddressComponent {
  kind?: string;
  name?: string;
}

/** Reads `response.GeoObjectCollection.featureMember[0]` defensively — every
 *  level of the Yandex envelope is optional as far as the types go. */
export function parseReverseGeocode(payload: unknown): ResolvedAddress | null {
  const geoObject = firstGeoObject(payload);
  if (!geoObject) {
    return null;
  }

  const meta = pick(pick(geoObject, "metaDataProperty"), "GeocoderMetaData");
  const full = typeof pick(meta, "text") === "string" ? (pick(meta, "text") as string) : "";

  const components = componentList(meta);
  const byKind = (kind: string): string | undefined =>
    components.find((component) => component.kind === kind)?.name || undefined;

  const resolved: ResolvedAddress = {
    full,
    street: byKind("street"),
    house: byKind("house"),
    // Yandex tags an inner-city district as `district`; where there is none it
    // often carries an `area` (a raion), which is the same slot on the form.
    district: byKind("district") ?? byKind("area"),
    city: byKind("locality") ?? byKind("province"),
  };

  // Nothing usable came back — a pin dropped in open country, say.
  if (!resolved.full && !resolved.street && !resolved.house) {
    return null;
  }
  return resolved;
}

function pick(value: unknown, key: string): unknown {
  if (value !== null && typeof value === "object" && key in value) {
    return (value as Record<string, unknown>)[key];
  }
  return undefined;
}

function firstGeoObject(payload: unknown): unknown {
  const collection = pick(pick(payload, "response"), "GeoObjectCollection");
  const members = pick(collection, "featureMember");
  if (!Array.isArray(members) || members.length === 0) {
    return undefined;
  }
  return pick(members[0], "GeoObject");
}

function componentList(meta: unknown): AddressComponent[] {
  const components = pick(pick(meta, "Address"), "Components");
  if (!Array.isArray(components)) {
    return [];
  }
  return components.filter(
    (entry): entry is AddressComponent => entry !== null && typeof entry === "object",
  );
}
