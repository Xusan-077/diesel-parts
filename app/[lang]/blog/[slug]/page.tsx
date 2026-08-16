import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { blogPosts } from "@/lib/data/blog";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { DEFAULT_LOCALE, isLocale, SUPPORTED_LOCALES } from "@/lib/i18n/locales";
import { localeAlternates } from "@/lib/seo";
import { Container } from "@/components/ui/container";

export function generateStaticParams() {
  return SUPPORTED_LOCALES.flatMap((lang) =>
    blogPosts.map((post) => ({ lang, slug: post.slug }))
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}): Promise<Metadata> {
  const { lang: rawLang, slug } = await params;
  const lang = isLocale(rawLang) ? rawLang : DEFAULT_LOCALE;
  const dict = getDictionary(lang);
  const post = blogPosts.find((p) => p.slug === slug);

  if (!post) {
    return {};
  }

  return {
    title: `${post.title[lang]} — ${dict.meta.siteName}`,
    description: post.excerpt[lang],
    alternates: localeAlternates(lang, `/blog/${post.slug}`),
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}) {
  const { lang: rawLang, slug } = await params;
  const lang = isLocale(rawLang) ? rawLang : DEFAULT_LOCALE;
  const dict = getDictionary(lang);

  const post = blogPosts.find((p) => p.slug === slug);
  if (!post) {
    notFound();
  }

  const paragraphs = post.body[lang].split("\n\n");

  return (
    <Container as="main" size="prose" className="pb-24 pt-12">
      <p className="text-sm text-muted">
        {dict.blog.publishedOn}: {post.publishedAt}
      </p>
      <h1 className="mt-2 text-3xl font-semibold text-foreground">{post.title[lang]}</h1>
      <div className="mt-8 space-y-4 text-muted">
        {paragraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>
    </Container>
  );
}
