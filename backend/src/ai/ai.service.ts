import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  extractJsonObject,
  sanitizeAiFillResult,
  WARNABLE_FIELDS,
  type AiFillResult,
  type ReferenceOption,
} from './ai-fill-result';

export interface GeneratedImage {
  base64: string;
  mimeType: string;
}

// The "latest" alias, not a dated snapshot: `gemini-2.5-flash` returns a 404
// ("no longer available to new users") against this project's API key, and
// the alias is what Google's own error pointed a deprecated-snapshot caller
// toward — it tracks whichever flash model is current without a code change.
const GEMINI_TEXT_MODEL = 'gemini-flash-latest';
const GEMINI_IMAGE_MODEL = 'gemini-2.5-flash-image';
const GEMINI_API_BASE =
  'https://generativelanguage.googleapis.com/v1beta/models';

/** Gemini `responseSchema` uses this shape for every `{uz, ru, en}` field. */
const LOCALIZED_SCHEMA = {
  type: 'OBJECT',
  properties: {
    uz: { type: 'STRING' },
    ru: { type: 'STRING' },
    en: { type: 'STRING' },
  },
  required: ['uz', 'ru', 'en'],
};

/**
 * Forces Gemini's `ai-fill` answer into `AiFillResult`'s exact shape via
 * `responseMimeType: "application/json"` + `responseSchema` — confirmed to
 * work together with the `google_search` grounding tool used below (Google's
 * own error surface distinguishes an incompatible-request 400 from a
 * quota 429; this project's key only ever hit the latter while testing the
 * combination). Replaces free-text JSON-in-a-code-fence, which is what
 * `extractJsonObject` used to have to unwrap.
 */
const AI_FILL_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    sku: { type: 'STRING' },
    slug: { type: 'STRING' },
    oemNumbers: { type: 'ARRAY', items: { type: 'STRING' } },
    name: LOCALIZED_SCHEMA,
    description: LOCALIZED_SCHEMA,
    categoryId: { type: 'STRING', nullable: true },
    brandId: { type: 'STRING', nullable: true },
    compatibleModels: { type: 'ARRAY', items: { type: 'STRING' } },
    specs: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: { label: LOCALIZED_SCHEMA, value: { type: 'STRING' } },
        required: ['label', 'value'],
      },
    },
    warnings: {
      type: 'ARRAY',
      items: { type: 'STRING', enum: [...WARNABLE_FIELDS] },
    },
    confidence: { type: 'STRING', enum: ['high', 'medium', 'low'] },
  },
  required: [
    'sku',
    'slug',
    'oemNumbers',
    'name',
    'description',
    'categoryId',
    'brandId',
    'compatibleModels',
    'specs',
    'warnings',
    'confidence',
  ],
};

/**
 * Two real OEM numbers (verified against parts-supplier listings, not
 * invented) given to Gemini as few-shot turns ahead of the real question —
 * conversation history, not prose in the system instruction, so the model
 * doesn't mistake the example `categoryId`/`brandId` placeholders for literal
 * values to copy. Picked from CAT and Komatsu per the OEM-fill spec: one
 * common-rail injector, one gasket, so the shape of both a "part with clear
 * specs" and a "part defined mostly by fitment" is demonstrated.
 */
function buildFewShotTurns(): Array<{
  role: 'user' | 'model';
  parts: [{ text: string }];
}> {
  const example1Answer: AiFillResult = {
    sku: '10R-7225',
    slug: '10r-7225',
    oemNumbers: ['10R-7225', '387-9427', '295-1411'],
    name: {
      uz: "Yoqilg'i forsunkasi (in'yektor) 10R-7225",
      ru: 'Топливная форсунка (инжектор) 10R-7225',
      en: 'Fuel Injector 10R-7225',
    },
    description: {
      uz: "Caterpillar C7 dvigateli uchun yoqilg'i forsunkasi — silindrga yuqori bosim ostida yoqilg'i purkab, yonish jarayonini ta'minlaydi. CAT 324D, 325D, E320D, E330D ekskavatorlari va 120K greyderida qo'llaniladi.",
      ru: 'Топливная форсунка для двигателя Caterpillar C7 — впрыскивает топливо под высоким давлением в цилиндр для обеспечения сгорания. Используется на экскаваторах CAT 324D, 325D, E320D, E330D и грейдере 120K.',
      en: 'Fuel injector for the Caterpillar C7 engine — delivers a high-pressure fuel spray into the cylinder for combustion. Used on CAT 324D, 325D, E320D, E330D excavators and the 120K motor grader.',
    },
    categoryId: 'misol-kategoriya-id',
    brandId: 'misol-brend-id',
    compatibleModels: [
      'CAT C7',
      'CAT 324D',
      'CAT 325D',
      'CAT E320D',
      'CAT E330D',
      'CAT 120K',
    ],
    specs: [
      {
        label: { uz: 'Dvigatel', ru: 'Двигатель', en: 'Engine' },
        value: 'Caterpillar C7',
      },
      {
        label: { uz: 'Turi', ru: 'Тип', en: 'Type' },
        value: 'Common rail injector',
      },
    ],
    warnings: [],
    confidence: 'high',
  };

  const example2Answer: AiFillResult = {
    sku: '6136-11-1813',
    slug: '6136-11-1813',
    oemNumbers: ['6136-11-1813', '6136-11-1812', '6137-12-1811'],
    name: {
      uz: 'Silindr golovkasi prokladkasi 6136-11-1813',
      ru: 'Прокладка головки блока цилиндров 6136-11-1813',
      en: 'Cylinder Head Gasket 6136-11-1813',
    },
    description: {
      uz: "Komatsu S6D105 dvigateli uchun silindr golovkasi prokladkasi — golovka va blok orasidagi hermetiklikni ta'minlab, moy va sovutish suyuqligining aralashishining oldini oladi. PC150-1, PC200-1/2/3, PC220-3 ekskavatorlari va WA200-1, WA300-1 yuklagichlarida ishlatiladi.",
      ru: 'Прокладка головки блока цилиндров для двигателя Komatsu S6D105 — обеспечивает герметичность между головкой и блоком, предотвращая смешивание масла и охлаждающей жидкости. Используется на экскаваторах PC150-1, PC200-1/2/3, PC220-3 и погрузчиках WA200-1, WA300-1.',
      en: 'Cylinder head gasket for the Komatsu S6D105 engine — seals the joint between head and block, preventing oil and coolant intermixing. Used on PC150-1, PC200-1/2/3, PC220-3 excavators and WA200-1, WA300-1 wheel loaders.',
    },
    categoryId: 'misol-kategoriya-id',
    brandId: 'misol-brend-id',
    compatibleModels: [
      'Komatsu S6D105',
      'PC150-1',
      'PC200-1',
      'PC200-2',
      'PC200-3',
      'PC220-3',
      'WA200-1',
      'WA300-1',
    ],
    specs: [
      {
        label: { uz: 'Dvigatel', ru: 'Двигатель', en: 'Engine' },
        value: 'Komatsu S6D105',
      },
      {
        label: { uz: 'Material', ru: 'Материал', en: 'Material' },
        value: "Ko'p qatlamli po'lat (MLS)",
      },
    ],
    warnings: [],
    confidence: 'high',
  };

  return [
    { role: 'user', parts: [{ text: 'OEM raqami: 10R-7225' }] },
    {
      role: 'model',
      parts: [{ text: JSON.stringify(example1Answer) }],
    },
    { role: 'user', parts: [{ text: 'OEM raqami: 6136-11-1813' }] },
    {
      role: 'model',
      parts: [{ text: JSON.stringify(example2Answer) }],
    },
  ];
}

/**
 * A director never sees this service directly — it is reached only through
 * `AiController`'s two `internal/products/*` routes, which the Next.js
 * director panel calls after its own `authenticateDirector()` check. See
 * `InternalRequestGuard` for why that is enough authorization here.
 *
 * Both endpoints share one `GEMINI_API_KEY` — OEM lookup via Gemini's Google
 * Search grounding, and photo generation via Gemini's image model.
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(private readonly config: ConfigService) {}

  private getApiKey(): string {
    return this.config.getOrThrow<string>('GEMINI_API_KEY');
  }

  /**
   * Looks up a part by its OEM number via Gemini's Google Search grounding
   * and returns a product write payload — minus `price`/`stock`, which the
   * spec requires a human to fill in by hand. Never throws on thin search
   * results: `sanitizeAiFillResult` degrades to empty fields plus warnings
   * instead, so a hard-to-find part still opens the review modal rather than
   * failing the request.
   */
  async fillFromOem(input: {
    oemNumber: string;
    category?: string;
    categories: ReferenceOption[];
    brands: ReferenceOption[];
  }): Promise<AiFillResult> {
    const categoryList =
      input.categories.map((c) => `${c.id}: ${c.label}`).join('\n') ||
      "(ro'yxat bo'sh)";
    const brandList =
      input.brands.map((b) => `${b.id}: ${b.label}`).join('\n') ||
      "(ro'yxat bo'sh)";

    const system = [
      "Sen og'ir texnika (dizel dvigatellar, ekskavator, buldozer, yuklagich, kran va h.k.) ehtiyot qismlari bo'yicha OEM-katalog ekspertisan. Senga ishlab chiqaruvchi (OEM) raqami va, agar berilgan bo'lsa, direktor taklif qilgan brend/kategoriya beriladi.",
      '',
      "1-QADAM — tanish-tanimasligingni baholash. Javob berishdan oldin, OEM raqamini google_search orqali internetdan va bilim bazangdan qidirib, o'zing uchun aniqlik darajasini belgila:",
      '- "high": OEM raqami internetdan aniq topildi — mahsulot turi, brendi va mos texnika modellari ishonchli ma\'lum.',
      '- "medium": OEM raqami qisman tanish — masalan, faqat brend yoki faqat qism turi aniq, lekin mos texnika modellari yoki boshqa detallar noaniq.',
      '- "low": OEM raqami internetdan yoki bilim bazangdan umuman topilmadi.',
      '',
      '2-QADAM — shu bahoga qarab javob ber:',
      '- "high" yoki "medium" bo\'lsa: topilgan ma\'lumot asosida to\'liq javob yoz, "confidence" maydoniga aynan shu bahoni qo\'y.',
      '- "low" bo\'lsa — BO\'SH QAYTARMA: OEM raqamining formatidan (prefiks harflari, raqamlar soni, tire/chiziqcha joylashuvi, brendlarga xos naqsh — masalan "10R-" yoki "3-4 raqam" CAT uslubiga, "6136-11-" kabi "NNNN-NN-NNNN" Komatsu uslubiga, "630-" ko\'p xonali raqam Yuchai uslubiga o\'xshaydi) brend/kategoriya/mahsulot turini ENG EHTIMOLLI TAXMIN sifatida chiqar va shu taxmin asosida umumiy (generic) nom hamda tavsif yoz — tavsifda buning taxmin ekanini yashirma (masalan "ehtimol", "taxminan" kabi so\'z ishlat). "confidence": "low" qo\'y va taxmin qilingan har bir maydonni "warnings" ro\'yxatiga qo\'sh.',
      "- Faqat OEM raqami formati ham hech narsaga o'xshamasa (naqsh butunlay notanish) va taxmin qilib ham bo'lmasa, o'sha maydonni bo'sh (\"\" yoki []) qoldir va \"warnings\"ga qo'sh.",
      '',
      "Nomlar va tavsiflarni uchta tilda yoz: o'zbek (uz), rus (ru), ingliz (en). Tavsiflar tabiiy, professional katalog uslubida bo'lsin — 2-4 gap, marketing bezaklarisiz: qism nima uchun ishlatilishi va qaysi dvigatel/texnika modeliga mos kelishi aniq yozilsin.",
      '',
      "\"specs\" maydoniga topilgan har qanday texnik xususiyatni qo'sh: dvigatel/texnika modeli, o'lcham yoki diametr, og'irlik, material, bosim yoki quvvat kabi — har biri alohida {label, value} juftligi sifatida. Hech narsa topilmasa, bo'sh massiv qoldir.",
      '',
      "Quyidagi mavjud kategoriyalar ro'yxatidan (id: nom) eng mosini tanla:",
      categoryList,
      '',
      "Quyidagi mavjud brendlar ro'yxatidan (id: nom) eng mosini tanla:",
      brandList,
      '',
      "Agar ro'yxatda mos keladigan kategoriya yoki brend bo'lmasa, categoryId/brandId maydonini null qoldir.",
      '',
      'Quyida ikkita haqiqiy OEM raqami bo\'yicha misol suhbat berilgan — ulardagi "categoryId"/"brandId" qiymatlari ("misol-kategoriya-id", "misol-brend-id") faqat namuna: asl javobingda FAQAT yuqoridagi ro\'yxatlardagi ID\'lardan foydalan, mos kelmasa null qo\'y.',
    ].join('\n');

    const userParts = [`OEM raqami: ${input.oemNumber}`];
    if (input.category) {
      userParts.push(
        `Direktor tomonidan taklif qilingan kategoriya: ${input.category}`,
      );
    }

    const response = await fetch(
      `${GEMINI_API_BASE}/${GEMINI_TEXT_MODEL}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': this.getApiKey(),
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [
            ...buildFewShotTurns(),
            { role: 'user', parts: [{ text: userParts.join('\n') }] },
          ],
          // Google Search grounding — the model issues its own searches
          // server-side before answering, so the OEM lookup is never limited
          // to what the model already knew from training.
          tools: [{ google_search: {} }],
          generationConfig: {
            // Structured output: replaces the old free-text-plus-code-fence
            // contract (`extractJsonObject` still runs as a defensive
            // fallback below, but should now always find a clean object).
            responseMimeType: 'application/json',
            responseSchema: AI_FILL_RESPONSE_SCHEMA,
            // Low but non-zero: this is a factual lookup, not a creative
            // task, yet the format-guess fallback (2-QADAM, "low" branch)
            // still needs some room to phrase a generic name/description.
            temperature: 0.25,
          },
        }),
      },
    );

    // Temporary: the raw body, before any parsing touches it, so a shape
    // Gemini actually sent that this service mishandles is visible instead
    // of guessed at. Remove once ai-fill's JSON contract is confirmed stable.
    const rawBody = await response.text();
    this.logger.log(
      `Gemini ai-fill RAW response for OEM ${input.oemNumber} (status ${response.status}):\n${rawBody}`,
    );

    if (!response.ok) {
      return sanitizeAiFillResult(
        {},
        {
          oemNumber: input.oemNumber,
          categories: input.categories,
          brands: input.brands,
        },
      );
    }

    const data = JSON.parse(rawBody) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };

    const text = (data.candidates?.[0]?.content?.parts ?? [])
      .map((part) => part.text ?? '')
      .join('');

    if (!text.trim()) {
      this.logger.warn(`No text in Gemini response for OEM ${input.oemNumber}`);
      return sanitizeAiFillResult(
        {},
        {
          oemNumber: input.oemNumber,
          categories: input.categories,
          brands: input.brands,
        },
      );
    }

    let parsed: unknown;
    try {
      parsed = extractJsonObject(text);
    } catch (error) {
      this.logger.warn(
        `Failed to parse Gemini JSON for OEM ${input.oemNumber}: ${(error as Error).message}`,
      );
      parsed = {};
    }

    return sanitizeAiFillResult(parsed, {
      oemNumber: input.oemNumber,
      categories: input.categories,
      brands: input.brands,
    });
  }

  /**
   * Generates a studio-style product photo via Gemini and returns the raw
   * image bytes — this service holds no Blob token, so uploading is the
   * Next.js layer's job (see `lib/api/product-image-storage.ts`), exactly
   * like a director-picked file would be.
   */
  async generateImage(input: {
    productName: string;
    oemNumber?: string;
  }): Promise<GeneratedImage> {
    const promptParts = [
      `Professional studio product photograph of "${input.productName}"`,
    ];
    if (input.oemNumber) {
      promptParts.push(`(OEM part number ${input.oemNumber})`);
    }
    promptParts.push(
      'A diesel engine spare part, centered, plain solid white background, no shadow, no props, no text, no watermark, e-commerce catalog style, sharp focus, even studio lighting.',
    );
    const prompt = promptParts.join(' ');

    const response = await fetch(
      `${GEMINI_API_BASE}/${GEMINI_IMAGE_MODEL}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': this.getApiKey(),
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ['IMAGE'] },
        }),
      },
    );

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(
        `Gemini image generation failed (${response.status}): ${body}`,
      );
    }

    const data = (await response.json()) as {
      candidates?: {
        content?: {
          parts?: { inlineData?: { data?: string; mimeType?: string } }[];
        };
      }[];
    };

    const part = data.candidates?.[0]?.content?.parts?.find(
      (p) => p.inlineData?.data,
    );
    const inline = part?.inlineData;
    if (!inline?.data) {
      throw new Error('Gemini response contained no image data');
    }

    return { base64: inline.data, mimeType: inline.mimeType ?? 'image/png' };
  }
}
