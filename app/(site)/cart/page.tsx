import type { Metadata } from "next";
import { CartClient } from "@/components/store/cart-client";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/server-locale";
import { canonicalPath } from "@/lib/seo";
import { Container } from "@/components/ui/container";

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLocale();
  const dict = getDictionary(lang);
  return {
    title: `${dict.cart.title} — ${dict.meta.siteName}`,
    description: dict.cart.subtitle,
    alternates: canonicalPath("/cart"),
    robots: { index: false, follow: true },
  };
}

export default async function CartPage() {
  const lang = await getLocale();
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
