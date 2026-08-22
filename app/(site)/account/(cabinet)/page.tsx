import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AccountDetails } from "@/components/account/account-details";
import { formatPhone } from "@/lib/auth/phone";
import { getSession } from "@/lib/auth/session";
import { getLocaleDictionary } from "@/lib/i18n/server-locale";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getLocaleDictionary();
  return {
    title: `${dict.account.profileTitle} — ${dict.meta.siteName}`,
    robots: { index: false, follow: false },
  };
}

/**
 * The cabinet's index: the visitor's own details.
 *
 * It is served at /account rather than at /account/details so that the menu's
 * first row and the cabinet's own address are the same URL — see
 * `accountSectionHref` in lib/account/nav.ts.
 *
 * The session is read again here rather than threaded down from the layout,
 * which a layout cannot do: it is a cookie read and a token verify, no
 * database behind it.
 */
export default async function AccountDetailsPage() {
  const dict = await getLocaleDictionary();

  const session = await getSession();
  if (!session) {
    redirect("/");
  }

  return <AccountDetails dict={dict.account} phone={formatPhone(session.phone)} />;
}
