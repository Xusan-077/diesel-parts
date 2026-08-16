import type { Metadata } from "next";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/locales";
import { localeAlternates } from "@/lib/seo";
import { Container } from "@/components/ui/container";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const dict = getDictionary(lang);
  return {
    title: `${dict.about.title} — ${dict.meta.siteName}`,
    description: dict.about.storyParagraphs[0],
    alternates: localeAlternates(lang, "/about"),
  };
}

export default async function AboutPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang = isLocale(rawLang) ? rawLang : DEFAULT_LOCALE;
  const dict = getDictionary(lang);

  return (
    <Container as="main" size="narrow" className="pb-24 pt-12">
      <h1 className="text-3xl font-semibold text-foreground">{dict.about.title}</h1>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-foreground">{dict.about.storyTitle}</h2>
        <div className="mt-4 space-y-4 text-muted">
          {dict.about.storyParagraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </section>

      <section className="mt-16">
        <h2 className="text-xl font-semibold text-foreground">{dict.about.statsTitle}</h2>
        <div className="mt-6 grid grid-cols-2 gap-6 sm:grid-cols-4">
          {dict.about.stats.map((stat) => (
            <div key={stat.label} className="rounded-lg border border-border bg-surface-muted p-6 text-center">
              <p className="text-3xl font-semibold text-accent-strong">{stat.value}</p>
              <p className="mt-1 text-sm text-muted">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>
    </Container>
  );
}
