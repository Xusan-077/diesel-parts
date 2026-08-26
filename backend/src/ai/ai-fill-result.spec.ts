import {
  extractJsonObject,
  sanitizeAiFillResult,
  slugify,
} from './ai-fill-result';

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('DP-INJ 3126')).toBe('dp-inj-3126');
  });

  it('trims leading and trailing separators', () => {
    expect(slugify('--CAT/3126--')).toBe('cat-3126');
  });
});

describe('extractJsonObject', () => {
  it('parses a bare JSON object', () => {
    expect(extractJsonObject('{"a":1}')).toEqual({ a: 1 });
  });

  it('extracts JSON from a fenced code block with surrounding prose', () => {
    const text = 'Here is the result:\n```json\n{"a": {"b": 1}}\n```\nDone.';
    expect(extractJsonObject(text)).toEqual({ a: { b: 1 } });
  });

  it('ignores braces inside string values', () => {
    const text = '{"note": "uses {curly} braces"}';
    expect(extractJsonObject(text)).toEqual({ note: 'uses {curly} braces' });
  });

  it('throws when no object is present', () => {
    expect(() => extractJsonObject('no json here')).toThrow();
  });
});

describe('sanitizeAiFillResult', () => {
  const categories = [{ id: 'cat_1', label: "Yoqilg'i tizimi" }];
  const brands = [{ id: 'brand_1', label: 'Caterpillar' }];

  it('accepts a well-formed response with no warnings and high confidence', () => {
    const raw = {
      sku: 'CAT-3126-INJ',
      slug: 'cat-3126-injector',
      oemNumbers: ['10R-7225'],
      name: { uz: 'Nomi', ru: 'Название', en: 'Name' },
      description: { uz: 'Tavsif', ru: 'Описание', en: 'Description' },
      categoryId: 'cat_1',
      brandId: 'brand_1',
      compatibleModels: ['Caterpillar 3126'],
      specs: [
        {
          label: { uz: 'Diametri', ru: 'Диаметр', en: 'Diameter' },
          value: '10mm',
        },
      ],
      warnings: [],
      confidence: 'high',
    };

    const result = sanitizeAiFillResult(raw, {
      oemNumber: '10R-7225',
      categories,
      brands,
    });

    expect(result.confidence).toBe('high');
    expect(result.warnings).toEqual([]);
    expect(result.categoryId).toBe('cat_1');
    expect(result.brandId).toBe('brand_1');
    expect(result.oemNumbers).toContain('10R-7225');
  });

  it('never trusts a categoryId/brandId outside the given lists', () => {
    const raw = {
      name: { uz: 'a', ru: 'b', en: 'c' },
      description: { uz: 'a', ru: 'b', en: 'c' },
      categoryId: 'made-up-id',
      brandId: 'also-made-up',
      confidence: 'high',
    };

    const result = sanitizeAiFillResult(raw, {
      oemNumber: '10R-7225',
      categories,
      brands,
    });

    expect(result.categoryId).toBeNull();
    expect(result.brandId).toBeNull();
    expect(result.warnings).toEqual(
      expect.arrayContaining(['categoryId', 'brandId']),
    );
    expect(result.confidence).toBe('low');
  });

  it('degrades gracefully on a mostly-empty response instead of throwing', () => {
    const result = sanitizeAiFillResult(
      {},
      { oemNumber: '10R-7225', categories, brands },
    );

    expect(result.oemNumbers).toEqual(['10R-7225']);
    expect(result.sku).toBe('10R-7225');
    expect(result.slug).toBe('10r-7225');
    expect(result.name).toEqual({ uz: '', ru: '', en: '' });
    expect(result.confidence).toBe('low');
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('always includes the searched OEM number even if the model omits it', () => {
    const result = sanitizeAiFillResult(
      { oemNumbers: ['OTHER-1'] },
      { oemNumber: '10R-7225', categories, brands },
    );

    expect(result.oemNumbers).toEqual(
      expect.arrayContaining(['10R-7225', 'OTHER-1']),
    );
  });

  it('downgrades a reported "high" to "medium" when only soft fields are missing', () => {
    const raw = {
      sku: 'CAT-3126-INJ',
      name: { uz: 'Nomi', ru: 'Название', en: 'Name' },
      description: { uz: 'Tavsif', ru: 'Описание', en: 'Description' },
      categoryId: 'cat_1',
      brandId: 'brand_1',
      // compatibleModels and specs omitted — soft fields only.
      confidence: 'high',
    };

    const result = sanitizeAiFillResult(raw, {
      oemNumber: '10R-7225',
      categories,
      brands,
    });

    expect(result.confidence).toBe('medium');
    expect(result.warnings).toEqual(
      expect.arrayContaining(['compatibleModels', 'specs']),
    );
  });

  it('honors a self-reported "medium" (format-based guess) when core fields are present', () => {
    const raw = {
      name: {
        uz: 'Ehtimol Yuchai qismi',
        ru: 'Вероятно, деталь Yuchai',
        en: 'Likely a Yuchai part',
      },
      description: { uz: 'a', ru: 'b', en: 'c' },
      categoryId: 'cat_1',
      brandId: 'brand_1',
      confidence: 'medium',
    };

    const result = sanitizeAiFillResult(raw, {
      oemNumber: 'UNKNOWN-999',
      categories,
      brands,
    });

    expect(result.confidence).toBe('medium');
  });

  it('never lets a hard-field warning (e.g. unmatched brand) rise above "low", even self-reported "medium"', () => {
    const raw = {
      name: { uz: 'a', ru: 'b', en: 'c' },
      description: { uz: 'a', ru: 'b', en: 'c' },
      categoryId: 'cat_1',
      brandId: 'made-up-brand',
      confidence: 'medium',
    };

    const result = sanitizeAiFillResult(raw, {
      oemNumber: '10R-7225',
      categories,
      brands,
    });

    expect(result.confidence).toBe('low');
  });
});
