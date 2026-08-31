import {
  parseCsv,
  readProductCsv,
  toCsv,
  type ProductCsvRow,
} from './product-csv';

function product(overrides: Partial<ProductCsvRow> = {}): ProductCsvRow {
  return {
    sku: 'DP-INJ-3126',
    slug: 'cat-fuel-injector-3126',
    oemNumbers: ['127-8213', '127-8214'],
    nameUz: 'Forsunka',
    nameRu: 'Форсунка',
    nameEn: 'Injector',
    descriptionUz: 'uz',
    descriptionRu: 'ru',
    descriptionEn: 'en',
    price: 3450000,
    stock: 25,
    minStock: 5,
    categoryId: 'injector',
    brandId: 'cat',
    compatibleModels: ['CAT 320D'],
    isActive: true,
    ...overrides,
  };
}

describe('toCsv', () => {
  it('opens with a byte order mark so Excel reads Cyrillic correctly', () => {
    expect(toCsv([product()]).charCodeAt(0)).toBe(0xfeff);
  });

  it('joins multi-valued cells with a semicolon', () => {
    expect(toCsv([product()])).toContain('127-8213;127-8214');
  });

  it('quotes a cell containing a comma and doubles inner quotes', () => {
    const csv = toCsv([product({ nameUz: 'A, B "C"' })]);
    expect(csv).toContain('"A, B ""C"""');
  });

  it('writes an unpriced product as an empty cell, never zero', () => {
    const csv = toCsv([product({ price: null })]);
    expect(csv.split('\r\n')[1]).toContain(',,25,');
  });
});

describe('parseCsv', () => {
  it('round-trips a quoted cell with a comma', () => {
    expect(parseCsv('a,"b,c",d')).toEqual([['a', 'b,c', 'd']]);
  });

  it('round-trips an escaped quote', () => {
    expect(parseCsv('a,"say ""hi""",c')).toEqual([['a', 'say "hi"', 'c']]);
  });

  it('keeps a newline inside a quoted cell', () => {
    expect(parseCsv('a,"line1\nline2"')).toEqual([['a', 'line1\nline2']]);
  });

  it('drops blank lines', () => {
    expect(parseCsv('a,b\n\nc,d\n')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });
});

describe('readProductCsv', () => {
  it('round-trips what toCsv wrote', () => {
    const result = readProductCsv(toCsv([product()]));

    expect(result.errors).toEqual([]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].sku).toBe('DP-INJ-3126');
    expect(result.rows[0].oemNumbers).toEqual(['127-8213', '127-8214']);
    expect(result.rows[0].price).toBe(3450000);
  });

  it('carries the id through so an export can be edited and re-imported', () => {
    const result = readProductCsv(toCsv([product({ id: 'abc-123' })]));
    expect(result.rows[0].id).toBe('abc-123');
  });

  it('treats a row with no id as new', () => {
    const result = readProductCsv(toCsv([product()]));
    expect(result.rows[0].id).toBeUndefined();
  });

  it('tags each row with its 1-based file line number', () => {
    const result = readProductCsv(toCsv([product(), product({ sku: 'DP-2' })]));
    expect(result.rows.map((row) => row.line)).toEqual([2, 3]);
  });

  it('names the missing columns rather than failing row by row', () => {
    const result = readProductCsv('sku,slug\nDP-1,a-b');
    expect(result.rows).toEqual([]);
    expect(result.errors[0].message).toContain('nameUz');
  });

  it('reads an empty price cell as null', () => {
    const result = readProductCsv(toCsv([product({ price: null })]));
    expect(result.rows[0].price).toBeNull();
  });

  it('reads isActive=0 as retired and anything else as live', () => {
    const off = readProductCsv(toCsv([product({ isActive: false })]));
    const on = readProductCsv(toCsv([product({ isActive: true })]));

    expect(off.rows[0].isActive).toBe(false);
    expect(on.rows[0].isActive).toBe(true);
  });

  it('reports an empty file rather than importing nothing silently', () => {
    expect(readProductCsv('').errors[0].message).toContain("bo'sh");
  });
});
