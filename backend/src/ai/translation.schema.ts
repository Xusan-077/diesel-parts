import { z } from 'zod';

/**
 * Locales Gemini is ever asked to produce. "oz" is deliberately excluded —
 * it is always derived by deterministic transliteration of the uz text
 * (see common/i18n/transliterate-uz.ts), never by AI, so it stays correct
 * even when Gemini is down.
 */
export const AI_LOCALES = ['uz', 'ru', 'en', 'zh'] as const;
export type AiLocale = (typeof AI_LOCALES)[number];

export interface TranslateSourceFields {
  name: string;
  description?: string;
}

const localeFieldsSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

export const geminiTranslationResponseSchema = z.object({
  correctedSource: localeFieldsSchema,
  corrections: z.array(
    z.object({
      field: z.string(),
      original: z.string(),
      corrected: z.string(),
    }),
  ),
  translations: z.object({
    uz: localeFieldsSchema,
    ru: localeFieldsSchema,
    en: localeFieldsSchema,
    zh: localeFieldsSchema,
  }),
});

export type GeminiTranslationResponse = z.infer<
  typeof geminiTranslationResponseSchema
>;

/**
 * Plain JSON Schema (not the older proto-based `responseSchema`/`Schema`
 * type) passed as `config.responseJsonSchema` — supports $ref/$defs, which
 * keeps the four locale-fields blocks from being repeated four times.
 */
export const GEMINI_RESPONSE_JSON_SCHEMA = {
  type: 'object',
  properties: {
    correctedSource: { $ref: '#/$defs/localeFields' },
    corrections: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          field: { type: 'string' },
          original: { type: 'string' },
          corrected: { type: 'string' },
        },
        required: ['field', 'original', 'corrected'],
      },
    },
    translations: {
      type: 'object',
      properties: {
        uz: { $ref: '#/$defs/localeFields' },
        ru: { $ref: '#/$defs/localeFields' },
        en: { $ref: '#/$defs/localeFields' },
        zh: { $ref: '#/$defs/localeFields' },
      },
      required: ['uz', 'ru', 'en', 'zh'],
    },
  },
  required: ['correctedSource', 'corrections', 'translations'],
  $defs: {
    localeFields: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
      },
      required: ['name'],
    },
  },
} as const;

export function buildGeminiSystemInstruction(): string {
  return [
    "Siz og'ir texnika ehtiyot qismlari sohasidagi professional texnik tarjimon va muharrirsiz.",
    "Uslub: rasmiy, texnik. Texnik terminlarni to'g'ri ishlating (gidronasos, forsunka, turbokompressor, tishli g'ildirak va shunga o'xshash).",
    '',
    "QAT'IY QOIDALAR — HECH QACHON TARJIMA QILMANG VA O'ZGARTIRMANG:",
    '- OEM va part raqamlari',
    '- Brend va model nomlari (masalan: SHANTUI, Weichai WD615, Cummins, XCMG)',
    "- Raqamlar va o'lchov birliklari",
    '',
    "Ma'noni o'zgartirmang, yangi ma'lumot to'qimang, qator va formatlashni saqlang.",
    'Javobni faqat berilgan JSON sxemasiga mos qaytaring, boshqa hech narsa yozmang.',
  ].join('\n');
}

export function buildGeminiUserPrompt(
  sourceLocale: AiLocale,
  fields: TranslateSourceFields,
): string {
  return [
    `Manba til: ${sourceLocale}`,
    '',
    'Vazifa:',
    `1. Quyidagi maydonlar ${sourceLocale} tilida ekanligini tasdiqlang.`,
    '2. Shu tildagi imlo va grammatik xatolarni tuzating (yuqoridagi qoidalarga rioya qilib).',
    '3. Tuzatilgan matnni "uz", "ru", "en" va "zh" (soddalashtirilgan xitoy) tillarining HAR BIRIGA tarjima qiling.',
    `4. "${sourceLocale}" uchun "translations" ichidagi natija — sizning tuzatilgan matningiz bo'lishi kerak (qayta tarjima emas).`,
    '',
    'Maydonlar (JSON):',
    JSON.stringify(fields),
  ].join('\n');
}
