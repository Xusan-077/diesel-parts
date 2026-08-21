import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/account/auth-card";
import { PhoneForm } from "@/components/account/phone-form";
import { getSession } from "@/lib/auth/session";
import { getLocaleDictionary } from "@/lib/i18n/server-locale";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getLocaleDictionary();
  return {
    title: `${dict.account.loginTitle} — ${dict.meta.siteName}`,
    robots: { index: false, follow: false },
  };
}

export default async function LoginPage() {
  const dict = await getLocaleDictionary();

  if (await getSession()) {
    redirect("/account");
  }

  return (
    <AuthCard title={dict.account.loginTitle} subtitle={dict.account.loginSubtitle}>
      <PhoneForm dict={dict.account} />
    </AuthCard>
  );
}
