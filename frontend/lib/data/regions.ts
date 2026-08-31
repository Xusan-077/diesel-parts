import type { LocalizedText } from "@/lib/types";

export interface Region {
  id: string;
  name: LocalizedText;
}

export const regions: Region[] = [
  {
    id: "navoiy",
    name: { uz: "Navoiy viloyati", ru: "Навоийская область", en: "Navoiy region" },
  },
  {
    id: "tashkent-city",
    name: { uz: "Toshkent shahri", ru: "город Ташкент", en: "Tashkent city" },
  },
  {
    id: "tashkent",
    name: { uz: "Toshkent viloyati", ru: "Ташкентская область", en: "Tashkent region" },
  },
  {
    id: "samarkand",
    name: { uz: "Samarqand viloyati", ru: "Самаркандская область", en: "Samarkand region" },
  },
  {
    id: "bukhara",
    name: { uz: "Buxoro viloyati", ru: "Бухарская область", en: "Bukhara region" },
  },
  {
    id: "andijan",
    name: { uz: "Andijon viloyati", ru: "Андижанская область", en: "Andijan region" },
  },
  {
    id: "fergana",
    name: { uz: "Farg'ona viloyati", ru: "Ферганская область", en: "Fergana region" },
  },
  {
    id: "namangan",
    name: { uz: "Namangan viloyati", ru: "Наманганская область", en: "Namangan region" },
  },
  {
    id: "qashqadaryo",
    name: { uz: "Qashqadaryo viloyati", ru: "Кашкадарьинская область", en: "Qashqadaryo region" },
  },
  {
    id: "surxondaryo",
    name: { uz: "Surxondaryo viloyati", ru: "Сурхандарьинская область", en: "Surxondaryo region" },
  },
  {
    id: "jizzakh",
    name: { uz: "Jizzax viloyati", ru: "Джизакская область", en: "Jizzakh region" },
  },
  {
    id: "sirdaryo",
    name: { uz: "Sirdaryo viloyati", ru: "Сырдарьинская область", en: "Sirdaryo region" },
  },
  {
    id: "khorezm",
    name: { uz: "Xorazm viloyati", ru: "Хорезмская область", en: "Khorezm region" },
  },
  {
    id: "karakalpakstan",
    name: {
      uz: "Qoraqalpog'iston Respublikasi",
      ru: "Республика Каракалпакстан",
      en: "Republic of Karakalpakstan",
    },
  },
];

export const DEFAULT_REGION_ID = "tashkent-city";
