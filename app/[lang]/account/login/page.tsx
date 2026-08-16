import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/account/auth-card";
import { PhoneForm } from "@/components/account/phone-form";
import { getSession } from "@/lib/auth/session";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/locales";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const dict = getDictionary(lang);
  return {
    title: `${dict.account.loginTitle} — ${dict.meta.siteName}`,
    robots: { index: false, follow: false },
  };
}

export default async function LoginPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang = isLocale(rawLang) ? rawLang : DEFAULT_LOCALE;
  const dict = getDictionary(lang);

  if (await getSession()) {
    redirect(`/${lang}/account`);
  }

  return (
    <AuthCard title={dict.account.loginTitle} subtitle={dict.account.loginSubtitle}>
      <PhoneForm lang={lang} dict={dict.account} />
    </AuthCard>
  );
}
