/**
 * Pure shape + sanitization for `ai.service.ts`'s Gemini call, split out so
 * it can be unit-tested without a live API key — the same split
 * `product-image-storage.ts` uses on the Next.js side for its own validation.
 */

export interface Localized {
  uz: string;
  ru: string;
  en: string;
}

export interface ProductSpec {
  label: Localized;
  value: string;
}

export interface ReferenceOption {
  id: string;
  label: string;
}

/** The field keys a warning can point at — the same names the write form uses. */
export const WARNABLE_FIELDS = [
  'sku',
  'slug',
  'name',
  'description',
  'categoryId',
  'brandId',
  'compatibleModels',
  'specs',
] as const;

export type WarnableField = (typeof WARNABLE_FIELDS)[number];

export interface AiFillResult {
  sku: string;
  slug: string;
  oemNumbers: string[];
  name: Localized;
  description: Localized;
  categoryId: string | null;
  brandId: string | null;
  compatibleModels: string[];
  specs: ProductSpec[];
  warnings: WarnableField[];
  confidence: 'high' | 'medium' | 'low';
}

function emptyLocalized(): Localized {
  return { uz: '', ru: '', en: '' };
}

/**
 * A slug the app's own regex (`^[a-z0-9]+(?:-[a-z0-9]+)*$`) accepts.
 *
 * No accent-folding step: the slug is derived from the SKU (ASCII part
 * numbers), never from the localized name, so there is nothing here that
 * would carry Cyrillic or diacritics through in the first place.
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

function isLocalized(value: unknown): value is Localized {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.uz === 'string' &&
    typeof candidate.ru === 'string' &&
    typeof candidate.en === 'string'
  );
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is string =>
      typeof entry === 'string' && entry.trim().length > 0,
  );
}

function toSpecs(value: unknown): ProductSpec[] {
  if (!Array.isArray(value)) return [];
  const specs: ProductSpec[] = [];
  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null) continue;
    const candidate = entry as Record<string, unknown>;
    if (
      isLocalized(candidate.label) &&
      typeof candidate.value === 'string' &&
      candidate.value.trim()
    ) {
      specs.push({ label: candidate.label, value: candidate.value });
    }
  }
  return specs;
}

/**
 * Resolves a model-proposed id/name pair against the caller's actual
 * category or brand list. The model is never trusted with a bare id: it only
 * gets picked when it is one this list actually contains, because the id
 * space belongs to the root app's database, not this service.
 */
function resolveReference(
  proposedId: unknown,
  options: ReferenceOption[],
): { id: string | null; matched: boolean } {
  if (
    typeof proposedId === 'string' &&
    options.some((option) => option.id === proposedId)
  ) {
    return { id: proposedId, matched: true };
  }
  return { id: null, matched: false };
}

/**
 * Turns Gemini's raw JSON (already parsed) into a result this service can
 * hand back — filling gaps with empty values and recording a warning for
 * every field the model did not confidently provide, rather than throwing.
 * Matches the product spec's "no error on partial data" requirement.
 */
export function sanitizeAiFillResult(
  raw: unknown,
  input: {
    oemNumber: string;
    categories: ReferenceOption[];
    brands: ReferenceOption[];
  },
): AiFillResult {
  const candidate =
    typeof raw === 'object' && raw !== null
      ? (raw as Record<string, unknown>)
      : {};
  const warnings = new Set<WarnableField>();
  for (const field of toStringArray(candidate.warnings)) {
    if ((WARNABLE_FIELDS as readonly string[]).includes(field)) {
      warnings.add(field as WarnableField);
    }
  }

  const oemFallback = input.oemNumber.trim().toUpperCase();

  const sku =
    typeof candidate.sku === 'string' && candidate.sku.trim()
      ? candidate.sku.trim()
      : oemFallback;
  if (
    sku === oemFallback &&
    !(typeof candidate.sku === 'string' && candidate.sku.trim())
  ) {
    warnings.add('sku');
  }

  const slugSource =
    typeof candidate.slug === 'string' && candidate.slug.trim()
      ? candidate.slug
      : sku;
  const slug = slugify(slugSource) || slugify(oemFallback) || 'mahsulot';
  if (!(typeof candidate.slug === 'string' && candidate.slug.trim())) {
    warnings.add('slug');
  }

  const oemNumbers = toStringArray(candidate.oemNumbers);
  if (!oemNumbers.some((oem) => oem.toUpperCase() === oemFallback)) {
    oemNumbers.unshift(input.oemNumber.trim());
  }

  const name = isLocalized(candidate.name) ? candidate.name : emptyLocalized();
  if (!isLocalized(candidate.name) || !name.uz || !name.ru || !name.en) {
    warnings.add('name');
  }

  const description = isLocalized(candidate.description)
    ? candidate.description
    : emptyLocalized();
  if (
    !isLocalized(candidate.description) ||
    !description.uz ||
    !description.ru ||
    !description.en
  ) {
    warnings.add('description');
  }

  const category = resolveReference(candidate.categoryId, input.categories);
  if (!category.matched) warnings.add('categoryId');

  const brand = resolveReference(candidate.brandId, input.brands);
  if (!brand.matched) warnings.add('brandId');

  const compatibleModels = toStringArray(candidate.compatibleModels);
  if (compatibleModels.length === 0) warnings.add('compatibleModels');

  const specs = toSpecs(candidate.specs);
  if (specs.length === 0) warnings.add('specs');

  const reportedConfidence: AiFillResult['confidence'] =
    candidate.confidence === 'high' ||
    candidate.confidence === 'medium' ||
    candidate.confidence === 'low'
      ? candidate.confidence
      : 'low';

  /**
   * A warning on name/description/categoryId/brandId means the model got a
   * core field wrong or couldn't fill it — that always caps confidence at
   * "low" no matter what the model itself reported. Warnings on the softer
   * fields (sku/slug/compatibleModels/specs) only prevent "high": the model
   * may still self-report "medium" for a format-based guess (see the OEM
   * prompt's low-recognition fallback) without being forced all the way down.
   */
  const hardFields: WarnableField[] = [
    'name',
    'description',
    'categoryId',
    'brandId',
  ];
  const hasHardWarning = hardFields.some((field) => warnings.has(field));

  const confidence: AiFillResult['confidence'] =
    reportedConfidence === 'low' || hasHardWarning
      ? 'low'
      : reportedConfidence === 'medium' || warnings.size > 0
        ? 'medium'
        : 'high';

  return {
    sku,
    slug,
    oemNumbers,
    name,
    description,
    categoryId: category.id,
    brandId: brand.id,
    compatibleModels,
    specs,
    warnings: Array.from(warnings),
    confidence,
  };
}

/**
 * Gemini is instructed to answer with pure JSON, but a grounded turn's final
 * text sometimes wraps it in a fenced code block or a short preamble sentence
 * anyway. Extracts the first balanced `{...}` rather than trusting the whole
 * string to be parseable JSON.
 */
export function extractJsonObject(text: string): unknown {
  const start = text.indexOf('{');
  if (start === -1) {
    throw new Error('No JSON object found in model output');
  }

  let depth = 0;
  let inString = false;
  let escapeNext = false;

  for (let i = start; i < text.length; i++) {
    const char = text[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    if (char === '\\' && inString) {
      escapeNext = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (char === '{') depth++;
    if (char === '}') {
      depth--;
      if (depth === 0) {
        return JSON.parse(text.slice(start, i + 1));
      }
    }
  }

  throw new Error('Unbalanced JSON object in model output');
}
