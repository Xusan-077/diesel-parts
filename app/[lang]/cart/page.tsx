import type { Metadata } from "next";
import { CartClient } from "@/components/store/cart-client";
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
    title: `${dict.cart.title} — ${dict.meta.siteName}`,
    description: dict.cart.subtitle,
    alternates: localeAlternates(lang, "/cart"),
    robots: { index: false, follow: true },
  };
}

export default async function CartPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang = isLocale(rawLang) ? rawLang : DEFAULT_LOCALE;
  const dict = getDictionary(lang);

  return (
    <Container as="main" size="wide" className="pb-24 pt-12">
      <h1 className="text-3xl font-semibold text-foreground">{dict.cart.title}</h1>
      <p className="mt-2 text-muted">{dict.cart.subtitle}</p>

      <div className="mt-10">
        <CartClient lang={lang} dict={dict.cart} stock={dict.common.stock} />
      </div>
    </Container>
  );
}
