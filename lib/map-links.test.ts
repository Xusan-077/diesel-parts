import { describe, expect, it } from "vitest";
import {
  formatCoordinates,
  googleMapsUrl,
  MAP_ZOOM,
  yandexEmbedUrl,
  yandexMapsUrl,
  type GeoPoint,
} from "./map-links";

const office: GeoPoint = { lat: 41.186136, lon: 69.196655 };

describe("map links", () => {
  it("prints coordinates latitude first", () => {
    expect(formatCoordinates(office)).toBe("41.186136, 69.196655");
  });

  it("pads coordinates to a fixed precision", () => {
    expect(formatCoordinates({ lat: 41.5, lon: 69 })).toBe("41.500000, 69.000000");
  });

  it("centres and marks the Yandex map at the point, longitude first", () => {
    const url = new URL(yandexMapsUrl(office));
    expect(url.origin + url.pathname).toBe("https://yandex.uz/maps/");
    expect(url.searchParams.get("ll")).toBe("69.196655,41.186136");
    expect(url.searchParams.get("pt")).toBe("69.196655,41.186136");
    expect(url.searchParams.get("z")).toBe(String(MAP_ZOOM));
  });

  it("takes a zoom override", () => {
    expect(new URL(yandexMapsUrl(office, 17)).searchParams.get("z")).toBe("17");
  });

  it("asks the Yandex widget for a visible placemark", () => {
    const url = new URL(yandexEmbedUrl(office));
    expect(url.origin + url.pathname).toBe("https://yandex.uz/map-widget/v1/");
    expect(url.searchParams.get("pt")).toBe("69.196655,41.186136,pm2rdm");
    expect(url.searchParams.get("ll")).toBe("69.196655,41.186136");
  });

  it("queries Google by latitude-first coordinates", () => {
    const url = new URL(googleMapsUrl(office));
    expect(url.origin + url.pathname).toBe("https://www.google.com/maps/search/");
    expect(url.searchParams.get("api")).toBe("1");
    expect(url.searchParams.get("query")).toBe("41.186136,69.196655");
  });
});
