import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/account/auth-card";
import { CodeForm } from "@/components/account/code-form";
import { maskPhone } from "@/lib/auth/phone";
import { getPendingPhone, getSession } from "@/lib/auth/session";
import { getLocaleDictionary } from "@/lib/i18n/server-locale";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getLocaleDictionary();
  return {
    title: `${dict.account.verifyTitle} — ${dict.meta.siteName}`,
    robots: { index: false, follow: false },
  };
}

export default async function VerifyPage() {
  const dict = await getLocaleDictionary();

  if (await getSession()) {
    redirect("/account");
  }

  const pendingPhone = await getPendingPhone();
  if (!pendingPhone) {
    redirect("/account/login");
  }

  return (
    <AuthCard
      title={dict.account.verifyTitle}
      subtitle={dict.account.verifySubtitle.replace("{phone}", maskPhone(pendingPhone))}
    >
      <CodeForm dict={dict.account} />
    </AuthCard>
  );
}
