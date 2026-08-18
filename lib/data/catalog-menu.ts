import type { LocalizedText } from "@/lib/types";

/**
 * Icon identifier resolved to a component by `components/catalog/catalog-icon.tsx`.
 * Kept as a plain string so this whole module stays serializable and can be
 * swapped for a CMS/API response without touching the rendering code.
 */
export type CatalogIconKey =
  | "antifreeze"
  | "engine"
  | "gasket"
  | "bushing"
  | "injector"
  | "timing"
  | "crank"
  | "pump"
  | "piston"
  | "turbo"
  | "undercarriage"
  | "track"
  | "wheel"
  | "suspension"
  | "bearing"
  | "brake-pad"
  | "brake-disc"
  | "fluid"
  | "hose"
  | "sensor"
  | "cylinder"
  | "valve"
  | "seal"
  | "glass"
  | "seat"
  | "door"
  | "mirror"
  | "climate"
  | "oil-filter"
  | "fuel-filter"
  | "air-filter"
  | "cabin-filter"
  | "adblue"
  | "oil"
  | "battery"
  | "starter"
  | "alternator"
  | "light"
  | "wiring"
  | "gearbox"
  | "clutch"
  | "driveshaft"
  | "reducer";

export interface CatalogSubcategory {
  id: string;
  slug: string;
  name: LocalizedText;
  icon: CatalogIconKey;
  /**
   * Matching id in `prisma/seed-data/categories.ts` when the mock product catalog
   * covers this subcategory. Absent entries simply return no products yet.
   */
  categoryId?: string;
}

export interface CatalogGroup {
  id: string;
  slug: string;
  name: LocalizedText;
  subcategories: CatalogSubcategory[];
}

export const catalogGroups: CatalogGroup[] = [
  {
    id: "undercarriage",
    slug: "yurish-qismi",
    name: { uz: "Yurish qismi", ru: "Ходовая часть", en: "Undercarriage" },
    subcategories: [
      {
        id: "undercarriage-parts",
        slug: "yurish-qismi-detallari",
        name: { uz: "Yurish qismi", ru: "Ходовая часть", en: "Undercarriage" },
        icon: "undercarriage",
        categoryId: "undercarriage",
      },
      {
        id: "track-chain",
        slug: "gusenitsa-zanjiri",
        name: { uz: "Gusenitsa zanjiri", ru: "Гусеничная цепь", en: "Track chain" },
        icon: "track",
        categoryId: "track-chain",
      },
      {
        id: "wheels-tyres",
        slug: "gildirak-va-shinalar",
        name: { uz: "G'ildirak va shinalar", ru: "Колёса и шины", en: "Wheels and tyres" },
        icon: "wheel",
      },
      {
        id: "suspension",
        slug: "osma",
        name: { uz: "Osma", ru: "Подвеска", en: "Suspension" },
        icon: "suspension",
      },
      {
        id: "bearings",
        slug: "podshipniklar",
        name: { uz: "Podshipniklar", ru: "Подшипники", en: "Bearings" },
        icon: "bearing",
      },
    ],
  },
  {
    id: "brakes",
    slug: "tormoz-tizimi",
    name: { uz: "Tormoz tizimi", ru: "Тормозная система", en: "Brake system" },
    subcategories: [
      {
        id: "brake-pads",
        slug: "tormoz-kolodkalari",
        name: { uz: "Tormoz kolodkalari", ru: "Тормозные колодки", en: "Brake pads" },
        icon: "brake-pad",
      },
      {
        id: "brake-discs",
        slug: "tormoz-disklari",
        name: { uz: "Tormoz disklari", ru: "Тормозные диски", en: "Brake discs" },
        icon: "brake-disc",
      },
      {
        id: "brake-fluid",
        slug: "tormoz-suyuqligi",
        name: { uz: "Tormoz suyuqligi", ru: "Тормозная жидкость", en: "Brake fluid" },
        icon: "fluid",
      },
      {
        id: "brake-hoses",
        slug: "tormoz-shlanglari",
        name: { uz: "Tormoz shlanglari", ru: "Тормозные шланги", en: "Brake hoses" },
        icon: "hose",
      },
      {
        id: "abs-sensors",
        slug: "abs-datchiklari",
        name: { uz: "ABS datchiklari", ru: "Датчики ABS", en: "ABS sensors" },
        icon: "sensor",
      },
    ],
  },
  {
    id: "hydraulics",
    slug: "gidravlik-sistema",
    name: { uz: "Gidravlik sistema", ru: "Гидравлическая система", en: "Hydraulic system" },
    subcategories: [
      {
        id: "hydraulic-pump",
        slug: "gidravlik-nasos",
        name: { uz: "Gidravlik nasos", ru: "Гидронасос", en: "Hydraulic pump" },
        icon: "pump",
        categoryId: "hydraulic-pump",
      },
      {
        id: "hydraulic-cylinder",
        slug: "gidrosilindr",
        name: { uz: "Gidrosilindr", ru: "Гидроцилиндр", en: "Hydraulic cylinder" },
        icon: "cylinder",
      },
      {
        id: "valves",
        slug: "klapanlar",
        name: { uz: "Klapanlar", ru: "Клапаны", en: "Valves" },
        icon: "valve",
        categoryId: "valve",
      },
      {
        id: "seal-kits",
        slug: "zichlagich-toplami",
        name: { uz: "Zichlagich to'plami", ru: "Комплект уплотнений", en: "Seal kits" },
        icon: "seal",
        categoryId: "seal-kit",
      },
      {
        id: "hydraulic-hoses",
        slug: "gidravlik-shlanglar",
        name: { uz: "Gidravlik shlanglar", ru: "Гидравлические шланги", en: "Hydraulic hoses" },
        icon: "hose",
      },
      {
        id: "hydraulic-oil",
        slug: "gidravlik-moy",
        name: { uz: "Gidravlik moy", ru: "Гидравлическое масло", en: "Hydraulic oil" },
        icon: "oil",
      },
    ],
  },
  {
    id: "cabin",
    slug: "kabina-va-kuzov",
    name: { uz: "Kabina va kuzov", ru: "Кабина и кузов", en: "Cabin and body" },
    subcategories: [
      {
        id: "cabin-glass",
        slug: "kabina-oynalari",
        name: { uz: "Kabina oynalari", ru: "Стёкла кабины", en: "Cabin glass" },
        icon: "glass",
      },
      {
        id: "seats",
        slug: "orindiqlar",
        name: { uz: "O'rindiqlar", ru: "Сиденья", en: "Seats" },
        icon: "seat",
      },
      {
        id: "doors-locks",
        slug: "eshik-va-qulflar",
        name: { uz: "Eshik va qulflar", ru: "Двери и замки", en: "Doors and locks" },
        icon: "door",
      },
      {
        id: "mirrors",
        slug: "kozgular",
        name: { uz: "Ko'zgular", ru: "Зеркала", en: "Mirrors" },
        icon: "mirror",
      },
      {
        id: "hvac",
        slug: "isitish-va-konditsioner",
        name: {
          uz: "Isitish va konditsioner",
          ru: "Отопление и кондиционер",
          en: "Heating and air conditioning",
        },
        icon: "climate",
      },
    ],
  },
  {
    id: "filters",
    slug: "moy-filtrlar-va-adblue",
    name: {
      uz: "Moy filtrlar va AdBlue",
      ru: "Масляные фильтры и AdBlue",
      en: "Oil filters and AdBlue",
    },
    subcategories: [
      {
        id: "oil-filter",
        slug: "moy-filtri",
        name: { uz: "Moy filtri", ru: "Масляный фильтр", en: "Oil filter" },
        icon: "oil-filter",
      },
      {
        id: "fuel-filter",
        slug: "yoqilgi-filtri",
        name: { uz: "Yoqilg'i filtri", ru: "Топливный фильтр", en: "Fuel filter" },
        icon: "fuel-filter",
      },
      {
        id: "air-filter",
        slug: "havo-filtri",
        name: { uz: "Havo filtri", ru: "Воздушный фильтр", en: "Air filter" },
        icon: "air-filter",
      },
      {
        id: "cabin-filter",
        slug: "salon-filtri",
        name: { uz: "Salon filtri", ru: "Салонный фильтр", en: "Cabin filter" },
        icon: "cabin-filter",
      },
      {
        id: "adblue",
        slug: "adblue",
        name: { uz: "AdBlue", ru: "AdBlue", en: "AdBlue" },
        icon: "adblue",
      },
      {
        id: "engine-oil",
        slug: "motor-moyi",
        name: { uz: "Motor moyi", ru: "Моторное масло", en: "Engine oil" },
        icon: "oil",
      },
    ],
  },
  {
    id: "electrical",
    slug: "elektr-jihozlari-va-aksessuarlar",
    name: {
      uz: "Elektr jihozlari va aksessuarlar",
      ru: "Электрооборудование и аксессуары",
      en: "Electrical equipment and accessories",
    },
    subcategories: [
      {
        id: "battery",
        slug: "akkumulyator",
        name: { uz: "Akkumulyator", ru: "Аккумулятор", en: "Battery" },
        icon: "battery",
      },
      {
        id: "starter",
        slug: "starter",
        name: { uz: "Starter", ru: "Стартер", en: "Starter" },
        icon: "starter",
      },
      {
        id: "alternator",
        slug: "generator",
        name: { uz: "Generator", ru: "Генератор", en: "Alternator" },
        icon: "alternator",
      },
      {
        id: "headlights",
        slug: "faralar",
        name: { uz: "Faralar", ru: "Фары", en: "Headlights" },
        icon: "light",
      },
      {
        id: "sensors",
        slug: "datchiklar",
        name: { uz: "Datchiklar", ru: "Датчики", en: "Sensors" },
        icon: "sensor",
      },
      {
        id: "wiring",
        slug: "simlar-va-ulagichlar",
        name: { uz: "Simlar va ulagichlar", ru: "Провода и разъёмы", en: "Wiring and connectors" },
        icon: "wiring",
      },
    ],
  },
  {
    id: "transmission",
    slug: "transmissiya-kpp",
    name: { uz: "Transmissiya KPP", ru: "Трансмиссия КПП", en: "Transmission" },
    subcategories: [
      {
        id: "gearbox",
        slug: "uzatmalar-qutisi",
        name: { uz: "Uzatmalar qutisi", ru: "Коробка передач", en: "Gearbox" },
        icon: "gearbox",
        categoryId: "transmission",
      },
      {
        id: "clutch",
        slug: "debriyaj",
        name: { uz: "Debriyaj", ru: "Сцепление", en: "Clutch" },
        icon: "clutch",
      },
      {
        id: "driveshaft",
        slug: "kardan-vali",
        name: { uz: "Kardan vali", ru: "Карданный вал", en: "Driveshaft" },
        icon: "driveshaft",
      },
      {
        id: "reducer",
        slug: "reduktor",
        name: { uz: "Reduktor", ru: "Редуктор", en: "Reducer" },
        icon: "reducer",
      },
      {
        id: "transmission-oil",
        slug: "transmissiya-moyi",
        name: { uz: "Transmissiya moyi", ru: "Трансмиссионное масло", en: "Transmission oil" },
        icon: "oil",
      },
    ],
  },
  {
    id: "engine",
    slug: "dvigatel-va-komponentlari",
    name: {
      uz: "Dvigatel va uning komponentlari",
      ru: "Двигатель и его компоненты",
      en: "Engine and its components",
    },
    subcategories: [
      {
        id: "antifreeze",
        slug: "antifriz",
        name: { uz: "Antifriz", ru: "Антифриз", en: "Antifreeze" },
        icon: "antifreeze",
      },
      {
        id: "engine",
        slug: "dvigatel",
        name: { uz: "Dvigatel", ru: "Двигатель", en: "Engine" },
        icon: "engine",
        categoryId: "engine-parts",
      },
      {
        id: "engine-gaskets",
        slug: "dvigatel-prokladkalari",
        name: { uz: "Dvigatel prokladkalari", ru: "Прокладки двигателя", en: "Engine gaskets" },
        icon: "gasket",
      },
      {
        id: "engine-bushings",
        slug: "dvigatel-vtulkalari",
        name: { uz: "Dvigatel vtulkalari", ru: "Втулки двигателя", en: "Engine bushings" },
        icon: "bushing",
      },
      {
        id: "injectors",
        slug: "forsunkalar",
        name: { uz: "Forsunkalar", ru: "Форсунки", en: "Injectors" },
        icon: "injector",
        categoryId: "injector",
      },
      {
        id: "timing-gear",
        slug: "gaz-taqsimlash-mexanizmi",
        name: {
          uz: "Gaz taqsimlash mexanizmi",
          ru: "Газораспределительный механизм",
          en: "Timing mechanism",
        },
        icon: "timing",
      },
      {
        id: "crank-mechanism",
        slug: "krivoship-shatunli-mexanizm",
        name: {
          uz: "Krivoship-shatunli mexanizm",
          ru: "Кривошипно-шатунный механизм",
          en: "Crank mechanism",
        },
        icon: "crank",
      },
      {
        id: "pumps",
        slug: "nasoslar",
        name: { uz: "Nasoslar", ru: "Насосы", en: "Pumps" },
        icon: "pump",
      },
      {
        id: "piston-group",
        slug: "porshen-guruhi",
        name: { uz: "Porshen guruhi", ru: "Поршневая группа", en: "Piston group" },
        icon: "piston",
        categoryId: "piston",
      },
      {
        id: "turbocharger",
        slug: "turbokompressor",
        name: { uz: "Turbokompressor", ru: "Турбокомпрессор", en: "Turbocharger" },
        icon: "turbo",
        categoryId: "turbocharger",
      },
    ],
  },
];
