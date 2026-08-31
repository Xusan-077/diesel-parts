import type { Metadata } from "next";
import { ContentPage } from "@/components/layout/content-page";
import { FeatureGrid } from "@/components/marketing/feature-grid";
import { getLocaleDictionary } from "@/lib/i18n/server-locale";
import { canonicalPath } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getLocaleDictionary();
  return {
    title: `${dict.services.title} — ${dict.meta.siteName}`,
    description: dict.services.subtitle,
    alternates: canonicalPath("/services"),
  };
}

export default async function ServicesPage() {
  const dict = await getLocaleDictionary();

  return (
    <ContentPage
      title={dict.services.title}
      subtitle={dict.services.subtitle}
      home={dict.home}
    >
      <FeatureGrid items={dict.services.items} />
    </ContentPage>
  );
}
