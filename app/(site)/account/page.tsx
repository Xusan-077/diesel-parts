import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PackageOpen } from "lucide-react";
import { LogoutButton } from "@/components/account/logout-button";
import { formatPhone } from "@/lib/auth/phone";
import { getSession } from "@/lib/auth/session";
import { getLocaleDictionary } from "@/lib/i18n/server-locale";
import { Container } from "@/components/ui/container";
import { Icon } from "@/components/ui/icon";

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
    redirect("/account/login");
  }

  return (
    <Container as="main" size="narrow" className="pb-24 pt-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">{dict.account.profileTitle}</h1>
          <p className="mt-2 text-muted">{dict.account.profileSubtitle}</p>
        </div>
        <LogoutButton
          label={dict.account.logout}
          signedOutLabel={dict.account.toastSignedOut}
        />
      </div>

      <section className="mt-10 rounded-lg border border-border bg-surface-muted p-6">
        <h2 className="text-base font-semibold text-foreground">
          {dict.account.profileInfoTitle}
        </h2>
        <dl className="mt-4 text-sm">
          <dt className="text-muted">{dict.account.profilePhoneLabel}</dt>
          <dd className="mt-1 text-foreground">{formatPhone(session.phone)}</dd>
        </dl>
      </section>

      <section className="mt-8">
        <h2 className="text-base font-semibold text-foreground">{dict.account.ordersTitle}</h2>
        <div className="mt-4 flex flex-col items-center rounded-lg border border-border bg-surface-muted px-6 py-14 text-center">
          <Icon icon={PackageOpen} size="xl" className="text-muted" />
          <p className="mt-4 text-sm text-muted">{dict.account.ordersEmpty}</p>
          <Link
            href="/products"
            className="mt-6 rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/90"
          >
            {dict.account.ordersEmptyCta}
          </Link>
        </div>
      </section>
    </Container>
  );
}
