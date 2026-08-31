import type { Metadata } from "next";
import { ContentPage } from "@/components/layout/content-page";
import { FeatureGrid } from "@/components/marketing/feature-grid";
import { getLocaleDictionary } from "@/lib/i18n/server-locale";
import { canonicalPath } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getLocaleDictionary();
  return {
    title: `${dict.partnership.title} — ${dict.meta.siteName}`,
    description: dict.partnership.subtitle,
    alternates: canonicalPath("/partnership"),
  };
}

export default async function PartnershipPage() {
  const dict = await getLocaleDictionary();

  return (
    <ContentPage
      title={dict.partnership.title}
      subtitle={dict.partnership.subtitle}
      home={dict.home}
    >
      <FeatureGrid items={dict.partnership.items} />
      <p className="mx-auto mt-10 max-w-3xl rounded-lg border border-border bg-surface p-5 text-sm leading-relaxed text-muted">
        {dict.partnership.note}
      </p>
    </ContentPage>
  );
}
