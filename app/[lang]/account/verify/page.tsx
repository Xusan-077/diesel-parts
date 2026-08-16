import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/account/auth-card";
import { CodeForm } from "@/components/account/code-form";
import { maskPhone } from "@/lib/auth/phone";
import { getPendingPhone, getSession } from "@/lib/auth/session";
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
    title: `${dict.account.verifyTitle} — ${dict.meta.siteName}`,
    robots: { index: false, follow: false },
  };
}

export default async function VerifyPage({
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

  const pendingPhone = await getPendingPhone();
  if (!pendingPhone) {
    redirect(`/${lang}/account/login`);
  }

  return (
    <AuthCard
      title={dict.account.verifyTitle}
      subtitle={dict.account.verifySubtitle.replace("{phone}", maskPhone(pendingPhone))}
    >
      <CodeForm lang={lang} dict={dict.account} />
    </AuthCard>
  );
}
