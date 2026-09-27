import { transliterateUzLatinToCyrillic } from '../common/i18n/transliterate-uz';
import { AiService } from './ai.service';
import { GeminiService } from './gemini.service';

function makeGemini(translate: jest.Mock): GeminiService {
  return { translate } as unknown as GeminiService;
}

describe('AiService', () => {
  it('skips the Gemini call entirely when every AI locale is already supplied', async () => {
    const translate = jest.fn();
    const service = new AiService(makeGemini(translate));

    const result = await service.translateEntity({
      sourceLocale: 'uz',
      fields: { name: 'Forsunka' },
      existing: {
        ru: { name: 'Форсунка' },
        en: { name: 'Injector' },
        zh: { name: '喷油器' },
      },
    });

    expect(translate).not.toHaveBeenCalled();
    expect(result.status).toBe('COMPLETE');
    expect(result.locales.uz?.name).toBe('Forsunka');
    expect(result.locales.ru?.name).toBe('Форсунка');
    expect(result.locales.oz?.name).toBe(
      transliterateUzLatinToCyrillic('Forsunka'),
    );
  });

  it('still calls Gemini when force is true, even if every locale is already supplied', async () => {
    const translate = jest.fn().mockResolvedValue({
      correctedSource: { name: 'Forsunka' },
      corrections: [],
      translations: {
        uz: { name: 'Forsunka' },
        ru: { name: 'AI-Форсунка' },
        en: { name: 'Injector' },
        zh: { name: '喷油器' },
      },
    });
    const service = new AiService(makeGemini(translate));

    await service.translateEntity({
      sourceLocale: 'uz',
      fields: { name: 'Forsunka' },
      existing: {
        ru: { name: 'Форсунка' },
        en: { name: 'Injector' },
        zh: { name: '喷油器' },
      },
      force: true,
      forceLocales: ['ru'],
    });

    expect(translate).toHaveBeenCalledTimes(1);
  });

  it('fills uz/ru/en/zh from Gemini when nothing existing is supplied, oz via transliteration of the corrected uz', async () => {
    const translate = jest.fn().mockResolvedValue({
      correctedSource: { name: "Yo'nalish", description: undefined },
      corrections: [
        { field: 'name', original: 'Yonalish', corrected: "Yo'nalish" },
      ],
      translations: {
        uz: { name: "Yo'nalish" },
        ru: { name: 'Направление' },
        en: { name: 'Direction' },
        zh: { name: '方向' },
      },
    });
    const service = new AiService(makeGemini(translate));

    const result = await service.translateEntity({
      sourceLocale: 'uz',
      fields: { name: 'Yonalish' },
    });

    expect(result.status).toBe('COMPLETE');
    expect(result.locales.zh?.name).toBe('方向');
    expect(result.locales.ru?.name).toBe('Направление');
    expect(result.locales.en?.name).toBe('Direction');
    expect(result.locales.oz?.name).toBe(
      transliterateUzLatinToCyrillic("Yo'nalish"),
    );
    expect(result.corrections).toHaveLength(1);
  });

  it('never overwrites any caller-supplied AI locale (uz/ru/en/zh), only fills what is missing', async () => {
    const translate = jest.fn().mockResolvedValue({
      correctedSource: { name: 'Forsunka' },
      corrections: [],
      translations: {
        uz: { name: 'Forsunka' },
        ru: { name: 'AI-Форсунка' },
        en: { name: 'AI-Injector' },
        zh: { name: 'AI-喷油器' },
      },
    });
    const service = new AiService(makeGemini(translate));

    const result = await service.translateEntity({
      sourceLocale: 'uz',
      fields: { name: 'Forsunka' },
      existing: {
        ru: { name: "Форсунка (qo'lda)" },
        zh: { name: "喷油器 (qo'lda)" },
      },
    });

    expect(result.locales.ru?.name).toBe("Форсунка (qo'lda)");
    expect(result.locales.zh?.name).toBe("喷油器 (qo'lda)");
    expect(result.locales.en?.name).toBe('AI-Injector');
  });

  it('force + forceLocales re-translates only the named locales, leaving the rest untouched', async () => {
    const translate = jest.fn().mockResolvedValue({
      correctedSource: { name: 'Forsunka' },
      corrections: [],
      translations: {
        uz: { name: 'Forsunka' },
        ru: { name: 'AI-Форсунка' },
        en: { name: 'AI-Injector' },
        zh: { name: 'AI-喷油器' },
      },
    });
    const service = new AiService(makeGemini(translate));

    const result = await service.translateEntity({
      sourceLocale: 'uz',
      fields: { name: 'Forsunka' },
      existing: {
        ru: { name: "Форсунка (qo'lda)" },
        zh: { name: "喷油器 (qo'lda)" },
      },
      force: true,
      forceLocales: ['zh'],
    });

    expect(result.locales.zh?.name).toBe('AI-喷油器');
    expect(result.locales.ru?.name).toBe("Форсунка (qo'lda)");
  });

  it('oz is derived from the FINAL uz (existing, not Gemini-supplied), when uz is force-excluded', async () => {
    const translate = jest.fn().mockResolvedValue({
      correctedSource: { name: 'Forsunka' },
      corrections: [],
      translations: {
        uz: { name: 'Forsunka-AI' },
        ru: { name: 'Форсунка' },
        en: { name: 'Injector' },
        zh: { name: '喷油器' },
      },
    });
    const service = new AiService(makeGemini(translate));

    const result = await service.translateEntity({
      sourceLocale: 'ru',
      fields: { name: 'Форсунка' },
      existing: { uz: { name: "Forsunka (qo'lda)" } },
    });

    expect(result.locales.uz?.name).toBe("Forsunka (qo'lda)");
    expect(result.locales.oz?.name).toBe(
      transliterateUzLatinToCyrillic("Forsunka (qo'lda)"),
    );
  });

  it('falls back to FAILED status with source-only + oz transliteration when Gemini throws', async () => {
    const translate = jest.fn().mockRejectedValue(new Error('down'));
    const service = new AiService(makeGemini(translate));

    const result = await service.translateEntity({
      sourceLocale: 'uz',
      fields: { name: "G'ildirak" },
    });

    expect(result.status).toBe('FAILED');
    expect(result.locales.uz?.name).toBe("G'ildirak");
    expect(result.locales.oz?.name).toBe('Ғилдирак');
    expect(result.locales.zh).toBeUndefined();
    expect(result.locales.ru).toBeUndefined();
  });

  it('FAILED status still preserves existing locales instead of discarding them', async () => {
    const translate = jest.fn().mockRejectedValue(new Error('down'));
    const service = new AiService(makeGemini(translate));

    const result = await service.translateEntity({
      sourceLocale: 'uz',
      fields: { name: "G'ildirak" },
      existing: { ru: { name: 'Колесо' }, zh: { name: '车轮' } },
    });

    expect(result.status).toBe('FAILED');
    expect(result.locales.ru?.name).toBe('Колесо');
    expect(result.locales.zh?.name).toBe('车轮');
  });

  it('when sourceLocale is not uz and Gemini fails with no existing uz, oz is left unset', async () => {
    const translate = jest.fn().mockRejectedValue(new Error('down'));
    const service = new AiService(makeGemini(translate));

    const result = await service.translateEntity({
      sourceLocale: 'ru',
      fields: { name: 'Форсунка' },
    });

    expect(result.status).toBe('FAILED');
    expect(result.locales.ru?.name).toBe('Форсунка');
    expect(result.locales.oz).toBeUndefined();
  });

  it('uses the Gemini-produced uz translation as the oz anchor when sourceLocale is not uz and uz was missing', async () => {
    const translate = jest.fn().mockResolvedValue({
      correctedSource: { name: 'Форсунка' },
      corrections: [],
      translations: {
        uz: { name: 'Forsunka' },
        ru: { name: 'Форсунка' },
        en: { name: 'Injector' },
        zh: { name: '喷油器' },
      },
    });
    const service = new AiService(makeGemini(translate));

    const result = await service.translateEntity({
      sourceLocale: 'ru',
      fields: { name: 'Форсунка' },
    });

    expect(result.locales.ru?.name).toBe('Форсунка');
    expect(result.locales.uz?.name).toBe('Forsunka');
    expect(result.locales.oz?.name).toBe(
      transliterateUzLatinToCyrillic('Forsunka'),
    );
  });
});
