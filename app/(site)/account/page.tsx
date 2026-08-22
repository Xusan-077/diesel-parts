import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AccountCabinet } from "@/components/account/account-cabinet";
import { formatPhone } from "@/lib/auth/phone";
import { getSession } from "@/lib/auth/session";
import { getLocaleDictionary } from "@/lib/i18n/server-locale";
import { Container } from "@/components/ui/container";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getLocaleDictionary();
  return {
    title: `${dict.account.profileTitle} — ${dict.meta.siteName}`,
    robots: { index: false, follow: false },
  };
}

export default async function AccountPage() {
  const dict = await getLocaleDictionary();

  const session = await getSession();
  if (!session) {
    // Signing in is a dialog on the header now, not a page of its own.
    redirect("/");
  }

  return (
    <Container as="div" size="wide" className="pb-24 pt-10">
      <h1 className="type-page text-foreground">{dict.account.profileTitle}</h1>
      <p className="mt-2 type-body text-muted">{dict.account.profileSubtitle}</p>

      <div className="mt-8">
        <AccountCabinet dict={dict.account} phone={formatPhone(session.phone)} />
      </div>
    </Container>
  );
}
