import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AccountEmptySection } from "@/components/account/account-section";
import { AccountOrders, AccountOrdersError } from "@/components/account/account-orders";
import type { AccountOrder } from "@/lib/account/orders";
import { listAccountOrders } from "@/lib/api/account-orders";
import { getSession } from "@/lib/auth/session";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale, getLocaleDictionary } from "@/lib/i18n/server-locale";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getLocaleDictionary();
  return {
    title: `${dict.account.profilePanel.nav.orders} — ${dict.meta.siteName}`,
    robots: { index: false, follow: false },
  };
}

export default async function AccountOrdersPage() {
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const title = dict.account.profilePanel.nav.orders;

  // The cabinet layout already bounces a visitor without a session; this
  // repeats the check only because the page needs the phone for itself.
  const session = await getSession();
  if (!session) {
    redirect("/");
  }

  let orders: AccountOrder[];
  try {
    orders = await listAccountOrders(session.phone);
  } catch (error) {
    console.error("[account/orders] failed to load order history", error);
    return <AccountOrdersError title={title} message={dict.account.orderHistory.loadError} />;
  }

  if (orders.length === 0) {
    return (
      <AccountEmptySection
        panel={dict.account.profilePanel}
        section="orders"
        ordersCta={dict.account.ordersEmptyCta}
      />
    );
  }

  return <AccountOrders title={title} orders={orders} dict={dict.account.orderHistory} locale={locale} />;
}
