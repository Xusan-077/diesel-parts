import { DEFAULT_LOCALE, isLocale, type Locale } from "./locales";

/**
 * The staff panel's own strings.
 *
 * Deliberately not folded into `dictionaries/*.json`. Those three files are the
 * marketing site's copy — product prose, SEO titles, legal pages — and they are
 * loaded whole. Bolting a back-office vocabulary onto them would mean every
 * public page pays for the panel's table headers and every panel screen pays
 * for the site's hero copy.
 *
 * It is a TypeScript record rather than JSON for one reason: the shape is
 * checked. `PanelDictionary` is derived from the Uzbek set, so a key added
 * there and forgotten in Russian is a compile error rather than an English
 * word turning up on a Russian screen weeks later.
 *
 * Coverage is the shell plus the dashboard. Every other panel screen still
 * renders its own Uzbek.
 */
const uz = {
  brand: "Diesel Parts",
  role: { DIRECTOR: "Direktor", SELLER: "Sotuvchi" },

  nav: {
    label: "Panel bo'limlari",
    groups: {
      overview: "Umumiy",
      catalog: "Katalog",
      sales: "Savdo",
      management: "Boshqaruv",
    },
    items: {
      "/director": "Ko'rsatkichlar",
      "/director/analytics": "Analitika",
      "/director/products": "Mahsulotlar",
      "/director/categories": "Kategoriyalar",
      "/director/discounts": "Chegirmalar",
      "/director/reviews": "Sharhlar",
      "/director/users": "Xodimlar",
      "/director/audit": "Amallar tarixi",
      "/admin/seller": "Ish stoli",
      "/admin/seller/inquiries": "So'rovlar",
      "/admin/seller/customers": "Mijozlar",
      "/admin/seller/orders": "Buyurtmalar",
    },
  },

  topbar: {
    searchPlaceholder: "Bo'limlarni qidirish",
    searchOpen: "Qidiruvni ochish",
    searchTitle: "Bo'limga o'tish",
    searchEmpty: "Hech narsa topilmadi",
    searchHint: "O'tish uchun Enter, yopish uchun Esc",
    approvals: "Tasdiqlash kutilmoqda",
    inquiries: "Yangi so'rovlar",
    openMenu: "Menyuni ochish",
    closeMenu: "Menyuni yopish",
    collapse: "Panelni yig'ish",
    expand: "Panelni kengaytirish",
    none: "Yo'q",
  },

  profile: {
    open: "Profil menyusi",
    darkMode: "Tungi rejim",
    accent: "Rang to'plami",
    language: "Til",
    quickLinks: "Tezkor havolalar",
    signOut: "Chiqish",
    signingOut: "Chiqilmoqda…",
  },

  accents: {
    orange: "Brend",
    blue: "Havo",
    green: "Sovutgich",
    violet: "Siyoh",
    teal: "Bosim",
  },

  dashboard: {
    eyebrow: "Direktor paneli",
    title: "Ko'rsatkichlar",
    comparison: "oldingi {days} kunga nisbatan",
    periodLabel: "Davr",
    statusLabel: "Holat",

    revenue: "Daromad",
    orders: "Buyurtmalar",
    average: "O'rtacha chek",
    pipeline: "Jarayondagi summa",
    currency: "so'm",
    averageHint: "Yakunlangan {orders} buyurtma bo'yicha",
    pipelineHint: "Tasdiqlangan va kutilayotgan · belgi: davr savdosi",
    noComparison: "Taqqoslash uchun ma'lumot yo'q",

    trendTitle: "To'plangan daromad",
    trendDescription: "Davr boshidan qo'shilib boradi; kunlik raqamlar jadval ko'rinishida",
    trendCurrent: "Oxirgi {days} kun",
    trendPrevious: "Oldingi {days} kun",

    mixTitle: "Buyurtmalar holati",
    mixDescription: "Tanlangan davrda ochilgan buyurtmalar",
    mixCompleted: "Yakunlangan",
    mixOpen: "Jarayonda",
    mixCancelled: "Bekor qilingan",
    mixEmpty: "Bu davrda buyurtma ochilmagan.",

    sellersTitle: "Sotuvchilar reytingi",
    sellersDescription: "Tanlangan davrdagi yakunlangan savdo",
    sellersEmpty: "Bu davrda yakunlangan buyurtma yo'q.",
    sellerOrders: "{count} ta buyurtma",

    stockTitle: "Kam qolgan zaxira",
    stockDescription: "Minimal chegaraga yetgan yoki tugagan",
    stockEmpty: "Hamma mahsulot zaxirasi yetarli.",
    stockOut: "tugagan",
    stockLow: "kam",
    stockRemaining: "eng kami {min} dona",

    recentTitle: "Oxirgi buyurtmalar",
    recentDescription: "Barcha holatlar bo'yicha, eng yangisidan",
    recentEmpty: "Hali birorta buyurtma ochilmagan.",

    queueInquiries: "Yangi so'rovlar",
    queueInquiriesHint: "Hali sotuvchiga biriktirilmagan",
    queueDiscounts: "Chegirma so'rovlari",
    queueDiscountsHint: "Tasdiqlash kutilmoqda",
    queueSellers: "Faol sotuvchilar",
    queueSellersHint: "Davr savdosi {revenue} so'm",

    seeAll: "Barchasi",
  },

  period: { "7": "7 kun", "30": "30 kun", "90": "90 kun" },

  status: {
    DRAFT: "Qoralama",
    PENDING: "Kutilmoqda",
    PAYMENT_PENDING: "To'lov kutilmoqda",
    PAYMENT_FAILED: "To'lov muvaffaqiyatsiz",
    PAID: "To'langan",
    CONFIRMED: "Tasdiqlangan",
    PROCESSING: "Tayyorlanmoqda",
    READY_FOR_SHIPMENT: "Jo'natishga tayyor",
    SHIPPED: "Jo'natildi",
    DELIVERED: "Yetkazildi",
    COMPLETED: "Yakunlangan",
    CANCELLED: "Bekor qilingan",
    REFUNDED: "Qaytarildi",
  },
} as const;

/**
 * The Uzbek set's shape, widened to plain strings.
 *
 * `as const` above is what gives `nav.items` its exact key set, so a typo in a
 * route key is caught; this mapped type then lets Russian and English supply
 * their own words for those same keys.
 */
export type PanelDictionary = {
  [Section in keyof typeof uz]: (typeof uz)[Section] extends string
    ? string
    : {
        [Key in keyof (typeof uz)[Section]]: (typeof uz)[Section][Key] extends string
          ? string
          : { [Nested in keyof (typeof uz)[Section][Key]]: string };
      };
};

const ru: PanelDictionary = {
  brand: "Diesel Parts",
  role: { DIRECTOR: "Директор", SELLER: "Продавец" },

  nav: {
    label: "Разделы панели",
    groups: {
      overview: "Обзор",
      catalog: "Каталог",
      sales: "Продажи",
      management: "Управление",
    },
    items: {
      "/director": "Показатели",
      "/director/analytics": "Аналитика",
      "/director/products": "Товары",
      "/director/categories": "Категории",
      "/director/discounts": "Скидки",
      "/director/reviews": "Отзывы",
      "/director/users": "Сотрудники",
      "/director/audit": "История действий",
      "/admin/seller": "Рабочий стол",
      "/admin/seller/inquiries": "Запросы",
      "/admin/seller/customers": "Клиенты",
      "/admin/seller/orders": "Заказы",
    },
  },

  topbar: {
    searchPlaceholder: "Поиск по разделам",
    searchOpen: "Открыть поиск",
    searchTitle: "Перейти в раздел",
    searchEmpty: "Ничего не найдено",
    searchHint: "Enter — перейти, Esc — закрыть",
    approvals: "Ждут подтверждения",
    inquiries: "Новые запросы",
    openMenu: "Открыть меню",
    closeMenu: "Закрыть меню",
    collapse: "Свернуть панель",
    expand: "Развернуть панель",
    none: "Нет",
  },

  profile: {
    open: "Меню профиля",
    darkMode: "Тёмная тема",
    accent: "Цветовой набор",
    language: "Язык",
    quickLinks: "Быстрые ссылки",
    signOut: "Выйти",
    signingOut: "Выходим…",
  },

  accents: {
    orange: "Бренд",
    blue: "Гидравлика",
    green: "Охлаждение",
    violet: "Чернила",
    teal: "Давление",
  },

  dashboard: {
    eyebrow: "Панель директора",
    title: "Показатели",
    comparison: "к предыдущим {days} дням",
    periodLabel: "Период",
    statusLabel: "Статус",

    revenue: "Выручка",
    orders: "Заказы",
    average: "Средний чек",
    pipeline: "Сумма в работе",
    currency: "сум",
    averageHint: "По {orders} завершённым заказам",
    pipelineHint: "Подтверждённые и ожидающие · метка: выручка периода",
    noComparison: "Нет данных для сравнения",

    trendTitle: "Накопленная выручка",
    trendDescription: "Складывается с начала периода; дневные цифры — в таблице",
    trendCurrent: "Последние {days} дней",
    trendPrevious: "Предыдущие {days} дней",

    mixTitle: "Статусы заказов",
    mixDescription: "Заказы, открытые в выбранном периоде",
    mixCompleted: "Завершены",
    mixOpen: "В работе",
    mixCancelled: "Отменены",
    mixEmpty: "В этом периоде заказов не было.",

    sellersTitle: "Рейтинг продавцов",
    sellersDescription: "Завершённые продажи за период",
    sellersEmpty: "В этом периоде нет завершённых заказов.",
    sellerOrders: "{count} заказов",

    stockTitle: "Заканчивается на складе",
    stockDescription: "Достигли минимума или закончились",
    stockEmpty: "Запасов хватает по всем товарам.",
    stockOut: "нет",
    stockLow: "мало",
    stockRemaining: "минимум {min} шт",

    recentTitle: "Последние заказы",
    recentDescription: "Все статусы, начиная с новых",
    recentEmpty: "Заказов пока нет.",

    queueInquiries: "Новые запросы",
    queueInquiriesHint: "Ещё не закреплены за продавцом",
    queueDiscounts: "Запросы на скидку",
    queueDiscountsHint: "Ждут подтверждения",
    queueSellers: "Активные продавцы",
    queueSellersHint: "Выручка периода {revenue} сум",

    seeAll: "Все",
  },

  period: { "7": "7 дней", "30": "30 дней", "90": "90 дней" },

  status: {
    DRAFT: "Черновик",
    PENDING: "Ожидает",
    PAYMENT_PENDING: "Ожидает оплаты",
    PAYMENT_FAILED: "Оплата не прошла",
    PAID: "Оплачен",
    CONFIRMED: "Подтверждён",
    PROCESSING: "В обработке",
    READY_FOR_SHIPMENT: "Готов к отправке",
    SHIPPED: "Отправлен",
    DELIVERED: "Доставлен",
    COMPLETED: "Завершён",
    CANCELLED: "Отменён",
    REFUNDED: "Возвращён",
  },
};

const en: PanelDictionary = {
  brand: "Diesel Parts",
  role: { DIRECTOR: "Director", SELLER: "Seller" },

  nav: {
    label: "Panel sections",
    groups: {
      overview: "Overview",
      catalog: "Catalogue",
      sales: "Sales",
      management: "Management",
    },
    items: {
      "/director": "Dashboard",
      "/director/analytics": "Analytics",
      "/director/products": "Products",
      "/director/categories": "Categories",
      "/director/discounts": "Discounts",
      "/director/reviews": "Reviews",
      "/director/users": "Staff",
      "/director/audit": "Activity log",
      "/admin/seller": "Workspace",
      "/admin/seller/inquiries": "Inquiries",
      "/admin/seller/customers": "Customers",
      "/admin/seller/orders": "Orders",
    },
  },

  topbar: {
    searchPlaceholder: "Search sections",
    searchOpen: "Open search",
    searchTitle: "Go to section",
    searchEmpty: "Nothing found",
    searchHint: "Enter to open, Esc to close",
    approvals: "Waiting for approval",
    inquiries: "New inquiries",
    openMenu: "Open menu",
    closeMenu: "Close menu",
    collapse: "Collapse sidebar",
    expand: "Expand sidebar",
    none: "None",
  },

  profile: {
    open: "Profile menu",
    darkMode: "Dark mode",
    accent: "Accent set",
    language: "Language",
    quickLinks: "Quick links",
    signOut: "Sign out",
    signingOut: "Signing out…",
  },

  accents: {
    orange: "Brand",
    blue: "Hydraulic",
    green: "Coolant",
    violet: "Ink",
    teal: "Pressure",
  },

  dashboard: {
    eyebrow: "Director panel",
    title: "Dashboard",
    comparison: "vs the previous {days} days",
    periodLabel: "Period",
    statusLabel: "Status",

    revenue: "Revenue",
    orders: "Orders",
    average: "Average order",
    pipeline: "In pipeline",
    currency: "UZS",
    averageHint: "Across {orders} completed orders",
    pipelineHint: "Confirmed and pending · mark: period revenue",
    noComparison: "No comparison available",

    trendTitle: "Cumulative revenue",
    trendDescription: "Adds up from the start of the period; daily figures in the table view",
    trendCurrent: "Last {days} days",
    trendPrevious: "Previous {days} days",

    mixTitle: "Order status",
    mixDescription: "Orders opened in the selected period",
    mixCompleted: "Completed",
    mixOpen: "In progress",
    mixCancelled: "Cancelled",
    mixEmpty: "No orders were opened in this period.",

    sellersTitle: "Seller ranking",
    sellersDescription: "Completed sales in the selected period",
    sellersEmpty: "No completed orders in this period.",
    sellerOrders: "{count} orders",

    stockTitle: "Running low",
    stockDescription: "At or below the minimum level",
    stockEmpty: "Every product has enough stock.",
    stockOut: "out",
    stockLow: "low",
    stockRemaining: "min {min} units",

    recentTitle: "Recent orders",
    recentDescription: "All statuses, newest first",
    recentEmpty: "No orders have been opened yet.",

    queueInquiries: "New inquiries",
    queueInquiriesHint: "Not yet assigned to a seller",
    queueDiscounts: "Discount requests",
    queueDiscountsHint: "Waiting for approval",
    queueSellers: "Active sellers",
    queueSellersHint: "Period revenue {revenue} UZS",

    seeAll: "See all",
  },

  period: { "7": "7 days", "30": "30 days", "90": "90 days" },

  status: {
    DRAFT: "Draft",
    PENDING: "Pending",
    PAYMENT_PENDING: "Awaiting payment",
    PAYMENT_FAILED: "Payment failed",
    PAID: "Paid",
    CONFIRMED: "Confirmed",
    PROCESSING: "Processing",
    READY_FOR_SHIPMENT: "Ready for shipment",
    SHIPPED: "Shipped",
    DELIVERED: "Delivered",
    COMPLETED: "Completed",
    CANCELLED: "Cancelled",
    REFUNDED: "Refunded",
  },
};

const PANEL_DICTIONARIES: Record<Locale, PanelDictionary> = { uz, ru, en };

export function getPanelDictionary(locale: string): PanelDictionary {
  return PANEL_DICTIONARIES[isLocale(locale) ? locale : DEFAULT_LOCALE];
}

/**
 * A section's label in the current language, by route.
 *
 * `nav.items` is keyed by the exact route strings, which is what catches a typo
 * at compile time — and which also means a plain lookup with a `string` is a
 * type error. This is the one place that widening happens, with the entry's own
 * Uzbek label as the fallback, so a route added to `ADMIN_NAV` and forgotten
 * here renders its name instead of `undefined`.
 */
export function navLabel(dict: PanelDictionary, href: string, fallback: string): string {
  return (dict.nav.items as Record<string, string | undefined>)[href] ?? fallback;
}

/**
 * `{days}` and friends, filled in.
 *
 * Word order differs across the three locales — "oldingi 30 kunga nisbatan"
 * puts the number in the middle, "vs the previous 30 days" puts it at the end —
 * so the number cannot be concatenated at the call site without one of the
 * three reading like a translation. A placeholder is the whole fix.
 */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in values ? String(values[key]) : whole,
  );
}
