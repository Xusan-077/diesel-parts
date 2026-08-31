import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { CheckoutClient } from "@/components/store/checkout-client";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/server-locale";
import { canonicalPath } from "@/lib/seo";
import { Container } from "@/components/ui/container";

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLocale();
  const dict = getDictionary(lang);
  return {
    title: `${dict.checkout.title} — ${dict.meta.siteName}`,
    description: dict.checkout.subtitle,
    alternates: canonicalPath("/checkout"),
    robots: { index: false, follow: true },
  };
}

export default async function CheckoutPage() {
  const lang = await getLocale();
  const dict = getDictionary(lang);

  // Checkout reads the phone-verified session's server cart — the same
  // guard /account uses, redirecting to the sign-in dialog on the home page
  // rather than to a page of its own.
  const session = await getSession();
  if (!session) {
    redirect("/");
  }

  return (
    <Container as="main" size="wide" className="pb-24 pt-12">
      <h1 className="type-page text-foreground">{dict.checkout.title}</h1>
      <p className="mt-2 type-body text-muted">{dict.checkout.subtitle}</p>

      <div className="mt-10">
        <CheckoutClient lang={lang} dict={dict.checkout} cartDict={dict.cart} />
      </div>
    </Container>
  );
}
