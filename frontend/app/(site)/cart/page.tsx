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
    /*
     * The site's own width, not a narrower one.
     *
     * The cart and the wishlist were the only two shopping screens that set a
     * measure of their own — `wide` (max-w-6xl) here and `content`
     * (max-w-5xl) there — while the header, the breadcrumb the layout renders
     * directly above this heading, the footer and /products are all on the
     * default max-w-7xl. On a desktop that put this title 64px inside the
     * breadcrumb above it and the wishlist's 128px inside, so the page
     * visibly stepped in from its own chrome, and the two screens a shopper
     * moves between disagreed with each other as well.
     *
     * `wide` is still the right measure for a screen that is genuinely a
     * two-column form — /account keeps it. A cart is a list of products with
     * a summary beside it, and it belongs at the width the rest of the
     * catalogue is read at.
     */
    <Container as="main" className="pb-24 pt-12">
      <h1 className="text-3xl font-semibold text-foreground">{dict.cart.title}</h1>
      <p className="mt-2 text-muted">{dict.cart.subtitle}</p>

      <div className="mt-10">
        <CartClient lang={lang} dict={dict.cart} stock={dict.common.stock} />
      </div>
    </Container>
  );
}
