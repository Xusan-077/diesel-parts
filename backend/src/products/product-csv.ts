/**
 * CSV in and out for the catalog.
 *
 * Pure and database-free so both directions can be tested directly. Ported from
 * the root app's `lib/api/product-csv.ts` — the column headers are identical so
 * a CSV exported by the old director panel stays importable after the backend
 * consolidation. Row validation is NOT done here: the service runs each parsed
 * row through `ImportProductRowDto` (class-validator) and reports failures with
 * their line number, rather than duplicating the schema in a second place.
 */

/** Multi-valued cells hold several entries; a semicolon avoids quoting them. */
const LIST_SEPARATOR = ';';

export const CSV_COLUMNS = [
  'sku',
  'slug',
  'oemNumbers',
  'nameUz',
  'nameRu',
  'nameEn',
  'descriptionUz',
  'descriptionRu',
  'descriptionEn',
  'price',
  'stock',
  'minStock',
  'categoryId',
  'brandId',
  'compatibleModels',
  'isActive',
] as const;

export type CsvColumn = (typeof CSV_COLUMNS)[number];

export interface ProductCsvRow {
  /** Absent for a new row; present when the file came from an export. */
  id?: string;
  sku: string;
  slug: string;
  oemNumbers: string[];
  nameUz: string;
  nameRu: string;
  nameEn: string;
  descriptionUz: string;
  descriptionRu: string;
  descriptionEn: string;
  price: number | null;
  stock: number;
  minStock: number;
  categoryId: string;
  brandId: string;
  compatibleModels: string[];
  isActive: boolean;
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
export function toCsv(rows: readonly ProductCsvRow[]): string {
  const header = ['id', ...CSV_COLUMNS].join(',');

  const lines = rows.map((row) =>
    [
      row.id ?? '',
      row.sku,
      row.slug,
      row.oemNumbers.join(LIST_SEPARATOR),
      row.nameUz,
      row.nameRu,
      row.nameEn,
      row.descriptionUz,
      row.descriptionRu,
      row.descriptionEn,
      row.price === null ? '' : String(row.price),
      String(row.stock),
      String(row.minStock),
      row.categoryId,
      row.brandId,
      row.compatibleModels.join(LIST_SEPARATOR),
      row.isActive ? '1' : '0',
    ]
      .map((cell) => escapeCell(cell))
      .join(','),
  );

  return '﻿' + [header, ...lines].join('\r\n') + '\r\n';
}

/** Splits CSV text into rows of cells, honouring quotes and embedded newlines. */
export function parseCsv(text: string): string[][] {
  const withoutBom = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
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
    } else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (char !== '\r') {
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
  /** 1-based line number in the uploaded file, header included. */
  line: number;
  message: string;
}

export interface CsvReadResult {
  rows: (ProductCsvRow & { line: number })[];
  errors: CsvRowError[];
}

/**
 * Turns CSV text into coerced candidate rows. Only structural problems (an
 * empty file, a missing column) are reported here; per-field validation is the
 * service's job so a 200-line upload surfaces every bad row at once instead of
 * stopping at the first.
 */
export function readProductCsv(text: string): CsvReadResult {
  const table = parseCsv(text);

  if (table.length === 0) {
    return { rows: [], errors: [{ line: 1, message: "Fayl bo'sh." }] };
  }

  const header = table[0].map((cell) => cell.trim());
  const missing = CSV_COLUMNS.filter((column) => !header.includes(column));

  if (missing.length > 0) {
    return {
      rows: [],
      errors: [
        { line: 1, message: 'Ustunlar yetishmayapti: ' + missing.join(', ') },
      ],
    };
  }

  const indexOf = (column: string) => header.indexOf(column);
  const rows: (ProductCsvRow & { line: number })[] = [];

  for (let index = 1; index < table.length; index += 1) {
    const cells = table[index];
    const line = index + 1;
    const cell = (column: CsvColumn) => (cells[indexOf(column)] ?? '').trim();
    const priceCell = cell('price');
    const id = (cells[indexOf('id')] ?? '').trim();

    rows.push({
      line,
      ...(id === '' ? {} : { id }),
      sku: cell('sku'),
      slug: cell('slug'),
      oemNumbers: splitList(cell('oemNumbers')),
      nameUz: cell('nameUz'),
      nameRu: cell('nameRu'),
      nameEn: cell('nameEn'),
      descriptionUz: cell('descriptionUz'),
      descriptionRu: cell('descriptionRu'),
      descriptionEn: cell('descriptionEn'),
      price: priceCell === '' ? null : Number(priceCell),
      stock: Number(cell('stock')),
      minStock: Number(cell('minStock')),
      categoryId: cell('categoryId'),
      brandId: cell('brandId'),
      compatibleModels: splitList(cell('compatibleModels')),
      isActive: cell('isActive') !== '0',
    });
  }

  return { rows, errors: [] };
}
