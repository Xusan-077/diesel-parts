import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { CheckoutStatusClient } from "@/components/store/checkout-status-client";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/server-locale";
import { Container } from "@/components/ui/container";

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLocale();
  const dict = getDictionary(lang);
  return {
    title: `${dict.checkout.statusProcessingTitle} — ${dict.meta.siteName}`,
    robots: { index: false, follow: false },
  };
}

export default async function CheckoutStatusPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const lang = await getLocale();
  const dict = getDictionary(lang);

  // Same guard /checkout itself uses: no session, no order to check.
  const session = await getSession();
  if (!session) {
    redirect("/");
  }

  const { orderId } = await params;

  return (
    <Container as="main" size="prose" className="pb-24 pt-12">
      <CheckoutStatusClient orderId={orderId} dict={dict.checkout} />
    </Container>
  );
}
