import type { LocalizedText } from "@/lib/types";

/**
 * The home page hero, as a list of slides.
 *
 * Images live in `public/hero/` and are named here. Adding a photograph is
 * dropping the file in that folder and adding an entry below — no upload
 * endpoint, no blob store, no admin screen, and the file is served straight
 * off the CDN with the rest of the static assets.
 *
 * An empty list is still a supported state: the hero then renders exactly as it
 * did before photographs existed, copy over the inspection grid. One entry
 * renders a single still hero; two or more turn it into a carousel. Nothing
 * else has to change.
 *
 * Per-slide copy is optional. Leave `title` off and the slide uses the
 * dictionary's own hero copy, which is what a purely photographic slide wants;
 * set it and the slide runs its own line.
 */
export interface HeroSlide {
  /**
   * File name inside `public/hero/`, e.g. `"slide-1.jpg"`.
   *
   * Landscape, at least 1600px wide. The copy sits on the left half, so the
   * subject belongs on the right and the left side wants to stay quiet.
   */
  image: string;
  /** What the photograph shows. Required — this is content, not decoration. */
  alt: LocalizedText;
  eyebrow?: LocalizedText;
  title?: LocalizedText;
  subtitle?: LocalizedText;
  /** Replaces the default "browse the catalogue" button for this slide. */
  cta?: {
    label: LocalizedText;
    href: string;
  };
}

/**
 * Three slides, and they are a sequence rather than three versions of one
 * pitch: what we sell, that we have it on the shelf, and that it is the real
 * part. A carousel whose slides all say "reliable spare parts" is a carousel
 * nobody waits through.
 *
 * Each keeps the dictionary's own eyebrow, so the "10,000+ SKU · OEM quality"
 * line stays constant while the headline changes — the one fixed point in a
 * rotating hero, which is what stops it reading as three different sites.
 */
export const heroSlides: HeroSlide[] = [
  {
    image: "slide-1.jpg",
    alt: {
      uz: "Texnik chizma ustida yotgan forsunka, turbokompressor, porshen va moy filtri",
      ru: "Форсунка, турбокомпрессор, поршень и масляный фильтр на техническом чертеже",
      en: "An injector, turbocharger, piston and oil filter laid out on a technical drawing",
    },
    title: {
      uz: "Og'ir texnika uchun ishonchli ehtiyot qismlar",
      ru: "Надёжные запчасти для тяжёлой техники",
      en: "Reliable spare parts for heavy machinery",
    },
    subtitle: {
      uz: "Forsunka, turbokompressor, porshen guruhi va filtrlar — OEM raqami bo'yicha aniq moslik.",
      ru: "Форсунки, турбокомпрессоры, поршневая группа и фильтры — точное соответствие по номеру OEM.",
      en: "Injectors, turbochargers, piston assemblies and filters — matched exactly by OEM number.",
    },
  },
  {
    image: "slide-2.jpg",
    alt: {
      uz: "Ehtiyot qismlar solingan qutilar bilan to'la ombor javonlari",
      ru: "Складские стеллажи, заполненные коробками с запчастями",
      en: "Warehouse racking filled with boxed spare parts",
    },
    title: {
      uz: "Omborda bor — buyurtmadan keyin kutilmaydi",
      ru: "Есть на складе — ждать после заказа не придётся",
      en: "On the shelf, not on order",
    },
    subtitle: {
      uz: "Ko'p sotiladigan qismlar doimo zaxirada. Har bir mahsulot sahifasida qoldiq ko'rsatilgan.",
      ru: "Ходовые позиции всегда в наличии. Остаток показан на странице каждого товара.",
      en: "The parts that move are always in stock, and every product page shows what is left.",
    },
    cta: {
      label: {
        uz: "Mavjud qismlarni ko'rish",
        ru: "Смотреть, что в наличии",
        en: "See what is in stock",
      },
      href: "/products?availability=available",
    },
  },
  {
    image: "slide-3.jpg",
    alt: {
      uz: "Turbokompressor va uning atrofida forsunka, filtrlar va zichlagichlar",
      ru: "Турбокомпрессор в окружении форсунки, фильтров и прокладок",
      en: "A turbocharger surrounded by an injector, filters and gaskets",
    },
    title: {
      uz: "OEM sifati, kafolat bilan",
      ru: "Качество OEM, с гарантией",
      en: "OEM quality, under warranty",
    },
    subtitle: {
      uz: "Har bir qism kafolat bilan keladi, mos keladigan modellar ro'yxati esa sahifada yozilgan.",
      ru: "Каждая деталь идёт с гарантией, а список совместимых моделей указан на странице.",
      en: "Every part carries a warranty, and the models it fits are listed on its page.",
    },
  },
];

