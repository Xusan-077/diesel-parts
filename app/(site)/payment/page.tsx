import type { Metadata } from "next";
import { ContentPage } from "@/components/layout/content-page";
import { FaqList } from "@/components/marketing/faq-list";
import { FeatureGrid } from "@/components/marketing/feature-grid";
import { getLocaleDictionary } from "@/lib/i18n/server-locale";
import { canonicalPath } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getLocaleDictionary();
  return {
    title: `${dict.payment.title} — ${dict.meta.siteName}`,
    description: dict.payment.subtitle,
    alternates: canonicalPath("/payment"),
  };
}

export default async function PaymentPage() {
  const dict = await getLocaleDictionary();

  return (
    <ContentPage
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
