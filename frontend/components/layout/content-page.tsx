import type { ReactNode } from "react";
import { CtaBanner } from "@/components/marketing/cta-banner";
import { Container } from "@/components/ui/container";
import type { Dictionary } from "@/lib/i18n/dictionaries";

interface ContentPageProps {
  title: string;
  subtitle: string;
  home: Dictionary["home"];
  children: ReactNode;
}

/** Shared shell for the static marketing pages: hero, body, closing CTA. */
export function ContentPage({ title, subtitle, home, children }: ContentPageProps) {
  return (
    <main>
      <section className="border-b border-border bg-background-subtle">
        <Container size="content" className="py-16 text-center">
          <h1 className="text-3xl font-semibold text-foreground sm:text-4xl">{title}</h1>
          <p className="mx-auto mt-4 max-w-2xl text-muted">{subtitle}</p>
        </Container>
      </section>

      <Container className="py-16">{children}</Container>

      <Container as="section" className="pb-24">
        <CtaBanner home={home} />
      </Container>
    </main>
  );
}
