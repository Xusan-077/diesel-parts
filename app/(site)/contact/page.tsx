import { getLocaleDictionary } from "@/lib/i18n/server-locale";
import type { Metadata } from "next";
import { canonicalPath } from "@/lib/seo";
import { Container } from "@/components/ui/container";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getLocaleDictionary();
  return {
    title: `${dict.contact.title} — ${dict.meta.siteName}`,
    description: dict.contact.subtitle,
    alternates: canonicalPath("/contact"),
  };
}

export default async function ContactPage() {
  const dict = await getLocaleDictionary();

  const info = [
    { title: dict.contact.addressTitle, value: dict.contact.address },
    { title: dict.contact.phoneTitle, value: dict.contact.phone },
    { title: dict.contact.emailTitle, value: dict.contact.email },
    { title: dict.contact.hoursTitle, value: dict.contact.hours },
  ];

  return (
    <Container as="main" size="narrow" className="pb-24 pt-12">
      <h1 className="text-3xl font-semibold text-foreground">{dict.contact.title}</h1>
      <p className="mt-2 text-muted">{dict.contact.subtitle}</p>

      <div className="mt-10 grid gap-6 sm:grid-cols-2">
        {info.map((item) => (
          <div key={item.title} className="rounded-lg border border-border bg-surface p-6">
            <p className="text-sm text-muted">{item.title}</p>
            <p className="mt-1 text-foreground">{item.value}</p>
          </div>
        ))}
      </div>
    </Container>
  );
}
