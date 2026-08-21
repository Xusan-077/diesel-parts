import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { blogPosts } from "@/lib/data/blog";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/server-locale";
import { canonicalPath } from "@/lib/seo";
import { Container } from "@/components/ui/container";
import { Breadcrumb, BreadcrumbJsonLd } from "@/components/breadcrumb";
import { finalise } from "@/lib/breadcrumb";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const lang = await getLocale();
  const dict = getDictionary(lang);
  const post = blogPosts.find((p) => p.slug === slug);

  if (!post) {
    return {};
  }

  return {
    title: `${post.title[lang]} — ${dict.meta.siteName}`,
    description: post.excerpt[lang],
    alternates: canonicalPath(`/blog/${post.slug}`),
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const lang = await getLocale();
  const dict = getDictionary(lang);

  const post = blogPosts.find((p) => p.slug === slug);
  if (!post) {
    notFound();
  }

  const paragraphs = post.body[lang].split("\n\n");

  const trail = finalise([
    { label: dict.nav.home, href: "/" },
    { label: dict.blog.title, href: "/blog" },
    { label: post.title[lang] },
  ]);

  return (
    <Container as="main" size="prose" className="pb-24 pt-6">
      <Breadcrumb items={trail} label={dict.common.breadcrumbLabel} className="mb-8" />
      <BreadcrumbJsonLd items={trail} />

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
