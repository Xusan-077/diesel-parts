import { describe, expect, it } from "vitest";
import { parseReverseGeocode } from "./geocode";

/** A trimmed copy of a real `geocode-maps.yandex.ru/1.x/?format=json` reply. */
function envelope(components: { kind: string; name: string }[], text = "Узбекистан, Ташкент") {
  return {
    response: {
      GeoObjectCollection: {
        featureMember: [
          {
            GeoObject: {
              metaDataProperty: {
                GeocoderMetaData: {
                  text,
                  Address: { Components: components },
                },
              },
            },
          },
        ],
      },
    },
  };
}

describe("parseReverseGeocode", () => {
  it("pulls street, house and district out of the component list", () => {
    const result = parseReverseGeocode(
      envelope([
        { kind: "country", name: "Узбекистан" },
        { kind: "locality", name: "Ташкент" },
        { kind: "district", name: "Мирзо-Улугбекский район" },
        { kind: "street", name: "улица Буюк Ипак Йули" },
        { kind: "house", name: "12А" },
      ]),
    );

    expect(result).toEqual({
      full: "Узбекистан, Ташкент",
      street: "улица Буюк Ипак Йули",
      house: "12А",
      district: "Мирзо-Улугбекский район",
      city: "Ташкент",
    });
  });

  it("falls back to `area` when there is no inner-city district", () => {
    const result = parseReverseGeocode(
      envelope([
        { kind: "area", name: "Зангиатинский район" },
        { kind: "street", name: "улица А" },
      ]),
    );

    expect(result?.district).toBe("Зангиатинский район");
  });

  it("returns null for an empty feature list", () => {
    expect(
      parseReverseGeocode({ response: { GeoObjectCollection: { featureMember: [] } } }),
    ).toBeNull();
  });

  it("returns null for a malformed payload rather than throwing", () => {
    expect(parseReverseGeocode(null)).toBeNull();
    expect(parseReverseGeocode({})).toBeNull();
    expect(parseReverseGeocode({ response: 42 })).toBeNull();
  });

  it("keeps a result that has only a formatted line, no components", () => {
    const result = parseReverseGeocode(envelope([], "Ташкент, площадь Мустакиллик"));
    expect(result).toEqual({
      full: "Ташкент, площадь Мустакиллик",
      street: undefined,
      house: undefined,
      district: undefined,
      city: undefined,
    });
  });
});
