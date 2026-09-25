import { NextResponse } from "next/server";
import { parseReverseGeocode } from "@/lib/yandex-maps/geocode";

/**
 * Reverse-geocodes a dropped pin for the checkout delivery map.
 *
 * A thin proxy to Yandex's HTTP geocoder: that endpoint sends no CORS headers
 * so the browser cannot call it directly, and routing through here also keeps
 * the API key out of the page's own network log. The key is the same
 * `NEXT_PUBLIC_YANDEX_MAPS_API_KEY` the JS map loads with — Yandex's
 * "JavaScript API and Geocoder" key type covers both.
 *
 * The map is a convenience, not a requirement: every failure answers with a
 * status the client treats as "keep the fields, let them type", never an error
 * that blocks checkout.
 */

const GEOCODER_URL = "https://geocode-maps.yandex.ru/1.x/";
const KEY = process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY;

export async function GET(request: Request) {
  if (!KEY) {
    return NextResponse.json({ error: "unconfigured" }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get("lat"));
  const lon = Number(searchParams.get("lon"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return NextResponse.json({ error: "bad_coords" }, { status: 400 });
  }

  const upstream = new URL(GEOCODER_URL);
  upstream.searchParams.set("apikey", KEY);
  upstream.searchParams.set("format", "json");
  upstream.searchParams.set("lang", "ru_RU");
  upstream.searchParams.set("kind", "house");
  upstream.searchParams.set("results", "1");
  // Yandex takes longitude first.
  upstream.searchParams.set("geocode", `${lon},${lat}`);

  try {
    const response = await fetch(upstream, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) {
      return NextResponse.json({ error: "upstream" }, { status: 502 });
    }
    const address = parseReverseGeocode(await response.json());
    return NextResponse.json({ address });
  } catch (error) {
    console.error("[api/geo/reverse] geocoder request failed:", error);
    return NextResponse.json({ error: "upstream" }, { status: 502 });
  }
}
