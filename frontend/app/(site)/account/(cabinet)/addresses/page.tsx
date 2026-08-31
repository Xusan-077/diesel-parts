import type { Metadata } from "next";
import { AccountEmptySection } from "@/components/account/account-section";
import { getLocaleDictionary } from "@/lib/i18n/server-locale";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getLocaleDictionary();
  return {
    title: `${dict.account.profilePanel.nav.addresses} — ${dict.meta.siteName}`,
    robots: { index: false, follow: false },
  };
}

export default async function AccountAddressesPage() {
  const dict = await getLocaleDictionary();

  return (
    <AccountEmptySection
      panel={dict.account.profilePanel}
      section="addresses"
      ordersCta={dict.account.ordersEmptyCta}
    />
  );
}
