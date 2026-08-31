import { productWriteSchema, type ProductWriteInput } from "@/lib/schemas";

/**
 * CSV in and out for the catalog.
 *
 * Pure and database-free so both directions can be tested directly. CSV rather
 * than a real .xlsx: Excel opens it natively, and a spreadsheet library would be
 * a dependency and a parser to trust for a file the director writes by hand.
 */

/** Multi-valued cells hold several entries; a semicolon avoids quoting them. */
const LIST_SEPARATOR = ";";

export const CSV_COLUMNS = [
  "sku",
  "slug",
  "oemNumbers",
  "nameUz",
  "nameRu",
  "nameEn",
  "descriptionUz",
  "descriptionRu",
  "descriptionEn",
  "price",
  "stock",
  "minStock",
  "categoryId",
  "brandId",
  "compatibleModels",
  "isActive",
] as const;

export type CsvColumn = (typeof CSV_COLUMNS)[number];

export interface CsvProduct extends ProductWriteInput {
  /** Absent for a new row; present when the file came from an export. */
  id?: string;
}

function escapeCell(value: string): string {
  return /[",\r\n]/.test(value) ? '"' + value.replace(/"/g, '""') + '"' : value;
}

/**
 * Serialises rows to CSV.
 *
 * The output opens with a UTF-8 byte order mark. Without it Excel on Windows
 * reads the file in the system codepage and every Cyrillic and Uzbek Latin
 * character in the catalog arrives as mojibake.
 */
export function toCsv(rows: readonly CsvProduct[]): string {
  const header = ["id", ...CSV_COLUMNS].join(",");

  const lines = rows.map((row) =>
    [
      row.id ?? "",
      row.sku,
      row.slug,
      row.oemNumbers.join(LIST_SEPARATOR),
      row.name.uz,
      row.name.ru,
      row.name.en,
      row.description.uz,
      row.description.ru,
      row.description.en,
      row.price === null ? "" : String(row.price),
      String(row.stock),
      String(row.minStock),
      row.categoryId,
      row.brandId,
      row.compatibleModels.join(LIST_SEPARATOR),
      row.isActive ? "1" : "0",
    ]
      .map((cell) => escapeCell(cell))
      .join(","),
  );

  return "﻿" + [header, ...lines].join("\r\n") + "\r\n";
}

/** Splits CSV text into rows of cells, honouring quotes and embedded newlines. */
export function parseCsv(text: string): string[][] {
  const withoutBom = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < withoutBom.length; index += 1) {
    const char = withoutBom[index];

    if (quoted) {
      if (char === '"') {
        if (withoutBom[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows.filter((entry) => entry.some((value) => value.trim().length > 0));
}

function splitList(value: string): string[] {
  return value
    .split(LIST_SEPARATOR)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

export interface CsvRowError {
  /** 1-based line number in the file the director uploaded, header included. */
  line: number;
  message: string;
}

export interface CsvParseResult {
  rows: CsvProduct[];
  errors: CsvRowError[];
}

/**
 * Validates every row and reports each failure with its line number.
 *
 * Nothing is written here. A director who uploads a 200-line file needs to see
 * every problem at once, not have the import stop at the first bad row with half
 * the catalog already changed.
 */
export function parseProductCsv(text: string): CsvParseResult {
  const table = parseCsv(text);

  if (table.length === 0) {
    return { rows: [], errors: [{ line: 1, message: "Fayl bo'sh." }] };
  }

  const header = table[0].map((cell) => cell.trim());
  const missing = CSV_COLUMNS.filter((column) => !header.includes(column));

  if (missing.length > 0) {
    return {
      rows: [],
      errors: [{ line: 1, message: "Ustunlar yetishmayapti: " + missing.join(", ") }],
    };
  }

  const indexOf = (column: string) => header.indexOf(column);
  const rows: CsvProduct[] = [];
  const errors: CsvRowError[] = [];

  for (let index = 1; index < table.length; index += 1) {
    const cells = table[index];
    const line = index + 1;
    const cell = (column: CsvColumn) => (cells[indexOf(column)] ?? "").trim();
    const priceCell = cell("price");

    const candidate = {
      sku: cell("sku"),
      slug: cell("slug"),
      oemNumbers: splitList(cell("oemNumbers")),
      name: { uz: cell("nameUz"), ru: cell("nameRu"), en: cell("nameEn") },
      description: {
        uz: cell("descriptionUz"),
        ru: cell("descriptionRu"),
        en: cell("descriptionEn"),
      },
      price: priceCell === "" ? null : Number(priceCell),
      stock: Number(cell("stock")),
      minStock: Number(cell("minStock")),
      categoryId: cell("categoryId"),
      brandId: cell("brandId"),
      compatibleModels: splitList(cell("compatibleModels")),
      // Specs are nested and have no sensible flat column. An imported row keeps
      // whatever specs the product already had; a new one starts with none.
      specs: [],
      isActive: cell("isActive") !== "0",
    };

    const result = productWriteSchema.safeParse(candidate);

    if (!result.success) {
      const first = result.error.issues[0];
      errors.push({
        line,
        message: first.path.join(".") + ": " + first.message,
      });
      continue;
    }

    const id = (cells[indexOf("id")] ?? "").trim();
    rows.push(id === "" ? result.data : { ...result.data, id });
  }

  return { rows, errors };
}
