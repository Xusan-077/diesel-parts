import type { Metadata } from "next";
import { ContentPage } from "@/components/layout/content-page";
import { BrandGrid } from "@/components/marketing/brand-grid";
import { getLocaleDictionary } from "@/lib/i18n/server-locale";
import { canonicalPath } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getLocaleDictionary();
  return {
    title: `${dict.brandsIndex.title} — ${dict.meta.siteName}`,
    description: dict.brandsIndex.subtitle,
    alternates: canonicalPath("/brands"),
  };
}

export default async function BrandsPage() {
  const dict = await getLocaleDictionary();

  return (
    <ContentPage
      title={dict.brandsIndex.title}
      subtitle={dict.brandsIndex.subtitle}
      home={dict.home}
    >
      <h2 className="text-xl font-semibold text-foreground">{dict.brandsIndex.gridTitle}</h2>
      <div className="mt-8">
        <BrandGrid unavailableLabel={dict.common.dataUnavailable} />
      </div>
    </ContentPage>
  );
}
