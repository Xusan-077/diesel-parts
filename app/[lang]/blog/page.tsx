import type { Metadata } from "next";
import Link from "next/link";
import { blogPosts } from "@/lib/data/blog";
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
    title: `${dict.blog.title} — ${dict.meta.siteName}`,
    description: dict.blog.subtitle,
  };
}

export default async function BlogPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang = isLocale(rawLang) ? rawLang : DEFAULT_LOCALE;
  const dict = getDictionary(lang);

  return (
    <main className="mx-auto max-w-4xl px-6 pb-24 pt-24">
      <h1 className="text-3xl font-semibold text-foreground">{dict.blog.title}</h1>
      <p className="mt-2 text-muted">{dict.blog.subtitle}</p>

      <div className="mt-10 space-y-8">
        {blogPosts.map((post) => (
          <article key={post.id} className="rounded-lg border border-border bg-white/2 p-6">
            <p className="text-sm text-muted">
              {dict.blog.publishedOn}: {post.publishedAt}
            </p>
            <h2 className="mt-2 text-xl font-semibold text-foreground">{post.title[lang]}</h2>
            <p className="mt-2 text-muted">{post.excerpt[lang]}</p>
            <Link
              href={`/${lang}/blog/${post.slug}`}
              className="mt-4 inline-block text-accent hover:underline"
            >
              {dict.blog.readMore}
            </Link>
          </article>
        ))}
      </div>
    </main>
  );
}
