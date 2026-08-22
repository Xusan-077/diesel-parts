import type { Metadata } from "next";
import { AccountEmptySection } from "@/components/account/account-section";
import { getLocaleDictionary } from "@/lib/i18n/server-locale";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getLocaleDictionary();
  return {
    title: `${dict.account.profilePanel.nav.orders} — ${dict.meta.siteName}`,
    robots: { index: false, follow: false },
  };
}

export default async function AccountOrdersPage() {
  const dict = await getLocaleDictionary();

  return (
    <AccountEmptySection
      panel={dict.account.profilePanel}
      section="orders"
      ordersCta={dict.account.ordersEmptyCta}
    />
  );
}
