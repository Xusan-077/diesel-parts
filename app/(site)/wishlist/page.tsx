import type { Metadata } from "next";
import { WishlistClient } from "@/components/store/wishlist-client";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/server-locale";
import { canonicalPath } from "@/lib/seo";
import { Container } from "@/components/ui/container";

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLocale();
  const dict = getDictionary(lang);
  return {
    title: `${dict.wishlist.title} — ${dict.meta.siteName}`,
    description: dict.wishlist.subtitle,
    alternates: canonicalPath("/wishlist"),
    robots: { index: false, follow: true },
  };
}

export default async function WishlistPage() {
  const lang = await getLocale();
  const dict = getDictionary(lang);

  return (
    <Container as="main" size="content" className="pb-24 pt-12">
      <h1 className="text-3xl font-semibold text-foreground">{dict.wishlist.title}</h1>
      <p className="mt-2 text-muted">{dict.wishlist.subtitle}</p>

      <div className="mt-10">
        <WishlistClient lang={lang} dict={dict.wishlist} stock={dict.common.stock} />
      </div>
    </Container>
  );
}
