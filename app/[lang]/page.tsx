import { getDictionary } from "@/lib/i18n/dictionaries";

export default async function HomePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const dict = getDictionary(lang);

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-24 text-center">
      <div>
        <h1 className="text-3xl font-semibold">{dict.home.heroTitle}</h1>
        <p className="mt-4 text-muted">{dict.home.heroSubtitle}</p>
      </div>
    </main>
  );
}
