import { describe, expect, it } from "vitest";
import { csvFilename, toCsv, type CsvColumn } from "./csv";

interface Row {
  sku: string;
  name: string;
  units: number;
  note: string | null;
}

const COLUMNS: CsvColumn<Row>[] = [
  { header: "SKU", value: (row) => row.sku },
  { header: "Nomi", value: (row) => row.name },
  { header: "Sotildi", value: (row) => row.units },
  { header: "Izoh", value: (row) => row.note },
];

/** The document without its BOM, split into lines, for readable assertions. */
function lines(csv: string): string[] {
  return csv.replace(/^\ufeff/, "").trimEnd().split("\r\n");
}

describe("toCsv", () => {
  it("writes the header from the columns", () => {
    expect(lines(toCsv(COLUMNS, []))[0]).toBe('"SKU","Nomi","Sotildi","Izoh"');
  });

  it("quotes every field, so one column never has two shapes", () => {
    const csv = lines(
      toCsv(COLUMNS, [{ sku: "DP-INJ-3126", name: "Injektor", units: 4, note: null }]),
    );

    expect(csv[1]).toBe('"DP-INJ-3126","Injektor","4",""');
  });

  it("doubles an embedded quote rather than ending the field early", () => {
    const csv = lines(
      toCsv(COLUMNS, [{ sku: "A", name: 'Kran "Bosch"', units: 1, note: null }]),
    );

    expect(csv[1]).toBe('"A","Kran ""Bosch""","1",""');
  });

  it("survives a comma and a newline inside a value", () => {
    const csv = toCsv(COLUMNS, [
      { sku: "A", name: "Yoqilg'i, dizel", units: 1, note: "birinchi\nikkinchi" },
    ]);

    expect(csv).toContain('"Yoqilg\'i, dizel"');
    expect(csv).toContain('"birinchi\nikkinchi"');
  });

  it("exports a number as a number, not as a formatted figure", () => {
    // The whole point of the export is that the column can still be summed.
    const csv = lines(toCsv(COLUMNS, [{ sku: "A", name: "B", units: 1200000, note: null }]));

    expect(csv[1]).toContain('"1200000"');
  });

  it("opens with a BOM and separates rows with CRLF, for Excel on Windows", () => {
    const csv = toCsv(COLUMNS, [{ sku: "A", name: "B", units: 1, note: null }]);

    expect(csv.startsWith("\ufeff")).toBe(true);
    expect(csv).toContain("\r\n");
  });
});

describe("csvFilename", () => {
  it("names the file for its contents and its window", () => {
    expect(
      csvFilename("sotuv", new Date("2026-08-01T00:00:00Z"), new Date("2026-08-22T00:00:00Z")),
    ).toBe("diesel-parts-sotuv-2026-08-01_2026-08-22.csv");
  });
});
