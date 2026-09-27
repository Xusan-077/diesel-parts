import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenAI } from '@google/genai';
import {
  AiLocale,
  GEMINI_RESPONSE_JSON_SCHEMA,
  GeminiTranslationResponse,
  TranslateSourceFields,
  buildGeminiSystemInstruction,
  buildGeminiUserPrompt,
  geminiTranslationResponseSchema,
} from './translation.schema';

const TIMEOUT_MS = 30_000;
const MAX_RETRIES = 2;
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

function extractStatus(error: unknown): number | undefined {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status?: unknown }).status;
    return typeof status === 'number' ? status : undefined;
  }
  return undefined;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Thin wrapper around the Gemini structured-output API. Never called for
 * "oz" — see translation.schema.ts's AI_LOCALES comment.
 */
@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private readonly client: GoogleGenAI | null;
  private readonly model: string;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    this.model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    this.client = apiKey ? new GoogleGenAI({ apiKey }) : null;
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  async translate(
    sourceLocale: AiLocale,
    fields: TranslateSourceFields,
  ): Promise<GeminiTranslationResponse> {
    if (!this.client) {
      throw new Error('GEMINI_API_KEY is not configured');
    }
    const client = this.client;

    let lastError: unknown;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const response = await client.models.generateContent({
          model: this.model,
          contents: buildGeminiUserPrompt(sourceLocale, fields),
          config: {
            systemInstruction: buildGeminiSystemInstruction(),
            responseMimeType: 'application/json',
            responseJsonSchema: GEMINI_RESPONSE_JSON_SCHEMA,
            abortSignal: controller.signal,
          },
        });
        const text = response.text;
        if (!text) throw new Error('Gemini response has no text content');
        const parsed: unknown = JSON.parse(text);
        return geminiTranslationResponseSchema.parse(parsed);
      } catch (error) {
        const status = extractStatus(error);
        this.logger.error(
          `Gemini translate attempt ${attempt + 1}/${MAX_RETRIES + 1} failed` +
            (status ? ` (status ${status})` : '') +
            `: ${error instanceof Error ? error.message : String(error)}`,
        );
        lastError = error;
        const retryable = status !== undefined && RETRYABLE_STATUS.has(status);
        if (!retryable || attempt === MAX_RETRIES) break;
        await sleep(2 ** attempt * 500);
      } finally {
        clearTimeout(timeout);
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new Error('Gemini translate failed');
  }
}
