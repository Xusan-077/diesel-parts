import { describe, expect, it } from "vitest";
import { mailtoHref, telHref, whatsappHref } from "./contact-links";

describe("telHref", () => {
  it("dials the canonical number whatever the customer typed", () => {
    expect(telHref("+998 90 123-45-67")).toBe("tel:+998901234567");
    expect(telHref("901234567")).toBe("tel:+998901234567");
  });

  it("still offers a half-written number rather than dropping the button", () => {
    expect(telHref("+7 916 555")).toBe("tel:+7916555");
  });

  it("has nothing to offer when there are no digits at all", () => {
    expect(telHref("qo'ng'iroq qiling")).toBeNull();
  });
});

describe("whatsappHref", () => {
  it("hands wa.me the digits with the country code and no plus", () => {
    expect(whatsappHref("+998 90 123-45-67")).toBe("https://wa.me/998901234567");
  });

  it("withholds the link when there is no country code to guess", () => {
    // Opening WhatsApp on a number that resolves to nobody is worse than not
    // offering the button.
    expect(whatsappHref("90 123")).toBeNull();
  });
});

describe("mailtoHref", () => {
  it("carries the subject through, escaped", () => {
    expect(mailtoHref("a@b.uz", "So'rov bo'yicha")).toBe(
      "mailto:a@b.uz?subject=So'rov%20bo'yicha",
    );
  });

  it("has nothing to offer without an address", () => {
    expect(mailtoHref(null, "x")).toBeNull();
    expect(mailtoHref("  ", "x")).toBeNull();
  });
});
