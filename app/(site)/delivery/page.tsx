import type { Metadata } from "next";
import { ContentPage } from "@/components/layout/content-page";
import { FeatureGrid } from "@/components/marketing/feature-grid";
import { getLocaleDictionary } from "@/lib/i18n/server-locale";
import { canonicalPath } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getLocaleDictionary();
  return {
    title: `${dict.delivery.title} — ${dict.meta.siteName}`,
    description: dict.delivery.subtitle,
    alternates: canonicalPath("/delivery"),
  };
}

export default async function DeliveryPage() {
  const dict = await getLocaleDictionary();

  return (
    <ContentPage
      title={dict.delivery.title}
      subtitle={dict.delivery.subtitle}
      home={dict.home}
    >
      <FeatureGrid items={dict.delivery.items} />
      <p className="mx-auto mt-10 max-w-3xl rounded-lg border border-border bg-surface p-5 text-sm leading-relaxed text-muted">
        {dict.delivery.note}
      </p>
    </ContentPage>
  );
}
