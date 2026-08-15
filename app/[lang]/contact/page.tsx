import type { Metadata } from "next";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/locales";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const dict = getDictionary(lang);
  return {
    title: `${dict.contact.title} — ${dict.meta.siteName}`,
    description: dict.contact.subtitle,
  };
}

export default async function ContactPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang = isLocale(rawLang) ? rawLang : DEFAULT_LOCALE;
  const dict = getDictionary(lang);

  const info = [
    { title: dict.contact.addressTitle, value: dict.contact.address },
    { title: dict.contact.phoneTitle, value: dict.contact.phone },
    { title: dict.contact.emailTitle, value: dict.contact.email },
    { title: dict.contact.hoursTitle, value: dict.contact.hours },
  ];

  return (
    <main className="mx-auto max-w-4xl px-6 pb-24 pt-24">
      <h1 className="text-3xl font-semibold text-foreground">{dict.contact.title}</h1>
      <p className="mt-2 text-muted">{dict.contact.subtitle}</p>

      <div className="mt-10 grid gap-6 sm:grid-cols-2">
        {info.map((item) => (
          <div key={item.title} className="rounded-lg border border-border bg-white/2 p-6">
            <p className="text-sm text-muted">{item.title}</p>
            <p className="mt-1 text-foreground">{item.value}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
