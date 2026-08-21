## Avtonom rejim

Vazifani oxirigacha o'zing bajar — oraliq qarorlar uchun mendan tasdiq so'rama.

Qoidalar:
- Ikki yoki undan ortiq oqilona yechim bo'lsa, o'zing birini tanla,
  sababini xulosada yoz (savol qilib emas, bayonot sifatida).
- Root cause topilmaguncha to'xtama, xatoni suppress qilma.
- Har bir o'zgarishdan keyin: tsc, eslint, test, build — barchasi
  toza bo'lmaguncha "bajarildi" dema.
- Backward-compat yoki mavjud ko'rinishni buzadigan joy topilsa —
  shuni ham o'zing hal qil (masalan eski klasslarni saqlab qolish),
  faqat NIMA va NEGA qilganingni xulosada aniq yoz.
- Faqat quyidagi hollarda to'xta va so'ra:
  1. Parol/token/secret bilan ishlash kerak bo'lsa
  2. Production ma'lumotlarini o'chirish/o'zgartirish kerak bo'lsa
  3. Vazifa doirasidan tashqariga chiqadigan (scope creep) katta
     arxitektura o'zgarishi kerak bo'lsa
- Xulosada har doim: nima qilindi, nega shu yo'l tanlandi, tekshiruv
  natijalari (test/build), va keyingi safar uchun ochiq qolgan narsa
  bo'lsa — bittagina jumlada.