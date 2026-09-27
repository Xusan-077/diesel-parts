import { Injectable, Logger } from '@nestjs/common';
import { transliterateUzLatinToCyrillic } from '../common/i18n/transliterate-uz';
import { GeminiService } from './gemini.service';
import {
  AI_LOCALES,
  AiLocale,
  TranslateSourceFields,
} from './translation.schema';

export type CatalogLocale = AiLocale | 'oz';

export interface TranslateEntityInput {
  sourceLocale: AiLocale;
  fields: TranslateSourceFields;
  /** Locales the caller already has (hand-edited or from a previous run) —
   * never silently overwritten unless `force` names them in `forceLocales`. */
  existing?: Partial<Record<AiLocale, TranslateSourceFields>>;
  /** When true, `forceLocales` are re-translated even though `existing` has
   * them. Locales not listed still behave as "fill if missing." */
  force?: boolean;
  forceLocales?: AiLocale[];
}

export interface TranslateEntityResult {
  status: 'COMPLETE' | 'FAILED';
  sourceLocale: AiLocale;
  /** The (possibly spell-corrected) source-language text. */
  source: TranslateSourceFields;
  corrections: Array<{ field: string; original: string; corrected: string }>;
  locales: Partial<Record<CatalogLocale, TranslateSourceFields>>;
}

function transliterateFields(
  fields: TranslateSourceFields,
): TranslateSourceFields {
  return {
    name: transliterateUzLatinToCyrillic(fields.name),
    description: fields.description
      ? transliterateUzLatinToCyrillic(fields.description)
      : undefined,
  };
}

/**
 * Orchestrates one catalog entity's translation: Gemini fills uz/ru/en/zh,
 * but only where the caller doesn't already have a value (or `force` says
 * to overwrite that specific locale) — a manual edit in any AI_LOCALE is
 * never silently clobbered by a re-run. oz is always mechanical
 * transliteration of the FINAL uz text (stored or freshly filled), never of
 * Gemini's raw "uz" output directly — see AI_LOCALES in translation.schema.ts.
 *
 * Never touches Prisma — callers (ai.controller.ts's manual "check & AI
 * translate" button, and products/categories/brands services' save path)
 * decide what to persist.
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(private readonly gemini: GeminiService) {}

  async translateEntity(
    input: TranslateEntityInput,
  ): Promise<TranslateEntityResult> {
    const { sourceLocale, fields, existing = {}, force = false } = input;
    const forceLocales = new Set(force ? (input.forceLocales ?? []) : []);

    // Every AI locale already has a value (e.g. the form ran the "AI check"
    // button already and is now just saving) — skip the Gemini call
    // entirely rather than re-spending a paid request for nothing new.
    const nothingToTranslate =
      !force &&
      AI_LOCALES.every((locale) => locale === sourceLocale || existing[locale]);
    if (nothingToTranslate) {
      const locales: Partial<Record<CatalogLocale, TranslateSourceFields>> = {
        ...existing,
        [sourceLocale]: fields,
      };
      locales.oz = transliterateFields(locales.uz ?? fields);
      return {
        status: 'COMPLETE',
        sourceLocale,
        source: fields,
        corrections: [],
        locales,
      };
    }

    try {
      const result = await this.gemini.translate(sourceLocale, fields);

      const locales: Partial<Record<CatalogLocale, TranslateSourceFields>> = {};
      for (const locale of AI_LOCALES) {
        if (locale === sourceLocale) {
          // The source locale's value is always the (possibly
          // spell-corrected) input — that's what "translate the source"
          // means, force or not.
          locales[locale] = result.correctedSource;
          continue;
        }
        const shouldOverwrite = forceLocales.has(locale) || !existing[locale];
        locales[locale] = shouldOverwrite
          ? result.translations[locale]
          : existing[locale];
      }
      locales.oz = transliterateFields(locales.uz ?? result.correctedSource);

      return {
        status: 'COMPLETE',
        sourceLocale,
        source: result.correctedSource,
        corrections: result.corrections,
        locales,
      };
    } catch (error) {
      this.logger.error(
        `Translation failed for sourceLocale=${sourceLocale}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      const locales: Partial<Record<CatalogLocale, TranslateSourceFields>> = {
        ...existing,
        [sourceLocale]: fields,
      };
      const uzAnchor =
        locales.uz ?? (sourceLocale === 'uz' ? fields : undefined);
      if (uzAnchor) {
        locales.oz = transliterateFields(uzAnchor);
      }

      return {
        status: 'FAILED',
        sourceLocale,
        source: fields,
        corrections: [],
        locales,
      };
    }
  }
}
