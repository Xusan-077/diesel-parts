import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime } from "./format";

describe("formatDate", () => {
  it("renders a fixed dd.mm.yyyy string in Tashkent time", () => {
    expect(formatDate("2026-09-09T11:11:00.000Z")).toBe("09.09.2026");
  });

  it("rolls into the next day once the UTC instant crosses Tashkent midnight", () => {
    // 20:30 UTC = 01:30 next day in UTC+5.
    expect(formatDate("2026-01-31T20:30:00.000Z")).toBe("01.02.2026");
  });

  it("accepts a Date as well as an ISO string", () => {
    expect(formatDate(new Date("2026-12-01T00:00:00.000Z"))).toBe("01.12.2026");
  });
});

describe("formatDateTime", () => {
  it("renders dd.mm.yyyy HH:mm in 24-hour Tashkent time", () => {
    expect(formatDateTime("2026-09-09T11:11:00.000Z")).toBe("09.09.2026 16:11");
  });

  it("keeps midnight as 00:00, not 24:00", () => {
    // 19:00 UTC = 00:00 next day in UTC+5.
    expect(formatDateTime("2026-06-14T19:00:00.000Z")).toBe("15.06.2026 00:00");
  });

  it("is stable — the same instant formats to the same string on every call", () => {
    const instant = "2026-03-02T07:45:00.000Z";
    expect(formatDateTime(instant)).toBe(formatDateTime(instant));
    expect(formatDateTime(instant)).toBe("02.03.2026 12:45");
  });
});
