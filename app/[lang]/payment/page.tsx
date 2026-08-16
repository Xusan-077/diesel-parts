import type { Metadata } from "next";
import { ContentPage } from "@/components/layout/content-page";
import { FaqList } from "@/components/marketing/faq-list";
import { FeatureGrid } from "@/components/marketing/feature-grid";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/locales";
import { localeAlternates } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const dict = getDictionary(lang);
  return {
    title: `${dict.payment.title} — ${dict.meta.siteName}`,
    description: dict.payment.subtitle,
    alternates: localeAlternates(lang, "/payment"),
  };
}

export default async function PaymentPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang = isLocale(rawLang) ? rawLang : DEFAULT_LOCALE;
  const dict = getDictionary(lang);

  return (
    <ContentPage
      lang={lang}
      title={dict.payment.title}
      subtitle={dict.payment.subtitle}
      home={dict.home}
    >
      <h2 className="text-xl font-semibold text-foreground">{dict.payment.methodsTitle}</h2>
      <FeatureGrid items={dict.payment.methods} className="mt-8" />

      <p className="mx-auto mt-10 max-w-3xl rounded-lg border border-border bg-surface-muted p-5 text-sm leading-relaxed text-muted">
        {dict.payment.note}
      </p>

      <section className="mx-auto mt-16 max-w-3xl">
        <h2 className="text-xl font-semibold text-foreground">{dict.payment.faqTitle}</h2>
        <div className="mt-6">
          <FaqList items={dict.payment.faq} />
        </div>
      </section>
    </ContentPage>
  );
}
