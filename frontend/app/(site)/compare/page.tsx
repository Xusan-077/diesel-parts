import type { Metadata } from "next";
import { CompareClient } from "@/components/store/compare-client";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/server-locale";
import { canonicalPath } from "@/lib/seo";
import { Container } from "@/components/ui/container";

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLocale();
  const dict = getDictionary(lang);
  return {
    title: `${dict.compare.title} — ${dict.meta.siteName}`,
    description: dict.compare.subtitle,
    alternates: canonicalPath("/compare"),
    robots: { index: false, follow: true },
  };
}

export default async function ComparePage() {
  const lang = await getLocale();
  const dict = getDictionary(lang);

  // `min-w-0` stops the wide comparison table from stretching the whole page:
  // body is a column flex container, whose items default to `min-width: auto`.
  return (
    <Container as="main" className="min-w-0 pb-24 pt-12">
      <h1 className="text-3xl font-semibold text-foreground">{dict.compare.title}</h1>
      <p className="mt-2 text-muted">{dict.compare.subtitle}</p>

      <div className="mt-10">
        <CompareClient lang={lang} dict={dict.compare} stock={dict.common.stock} />
      </div>
    </Container>
  );
}
