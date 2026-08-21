import type { Metadata } from "next";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/server-locale";
import { canonicalPath } from "@/lib/seo";
import { QuoteFormWithCart } from "@/components/forms/quote-form-with-cart";
import { Container } from "@/components/ui/container";

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLocale();
  const dict = getDictionary(lang);
  return {
    title: `${dict.requestQuote.title} — ${dict.meta.siteName}`,
    description: dict.requestQuote.subtitle,
    alternates: canonicalPath("/request-quote"),
  };
}

export default async function RequestQuotePage() {
  const lang = await getLocale();
  const dict = getDictionary(lang);

  return (
    <Container as="main" size="prose" className="pb-24 pt-12">
      <h1 className="text-3xl font-semibold text-foreground">{dict.requestQuote.title}</h1>
      <p className="mt-2 text-muted">{dict.requestQuote.subtitle}</p>
      <div className="mt-10">
        <QuoteFormWithCart lang={lang} dict={dict.requestQuote} cartDict={dict.cart} />
      </div>
    </Container>
  );
}
