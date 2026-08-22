import { describe, expect, it } from "vitest";
import {
  EMPTY_PROFILE,
  formatBirthDate,
  isIsoDate,
  parseProfile,
  profileDisplayName,
  profileInitials,
} from "./profile";

describe("parseProfile", () => {
  it("returns the empty profile for anything that is not an object", () => {
    expect(parseProfile(null)).toEqual(EMPTY_PROFILE);
    expect(parseProfile("nope")).toEqual(EMPTY_PROFILE);
    expect(parseProfile([1, 2])).toEqual(EMPTY_PROFILE);
  });

  it("keeps known fields and trims them", () => {
    expect(
      parseProfile({ firstName: "  Aziz ", lastName: "Karimov", birthDate: "1990-05-12", gender: "male" })
    ).toEqual({ firstName: "Aziz", lastName: "Karimov", birthDate: "1990-05-12", gender: "male" });
  });

  it("drops an unusable date and an unknown gender", () => {
    expect(parseProfile({ birthDate: "12.05.1990", gender: "other" })).toEqual(EMPTY_PROFILE);
    expect(parseProfile({ birthDate: "2026-02-31" }).birthDate).toBe("");
  });
});

describe("isIsoDate", () => {
  it("accepts a real date and rejects a rolled-over one", () => {
    expect(isIsoDate("2000-02-29")).toBe(true);
    expect(isIsoDate("2001-02-29")).toBe(false);
    expect(isIsoDate("1990-5-12")).toBe(false);
  });
});

describe("formatBirthDate", () => {
  it("writes the local form", () => {
    expect(formatBirthDate("1990-05-12")).toBe("12.05.1990");
  });

  it("returns nothing for an unset or broken value", () => {
    expect(formatBirthDate("")).toBe("");
    expect(formatBirthDate("oops")).toBe("");
  });
});

describe("profileDisplayName", () => {
  it("joins the parts it has", () => {
    expect(profileDisplayName({ ...EMPTY_PROFILE, firstName: "Aziz" }, "+998 90")).toBe("Aziz");
    expect(
      profileDisplayName({ ...EMPTY_PROFILE, firstName: "Aziz", lastName: "Karimov" }, "+998 90")
    ).toBe("Aziz Karimov");
  });

  it("falls back to the phone when nothing was filled in", () => {
    expect(profileDisplayName(EMPTY_PROFILE, "+998 90 123-45-67")).toBe("+998 90 123-45-67");
  });
});

describe("profileInitials", () => {
  it("takes one letter from each name part", () => {
    expect(profileInitials({ ...EMPTY_PROFILE, firstName: "aziz", lastName: "karimov" }, "")).toBe("AK");
  });

  it("falls back to the last two digits of the phone", () => {
    expect(profileInitials(EMPTY_PROFILE, "+998 90 123-45-67")).toBe("67");
  });
});
