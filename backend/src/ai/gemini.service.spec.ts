const mockGenerateContent = jest.fn();

jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: { generateContent: mockGenerateContent },
  })),
}));

import { GeminiService } from './gemini.service';

function validResponseText(): string {
  return JSON.stringify({
    correctedSource: { name: 'Forsunka', description: 'Tavsif' },
    corrections: [],
    translations: {
      uz: { name: 'Forsunka', description: 'Tavsif' },
      ru: { name: 'Форсунка', description: 'Описание' },
      en: { name: 'Injector', description: 'Description' },
      zh: { name: '喷油器', description: '描述' },
    },
  });
}

describe('GeminiService', () => {
  const originalKey = process.env.GEMINI_API_KEY;
  const originalModel = process.env.GEMINI_MODEL;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GEMINI_API_KEY = 'test-key';
    process.env.GEMINI_MODEL = 'gemini-test';
  });

  afterAll(() => {
    process.env.GEMINI_API_KEY = originalKey;
    process.env.GEMINI_MODEL = originalModel;
  });

  it('returns a Zod-validated result on success', async () => {
    mockGenerateContent.mockResolvedValue({ text: validResponseText() });
    const service = new GeminiService();
    const result = await service.translate('uz', { name: 'Forsunka' });
    expect(result.translations.zh.name).toBe('喷油器');
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
  });

  it('reports configured/unconfigured correctly', () => {
    expect(new GeminiService().isConfigured()).toBe(true);
    delete process.env.GEMINI_API_KEY;
    expect(new GeminiService().isConfigured()).toBe(false);
  });

  it('throws immediately when GEMINI_API_KEY is not set (no retry, no call)', async () => {
    delete process.env.GEMINI_API_KEY;
    const service = new GeminiService();
    await expect(service.translate('uz', { name: 'x' })).rejects.toThrow(
      'GEMINI_API_KEY',
    );
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  it('retries on a 429 and succeeds on the second attempt', async () => {
    const err = Object.assign(new Error('rate limited'), { status: 429 });
    mockGenerateContent
      .mockRejectedValueOnce(err)
      .mockResolvedValueOnce({ text: validResponseText() });
    const service = new GeminiService();
    const result = await service.translate('uz', { name: 'Forsunka' });
    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
    expect(result.correctedSource.name).toBe('Forsunka');
  }, 10_000);

  it('does not retry on a non-retryable 400 error', async () => {
    const err = Object.assign(new Error('bad request'), { status: 400 });
    mockGenerateContent.mockRejectedValue(err);
    const service = new GeminiService();
    await expect(service.translate('uz', { name: 'x' })).rejects.toThrow(
      'bad request',
    );
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
  });

  it('gives up after exhausting retries on repeated 500s (3 attempts total)', async () => {
    const err = Object.assign(new Error('server error'), { status: 500 });
    mockGenerateContent.mockRejectedValue(err);
    const service = new GeminiService();
    await expect(service.translate('uz', { name: 'x' })).rejects.toThrow(
      'server error',
    );
    expect(mockGenerateContent).toHaveBeenCalledTimes(3);
  }, 10_000);

  it('throws a validation error when the response does not match the schema', async () => {
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({ unexpected: true }),
    });
    const service = new GeminiService();
    await expect(service.translate('uz', { name: 'x' })).rejects.toThrow();
  });

  it('throws when the response has no text content', async () => {
    mockGenerateContent.mockResolvedValue({ text: undefined });
    const service = new GeminiService();
    await expect(service.translate('uz', { name: 'x' })).rejects.toThrow(
      'no text',
    );
  });
});
